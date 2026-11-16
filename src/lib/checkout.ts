import "server-only";
import { z } from "zod";
import { q, q1, tx } from "./db";
import { loadProducts, type InternalProduct } from "./catalog";
import { evaluateBundles, evaluateDiscount, estimateFee, type BundleRow, type DiscountRow } from "./pricing";
import { estimateImportCosts, PROVINCES, toPublicOption, type ImportEstimate, type PublicShippingOption, type ShippingOption } from "./shipping";
import { adapterFor, getSupplier, supplierContext } from "./suppliers";
import { withTimeout } from "./suppliers/types";
import { getSettings } from "./settings";
import { randomToken } from "./crypto";

export const cartLineSchema = z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(10) });
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const addressSchema = z.object({
  recipient: z.string().trim().min(2, "Enter the recipient's full name").max(120),
  phone: z.string().trim().regex(/^(\+27|0)[1-9]\d{8}$/, "Enter a valid South African phone number, e.g. 082 123 4567"),
  line1: z.string().trim().min(3, "Enter the street address").max(160),
  line2: z.string().trim().max(160).optional().default(""),
  suburb: z.string().trim().max(80).optional().default(""),
  city: z.string().trim().min(2, "Enter the city or town").max(80),
  province: z.enum(PROVINCES.map((p) => p.code) as [string, ...string[]], { message: "Choose a province" }),
  postalCode: z.string().trim().regex(/^\d{4}$/, "South African postal codes have 4 digits"),
});
export type AddressInput = z.infer<typeof addressSchema>;
export const normalisePhone = (p: string) => p.replace(/[\s-]/g, "");

type ResolvedLine = { product: InternalProduct; variant: InternalProduct["variants"][number]; quantity: number };

export type PricedCart = {
  lines: { variantId: string; productId: string; slug: string; name: string; variantName: string; kind: string; finishHex: string | null; quantity: number; unitCents: number; regularCents: number; lineCents: number; inStock: boolean; maxQty: number }[];
  problems: string[];
  subtotalCents: number;
  bundleDiscounts: { name: string; amountCents: number }[];
  codeDiscount: { code: string; amountCents: number } | null;
  codeError: string | null;
  discountCents: number;
};

async function resolveLines(input: CartLineInput[]): Promise<{ lines: ResolvedLine[]; problems: string[] }> {
  const products = await loadProducts("published");
  const lines: ResolvedLine[] = [], problems: string[] = [];
  for (const l of input) {
    const product = products.find((p) => p.variants.some((v) => v.id === l.variantId));
    const variant = product?.variants.find((v) => v.id === l.variantId);
    if (!product || !variant) { problems.push("An item in your cart is no longer available and was removed."); continue; }
    if (!variant.inStock) { problems.push(`${product.name} is currently out of stock.`); continue; }
    const qty = Math.min(l.quantity, variant.stock);
    if (qty < l.quantity) problems.push(`Only ${variant.stock} of ${product.name} available — quantity adjusted.`);
    lines.push({ product, variant, quantity: qty });
  }
  return { lines, problems };
}

export async function priceCart(input: CartLineInput[], code?: string | null): Promise<PricedCart & { _resolved: ResolvedLine[] }> {
  const { lines, problems } = await resolveLines(input);
  const subtotal = lines.reduce((s, l) => s + l.variant.priceCents * l.quantity, 0);
  const bundles = await q<BundleRow>("SELECT id, name, percent_off_bps, product_ids FROM bundles WHERE active");
  const bundleDiscounts = evaluateBundles(bundles, lines.map((l) => ({ productId: l.product.id, unitCents: l.variant.priceCents, quantity: l.quantity })));
  const bundleTotal = bundleDiscounts.reduce((s, b) => s + b.amountCents, 0);
  let codeDiscount: PricedCart["codeDiscount"] = null, codeError: string | null = null;
  if (code?.trim()) {
    const d = await q1<DiscountRow>("SELECT * FROM discounts WHERE upper(code) = upper($1)", [code.trim()]);
    const r = evaluateDiscount(d, subtotal - bundleTotal);
    if (r.ok) codeDiscount = { code: d!.code, amountCents: r.amountCents };
    else codeError = r.reason ?? "This code is not valid.";
  }
  return {
    lines: lines.map((l) => ({ variantId: l.variant.id, productId: l.product.id, slug: l.product.slug, name: l.product.name, variantName: l.variant.name, kind: l.product.kind, finishHex: l.variant.finishHex, quantity: l.quantity, unitCents: l.variant.priceCents, regularCents: l.variant.regularCents, lineCents: l.variant.priceCents * l.quantity, inStock: l.variant.inStock, maxQty: Math.min(10, l.variant.stock) })),
    problems, subtotalCents: subtotal, bundleDiscounts, codeDiscount, codeError,
    discountCents: bundleTotal + (codeDiscount?.amountCents ?? 0),
    _resolved: lines,
  };
}

