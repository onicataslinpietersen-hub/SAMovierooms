import "server-only";
import { LAST_MILE_DAYS, zoneFor, type ShippingOption } from "../shipping";
import { SupplierError, type CatalogItem, type SupplierAdapter, type SupplierContext, type SupplierOrderStatus } from "./types";

/**
 * CJdropshipping adapter (API 2.0).
 *
 * STATUS: UNTESTED. Written against CJ's published API 2.0 reference (product list/query, stock, freightCalculate,
 * createOrderV2, getOrderDetail, trackInfo) but it has never been run against a live CJ account — the developer docs
 * and API were not reachable from the build environment and no API key was available. Before enabling:
 *   1. Create a CJ account, generate an API key (My CJ → Authorization → API) and save it under Admin → Suppliers.
 *   2. Press "Test connection", then run a real low-value test order to a South African address.
 *   3. Check each endpoint/field below against https://developers.cjdropshipping.com — CJ has revised these
 *      (e.g. createOrderV3, the tracking endpoint) and field names may have changed.
 * The supplier stays in "pending verification" until an admin approves it, so nothing here can run by accident.
 *
 * Notes that matter for the business:
 *   - CJ only starts fulfilment once the order is PAID from your CJ wallet. submitOrder() creates the order with
 *     payType 2 (balance payment); if the wallet is short the order sits unpaid at CJ and we raise an alert.
 *   - CJ quotes product and freight prices in USD; they are converted with the admin-set usd_zar rate.
 *   - Duty/VAT handling depends on the shipping line chosen; treat every CJ line as DAP unless CJ confirms otherwise.
 */
const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const tokens = new Map<number, { token: string; exp: number }>();

async function call<T>(ctx: SupplierContext, method: "GET" | "POST", path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["CJ-Access-Token"] = await accessToken(ctx);
  let res: Response;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  } catch (e) {
    // A network failure on a POST that creates something is ambiguous: the order may exist at CJ.
    throw new SupplierError(`CJ request failed: ${(e as Error).message}`, { retryable: true, ambiguous: method === "POST" && path.includes("createOrder") });
  }
  const json = (await res.json().catch(() => null)) as { result?: boolean; code?: number; message?: string; data?: T } | null;
  if (!res.ok || !json || json.result === false) {
    throw new SupplierError(`CJ ${path}: ${json?.message ?? res.status}`, { retryable: res.status >= 500 || res.status === 429 });
  }
  return json.data as T;
}

async function accessToken(ctx: SupplierContext): Promise<string> {
  const cached = tokens.get(ctx.supplierId);
  if (cached && cached.exp > Date.now()) return cached.token;
  const apiKey = ctx.credentials?.api_key;
  if (!apiKey) throw new SupplierError("CJ API key is not configured", { retryable: false });
  const data = await call<{ accessToken: string }>(ctx, "POST", "/authentication/getAccessToken", { apiKey }, false);
  tokens.set(ctx.supplierId, { token: data.accessToken, exp: Date.now() + 1000 * 60 * 60 * 24 * 10 });
  return data.accessToken;
}

const usdToCents = (ctx: SupplierContext, usd: number) => {
  if (!ctx.usdZar) throw new SupplierError("USD→ZAR rate is not set (Admin → Settings)", { retryable: false });
  return Math.round(usd * ctx.usdZar * 100);
};

type CjProduct = { pid: string; productNameEn: string; productSku: string; productImage: string; productWeight: number; sellPrice: number | string; description?: string;
  variants?: { vid: string; variantNameEn: string; variantSku: string; variantSellPrice: number; variantWeight: number; variantLength: number; variantWidth: number; variantHeight: number }[] };

