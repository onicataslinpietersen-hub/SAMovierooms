/**
 * Pricing engine (pure functions — unit tested).
 * Precedence: individual product price > product markup rule > category rule (nearest ancestor) > global rule.
 * An active promotional price replaces the regular price for the promo window.
 */
export type PricingRule = { scope: "global" | "category" | "product"; category_id: number | null; product_id: string | null; kind: "percent" | "fixed"; value: number };

export type PriceInput = {
  costCents: number;
  productId: string;
  categoryChain: number[];          // [own category, parent, ...]
  overrideCents: number | null;
  promoCents: number | null;
  promoStarts: Date | null;
  promoEnds: Date | null;
};

/** Round up to a retail-looking price ending in 9 (R3 999, R12 499). */
export function retailRound(cents: number): number {
  const rands = Math.ceil(cents / 100);
  if (rands < 100) return rands * 100;
  return (Math.ceil((rands + 1) / 10) * 10 - 1) * 100;
}

export function applyRule(costCents: number, rule: Pick<PricingRule, "kind" | "value">): number {
  return rule.kind === "percent" ? Math.round(costCents * (1 + rule.value / 10000)) : costCents + rule.value;
}

export function pickRule(rules: PricingRule[], productId: string, categoryChain: number[]): PricingRule | null {
  const product = rules.find((r) => r.scope === "product" && r.product_id === productId);
  if (product) return product;
  for (const cid of categoryChain) {
    const c = rules.find((r) => r.scope === "category" && r.category_id === cid);
    if (c) return c;
  }
  return rules.find((r) => r.scope === "global") ?? null;
}

export type Price = { regularCents: number; finalCents: number; onPromo: boolean; source: "override" | "product_rule" | "category_rule" | "global_rule" | "none" };

export function resolvePrice(input: PriceInput, rules: PricingRule[], now = new Date()): Price {
  let regular: number;
  let source: Price["source"];
  if (input.overrideCents && input.overrideCents > 0) {
    regular = input.overrideCents;
    source = "override";
  } else {
    const rule = pickRule(rules, input.productId, input.categoryChain);
    if (!rule) return { regularCents: 0, finalCents: 0, onPromo: false, source: "none" };
    regular = retailRound(applyRule(input.costCents, rule));
    source = rule.scope === "product" ? "product_rule" : rule.scope === "category" ? "category_rule" : "global_rule";
  }
  const promoActive =
    !!input.promoCents && input.promoCents > 0 && input.promoCents < regular &&
    (!input.promoStarts || input.promoStarts <= now) && (!input.promoEnds || input.promoEnds >= now);
  return { regularCents: regular, finalCents: promoActive ? input.promoCents! : regular, onPromo: promoActive, source };
}

export type FeeModel = { payment_fee_bps: number; payment_fee_fixed_cents: number };
export const estimateFee = (amountCents: number, f: FeeModel) => Math.round((amountCents * f.payment_fee_bps) / 10000) + f.payment_fee_fixed_cents;

/**
 * Estimated gross profit = retail − supplier cost − shipping paid by the business − import costs paid by the business − payment fees.
 * `shippingChargedCents` is what the customer pays towards shipping (0 when shipping is free to them).
 */
export function profit(p: { retailCents: number; costCents: number; shippingCostCents?: number; shippingChargedCents?: number; importCostCents?: number }, fees: FeeModel) {
  const charged = p.shippingChargedCents ?? 0;
  const revenue = p.retailCents + charged;
  const fee = estimateFee(revenue, fees);
  const gross = revenue - p.costCents - (p.shippingCostCents ?? 0) - (p.importCostCents ?? 0) - fee;
  return { revenueCents: revenue, feeCents: fee, grossProfitCents: gross, marginBps: revenue > 0 ? Math.round((gross / revenue) * 10000) : 0 };
}

export type DiscountRow = { code: string; kind: "percent" | "fixed"; value: number; min_subtotal_cents: number; max_uses: number | null; used: number; starts_at: Date | null; ends_at: Date | null; active: boolean };

export function evaluateDiscount(d: DiscountRow | null, subtotalCents: number, now = new Date()): { ok: boolean; amountCents: number; reason?: string } {
  if (!d || !d.active) return { ok: false, amountCents: 0, reason: "This code is not valid." };
  if (d.starts_at && d.starts_at > now) return { ok: false, amountCents: 0, reason: "This code is not active yet." };
  if (d.ends_at && d.ends_at < now) return { ok: false, amountCents: 0, reason: "This code has expired." };
  if (d.max_uses !== null && d.used >= d.max_uses) return { ok: false, amountCents: 0, reason: "This code has reached its usage limit." };
  if (subtotalCents < d.min_subtotal_cents) return { ok: false, amountCents: 0, reason: `This code needs a minimum spend of R${(d.min_subtotal_cents / 100).toFixed(0)}.` };
  const amt = d.kind === "percent" ? Math.round((subtotalCents * d.value) / 10000) : d.value;
  return { ok: true, amountCents: Math.min(amt, subtotalCents) };
}

export type BundleRow = { id: number; name: string; percent_off_bps: number; product_ids: string[] };

/** A bundle applies when every product in it is in the cart; the discount applies to one unit of each. */
export function evaluateBundles(bundles: BundleRow[], lines: { productId: string; unitCents: number; quantity: number }[]): { name: string; amountCents: number }[] {
  const out: { name: string; amountCents: number }[] = [];
  for (const b of bundles) {
    const matched = b.product_ids.map((id) => lines.find((l) => l.productId === id));
    if (matched.length && matched.every(Boolean)) {
      const base = matched.reduce((s, l) => s + l!.unitCents, 0);
      out.push({ name: b.name, amountCents: Math.round((base * b.percent_off_bps) / 10000) });
    }
  }
  return out;
}