export type ShipmentQuote = {
  supplierId: number;
  items: { name: string; quantity: number }[];
  options: PublicShippingOption[];
  importEstimate: ImportEstimate;
  error?: string;
};

type InternalShipmentQuote = Omit<ShipmentQuote, "options"> & { options: ShippingOption[]; lines: ResolvedLine[] };

/** One shipment per supplier. Shipping options come from that supplier's adapter for this exact basket and address. */
async function quoteShipmentsInternal(lines: ResolvedLine[], dest: { province: string; postalCode: string; city: string }): Promise<InternalShipmentQuote[]> {
  const settings = await getSettings();
  const groups = new Map<number, ResolvedLine[]>();
  for (const l of lines) {
    const sid = l.variant.offer!.supplierId;
    groups.set(sid, [...(groups.get(sid) ?? []), l]);
  }
  const out: InternalShipmentQuote[] = [];
  for (const [supplierId, ls] of groups) {
    const supplier = (await getSupplier(supplierId))!;
    const adapter = adapterFor(supplier.adapter);
    const ctx = await supplierContext(supplier);
    let options: ShippingOption[] = [], error: string | undefined;
    try {
      options = await withTimeout(adapter.getShippingOptions(ctx, {
        destination: { ...dest, country: "ZA" },
        parcels: ls.map((l) => ({ weightG: l.product.weightG, lengthMm: l.product.lengthMm, widthMm: l.product.widthMm, heightMm: l.product.heightMm, quantity: l.quantity })),
        items: ls.map((l) => ({ ref: l.variant.offer!.supplierRef, quantity: l.quantity })),
      }), 15000, "Shipping quote");
      if (!options.length) error = "No delivery method is currently available for these items to this address.";
    } catch {
      error = "We could not get a delivery quote for these items right now. Please try again shortly.";
    }
    out.push({
      supplierId,
      items: ls.map((l) => ({ name: l.product.name, quantity: l.quantity })),
      options: options.sort((a, b) => a.priceCents - b.priceCents),
      importEstimate: estimateImportCosts(ls.map((l) => ({ valueCents: l.variant.priceCents, quantity: l.quantity, dutyRateBps: l.product.category.dutyRateBps, dutyVerified: l.product.category.dutyVerified })), settings),
      error, lines: ls,
    });
  }
  return out;
}

export async function quoteShipments(input: CartLineInput[], dest: { province: string; postalCode: string; city: string }): Promise<ShipmentQuote[]> {
  const { lines } = await resolveLines(input);
  return (await quoteShipmentsInternal(lines, dest)).map(({ lines: _l, options, ...s }) => ({ ...s, options: options.map(toPublicOption) }));
}

export const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  address: addressSchema,
  lines: z.array(cartLineSchema).min(1, "Your cart is empty").max(30),
  shipping: z.record(z.string(), z.string()),      // supplierId → option code
  discountCode: z.string().trim().max(40).optional().nullable(),
  acceptTerms: z.literal(true, { message: "Please accept the terms to continue" }),
  expectedTotalCents: z.number().int(),              // what the customer saw; we refuse if it changed
});

export type CreateOrderResult = { ok: true; orderId: string; number: string; accessToken: string; paymentId: string } | { ok: false; error: string };

/**
 * Creates the order, its items, one fulfilment per supplier and an initiated payment — all in one transaction.
 * Everything is re-priced on the server; the client's numbers are only used to detect a changed total.
 * No supplier is contacted here: fulfilments stay 'pending' until the payment is confirmed.
 */