export const cjAdapter: SupplierAdapter = {
  key: "cjdropshipping",
  label: "CJdropshipping (API 2.0)",
  capabilities: { catalog: true, stockSync: true, priceSync: true, orders: true, tracking: true, cancel: false },
  credentialFields: [{ key: "api_key", label: "CJ API key", secret: true }],
  notes: "Untested against a live account — verify with a real test order before approving.",

  async testConnection(ctx) {
    try {
      await accessToken(ctx);
      return { ok: true, message: "Authenticated with CJdropshipping." };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async searchCatalog(ctx, query): Promise<CatalogItem[]> {
    const data = await call<{ list: CjProduct[] }>(ctx, "GET", `/product/list?pageNum=1&pageSize=20&productNameEn=${encodeURIComponent(query)}`);
    const out: CatalogItem[] = [];
    for (const p of (data.list ?? []).slice(0, 10)) {
      const full = await call<CjProduct>(ctx, "GET", `/product/query?pid=${encodeURIComponent(p.pid)}`);
      const v0 = full.variants?.[0];
      out.push({
        ref: full.pid,
        name: full.productNameEn,
        brand: "",
        categorySlug: "",
        kind: "projector",
        shortDescription: "",
        description: (full.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 4000),
        // Specs are deliberately left empty: CJ listings carry marketing text, not verified specifications.
        // An admin must enter specs from the manufacturer's datasheet before the product can be published.
        specs: {},
        images: full.productImage ? [{ url: full.productImage, alt: full.productNameEn }] : [],
        warranty: "",
        weightG: Math.round(v0?.variantWeight ?? full.productWeight ?? 0),
        lengthMm: Math.round(v0?.variantLength ?? 0), widthMm: Math.round(v0?.variantWidth ?? 0), heightMm: Math.round(v0?.variantHeight ?? 0),
        variants: (full.variants ?? []).map((v) => ({ ref: v.vid, name: v.variantNameEn || v.variantSku, costCents: usdToCents(ctx, v.variantSellPrice), sourceCurrency: "USD", sourceAmount: v.variantSellPrice, stock: 0, moq: 1 })),
      });
    }
    return out;
  },

  async getOffers(ctx, refs) {
    const out = [];
    for (const vid of refs) {
      const [variant, stock] = await Promise.all([
        call<{ variantSellPrice: number }>(ctx, "GET", `/product/variant/queryByVid?vid=${encodeURIComponent(vid)}`).catch(() => null),
        call<{ storageNum: number; countryCode: string }[]>(ctx, "GET", `/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`).catch(() => null),
      ]);
      out.push({
        ref: vid,
        costCents: variant ? usdToCents(ctx, variant.variantSellPrice) : null,
        sourceCurrency: "USD",
        sourceAmount: variant?.variantSellPrice ?? null,
        stock: stock ? stock.reduce((s, w) => s + (w.storageNum ?? 0), 0) : null,
      });
    }
    return out;
  },

  async getShippingOptions(ctx, req): Promise<ShippingOption[]> {
    const data = await call<{ logisticName: string; logisticPrice: number; logisticAging: string }[]>(ctx, "POST", "/logistic/freightCalculate", {
      startCountryCode: ctx.warehouseCountry || "CN",
      endCountryCode: req.destination.country,
      zip: req.destination.postalCode,
      products: req.items.map((i) => ({ vid: i.ref, quantity: i.quantity })),
    });
    const lm = LAST_MILE_DAYS[zoneFor(req.destination.province)];
    return (data ?? []).map((l) => {
      const [a, b] = (l.logisticAging.match(/\d+/g) ?? ["0", "0"]).map(Number);
      const cost = usdToCents(ctx, l.logisticPrice);
      // CJ's "aging" is its door-to-door estimate in calendar days; we add nothing on top but keep the outlying-area spread.
      return { code: l.logisticName, label: l.logisticName, carrier: l.logisticName, incoterm: "DAP" as const, costCents: cost, priceCents: Math.ceil(cost / 1000) * 1000, minDays: a, maxDays: (b || a) + (lm[1] - lm[0]), breakdown: { handling: [0, 0], transit: [a, b || a], customs: [0, 0], lastMile: [0, lm[1] - lm[0]] } };
    });
  },

  async submitOrder(ctx, req) {
    const d = req.destination;
    const data = await call<{ orderId: string }>(ctx, "POST", "/shopping/order/createOrderV2", {
      orderNumber: req.idempotencyKey,           // CJ rejects duplicate orderNumbers, which gives us idempotency
      shippingCountryCode: d.country,
      shippingCountry: "South Africa",
      shippingProvince: d.province,
      shippingCity: d.city,
      shippingAddress: d.line1,
      shippingAddress2: [d.line2, d.suburb].filter(Boolean).join(", "),
      shippingZip: d.postalCode,
      shippingCustomerName: d.recipient,
      shippingPhone: d.phone,
      email: d.email,
      logisticName: req.shippingCode,
      fromCountryCode: ctx.warehouseCountry || "CN",
      payType: 2,
      products: req.items.map((i) => ({ vid: i.ref, quantity: i.quantity })),
    });
    if (!data?.orderId) throw new SupplierError("CJ did not return an order id", { retryable: true, ambiguous: true });
    return { supplierOrderRef: data.orderId };
  },

  async findOrder(ctx, idempotencyKey) {
    const data = await call<{ list: { orderId: string; orderNum: string }[] }>(ctx, "GET", `/shopping/order/list?pageNum=1&pageSize=10&orderNumber=${encodeURIComponent(idempotencyKey)}`);
    const hit = (data.list ?? []).find((o) => o.orderNum === idempotencyKey);
    return hit ? { supplierOrderRef: hit.orderId } : null;
  },

  async getOrderStatus(ctx, ref): Promise<SupplierOrderStatus> {
    const o = await call<{ orderStatus: string; trackNumber?: string; logisticName?: string }>(ctx, "GET", `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(ref)}`);
    const map: Record<string, SupplierOrderStatus["status"]> = { CREATED: "submitted", IN_CART: "submitted", UNPAID: "submitted", UNSHIPPED: "confirmed", SHIPPED: "shipped", DELIVERED: "delivered", CANCELLED: "cancelled" };
    const status = map[o.orderStatus] ?? "submitted";
    let events: SupplierOrderStatus["events"] = [];
    if (o.trackNumber) {
      const t = await call<{ trackingStatus?: string; deliveryTime?: string; lastMileCarrier?: string }[]>(ctx, "GET", `/logistic/trackInfo?trackNumber=${encodeURIComponent(o.trackNumber)}`).catch(() => []);
      events = (t ?? []).filter((x) => x.trackingStatus).map((x) => ({ status: "info", description: x.trackingStatus!, occurredAt: x.deliveryTime ? new Date(x.deliveryTime) : new Date() }));
    }
    return { status, trackingNumber: o.trackNumber || undefined, carrier: o.logisticName, events };
  },
};