export async function createOrder(raw: unknown, userId: string | null): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const input = parsed.data;
  const cart = await priceCart(input.lines, input.discountCode);
  if (cart.problems.length) return { ok: false, error: cart.problems[0] };
  if (!cart._resolved.length) return { ok: false, error: "Your cart is empty." };
  if (input.discountCode && cart.codeError) return { ok: false, error: cart.codeError };

  const shipments = await quoteShipmentsInternal(cart._resolved, input.address);
  const chosen: { s: InternalShipmentQuote; o: ShippingOption }[] = [];
  for (const s of shipments) {
    if (s.error) return { ok: false, error: s.error };
    const o = s.options.find((x) => x.code === input.shipping[String(s.supplierId)]);
    if (!o) return { ok: false, error: "Please choose a delivery method for every shipment." };
    chosen.push({ s, o });
  }
  const settings = await getSettings();
  const shippingCents = chosen.reduce((t, c) => t + c.o.priceCents, 0);
  const shippingCost = chosen.reduce((t, c) => t + c.o.costCents, 0);
  // DDP: we collect the import-cost estimate now and the business pays the carrier. DAP: nothing is collected.
  const dutiesCollected = chosen.reduce((t, c) => t + (c.o.incoterm === "DDP" ? c.s.importEstimate.totalCents : 0), 0);
  const total = cart.subtotalCents - cart.discountCents + shippingCents + dutiesCollected;
  if (total !== input.expectedTotalCents) return { ok: false, error: "Prices or delivery costs changed while you were checking out. Please review the updated total." };
  const cost = cart._resolved.reduce((t, l) => t + l.variant.offer!.costCents * l.quantity, 0);
  const a = input.address;

  return tx(async (c) => {
    const { nextval } = (await q1<{ nextval: string }>("SELECT nextval('order_number_seq')", [], c))!;
    const number = `SAM-${nextval}`;
    const accessToken = randomToken(18);
    const order = (await q1<{ id: string }>(
      `INSERT INTO orders(number, access_token, user_id, email, ship_recipient, ship_phone, ship_line1, ship_line2, ship_suburb, ship_city, ship_province, ship_postal_code,
         subtotal_cents, discount_cents, shipping_cents, duties_collected_cents, total_cents, discount_code, cost_cents, shipping_cost_cents, import_cost_cents, payment_fee_cents, accepted_terms_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22, now()) RETURNING id`,
      [number, accessToken, userId, input.email, a.recipient, normalisePhone(a.phone), a.line1, a.line2 || null, a.suburb || null, a.city, a.province, a.postalCode,
        cart.subtotalCents, cart.discountCents, shippingCents, dutiesCollected, total, cart.codeDiscount?.code ?? null, cost, shippingCost, dutiesCollected, estimateFee(total, settings)], c))!;
    for (const { s, o } of chosen) {
      const f = (await q1<{ id: string }>(
        `INSERT INTO fulfillments(order_id, supplier_id, idempotency_key, shipping_method, shipping_carrier, incoterm, eta_min_days, eta_max_days, shipping_cents, shipping_cost_cents, duties_estimate_cents)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [order.id, s.supplierId, `${number}-S${s.supplierId}`, o.code, o.carrier, o.incoterm, o.minDays, o.maxDays, o.priceCents, o.costCents, s.importEstimate.totalCents], c))!;
      for (const l of s.lines) {
        await q(
          `INSERT INTO order_items(order_id, fulfillment_id, product_id, variant_id, supplier_id, supplier_ref, name, variant_name, sku, quantity, unit_price_cents, unit_cost_cents)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [order.id, f.id, l.product.id, l.variant.id, s.supplierId, l.variant.offer!.supplierRef, l.product.name, l.variant.name, l.variant.sku, l.quantity, l.variant.priceCents, l.variant.offer!.costCents], c);
      }
    }
    const { env } = await import("./env");
    const payment = (await q1<{ id: string }>("INSERT INTO payments(order_id, provider, amount_cents) VALUES ($1,$2,$3) RETURNING id", [order.id, env.paymentProvider, total], c))!;
    await q("INSERT INTO order_events(order_id, kind, message) VALUES ($1,'order_received','Order received')", [order.id], c);
    return { ok: true as const, orderId: order.id, number, accessToken, paymentId: payment.id };
  });
}
