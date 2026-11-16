import "server-only";
import { q, q1 } from "../db";
import { chargeableKg, LAST_MILE_DAYS, zoneFor, type ShippingOption } from "../shipping";
import { SANDBOX_CATALOG } from "./sandbox-catalog";
import { SupplierError, type SupplierAdapter, type SupplierOrderStatus } from "./types";

/**
 * SANDBOX supplier — a simulated external supplier used for demos and automated tests.
 * It behaves like a real API (idempotent order creation, asynchronous status, tracking events)
 * but nothing is shipped. It refuses to run unless DEMO_MODE=true.
 *
 * Test hooks (put the token in address line 2):
 *   FAIL-SUPPLIER     → order rejected (non-retryable)
 *   FLAKY-SUPPLIER    → first attempt fails with a retryable error
 *   TIMEOUT-SUPPLIER  → supplier creates the order but our request times out (ambiguous outcome)
 */
const stageSeconds = () => Number(process.env.SANDBOX_STAGE_SECONDS || 45);
const guard = () => {
  if (process.env.DEMO_MODE !== "true") throw new SupplierError("Sandbox supplier is disabled outside DEMO_MODE", { retryable: false });
};
const flaky = new Set<string>();
const round10 = (cents: number) => Math.ceil(cents / 1000) * 1000;

export const sandboxAdapter: SupplierAdapter = {
  key: "sandbox",
  label: "Sandbox supplier (simulated)",
  capabilities: { catalog: true, stockSync: true, priceSync: true, orders: true, tracking: true, cancel: true },
  credentialFields: [],
  notes: "Simulated supplier for demos and tests. No goods are shipped.",

  async testConnection() {
    guard();
    return { ok: true, message: `Sandbox reachable — ${SANDBOX_CATALOG.length} sample products.` };
  },

  async searchCatalog(_ctx, query) {
    guard();
    const s = query.trim().toLowerCase();
    return SANDBOX_CATALOG.filter((i) => !s || i.name.toLowerCase().includes(s) || i.categorySlug.includes(s) || i.ref.toLowerCase().includes(s));
  },

  async getOffers(_ctx, refs) {
    guard();
    const all = SANDBOX_CATALOG.flatMap((i) => i.variants);
    return refs.map((ref) => {
      const v = all.find((x) => x.ref === ref);
      return { ref, costCents: v?.costCents ?? null, sourceCurrency: "ZAR", sourceAmount: v?.sourceAmount ?? null, stock: v?.stock ?? 0 };
    });
  },

  async getShippingOptions(_ctx, req) {
    guard();
    const kg = chargeableKg(req.parcels);
    const lm = LAST_MILE_DAYS[zoneFor(req.destination.province)];
    const mk = (o: Omit<ShippingOption, "minDays" | "maxDays" | "priceCents" | "isSample">): ShippingOption => ({
      ...o,
      priceCents: round10(o.costCents),
      minDays: o.breakdown.handling[0] + o.breakdown.transit[0] + o.breakdown.customs[0] + lm[0],
      maxDays: o.breakdown.handling[1] + o.breakdown.transit[1] + o.breakdown.customs[1] + lm[1],
      breakdown: { ...o.breakdown, lastMile: lm },
      isSample: true,
    });
    if (kg > 30) {
      return [
        mk({ code: "air-freight", label: "Air freight", carrier: "Supplier-arranged air freight", incoterm: "DAP", costCents: 120000 + Math.round(kg * 6500), breakdown: { handling: [2, 4], transit: [6, 10], customs: [2, 5], lastMile: lm } }),
        mk({ code: "sea-freight", label: "Sea freight (economy)", carrier: "Supplier-arranged sea freight", incoterm: "DAP", costCents: 180000 + Math.round(kg * 1800), breakdown: { handling: [3, 6], transit: [28, 40], customs: [3, 7], lastMile: lm } }),
      ];
    }
    return [
      mk({ code: "express-ddp", label: "Express courier — duties prepaid", carrier: "International express courier", incoterm: "DDP", costCents: 45000 + Math.round(kg * 16000), breakdown: { handling: [1, 3], transit: [4, 7], customs: [1, 2], lastMile: lm } }),
      mk({ code: "standard-dap", label: "Standard air — duties on delivery", carrier: "Supplier-arranged air parcel", incoterm: "DAP", costCents: 22000 + Math.round(kg * 9000), breakdown: { handling: [1, 3], transit: [9, 15], customs: [2, 5], lastMile: lm } }),
    ];
  },

  async submitOrder(_ctx, req) {
    guard();
    const hook = `${req.destination.line2 ?? ""}`;
    if (hook.includes("FAIL-SUPPLIER")) throw new SupplierError("Sandbox: order rejected — address not serviceable", { retryable: false });
    if (hook.includes("FLAKY-SUPPLIER") && !flaky.has(req.idempotencyKey)) {
      flaky.add(req.idempotencyKey);
      throw new SupplierError("Sandbox: 503 service unavailable", { retryable: true });
    }
    // Idempotent on our key, exactly like a well-behaved supplier API.
    const ref = "SBX-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    const row = await q1<{ ref: string }>(
      `INSERT INTO sandbox_supplier_orders(ref, idempotency_key, payload) VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key RETURNING ref`,
      [ref, req.idempotencyKey, JSON.stringify(req)],
    );
    if (hook.includes("TIMEOUT-SUPPLIER") && !flaky.has("t:" + req.idempotencyKey)) {
      flaky.add("t:" + req.idempotencyKey);
      throw new SupplierError("Sandbox: request timed out", { retryable: true, ambiguous: true });
    }
    return { supplierOrderRef: row!.ref };
  },

  async findOrder(_ctx, idempotencyKey) {
    guard();
    const row = await q1<{ ref: string }>("SELECT ref FROM sandbox_supplier_orders WHERE idempotency_key = $1", [idempotencyKey]);
    return row ? { supplierOrderRef: row.ref } : null;
  },

  async getOrderStatus(_ctx, ref): Promise<SupplierOrderStatus> {
    guard();
    const row = await q1<{ created_at: Date; cancelled: boolean; payload: { destination: { city: string } } }>("SELECT created_at, cancelled, payload FROM sandbox_supplier_orders WHERE ref = $1", [ref]);
    if (!row) throw new SupplierError("Sandbox: unknown order " + ref, { retryable: false });
    if (row.cancelled) return { status: "cancelled", events: [] };
    const t0 = row.created_at.getTime(), s = stageSeconds() * 1000;
    const stage = Math.floor((Date.now() - t0) / s);
    const at = (n: number) => new Date(t0 + n * s);
    const timeline: { status: SupplierOrderStatus["status"] | "customs"; description: string; location?: string }[] = [
      { status: "submitted", description: "Order received by supplier" },
      { status: "confirmed", description: "Order confirmed and being packed", location: "Supplier warehouse" },
      { status: "shipped", description: "Parcel handed to carrier", location: "Shenzhen, CN" },
      { status: "in_transit", description: "Departed origin facility", location: "Hong Kong, HK" },
      { status: "customs", description: "Arrived in South Africa — customs clearance", location: "Johannesburg (OR Tambo), ZA" },
      { status: "out_for_delivery", description: "Out for delivery", location: row.payload.destination.city },
      { status: "delivered", description: "Delivered", location: row.payload.destination.city },
    ];
    const reached = timeline.slice(0, Math.min(stage, timeline.length - 1) + 1);
    const last = reached[reached.length - 1].status;
    return {
      status: last === "customs" ? "in_transit" : last,
      trackingNumber: stage >= 2 ? "SBXTRK" + ref.slice(4) : undefined,
      carrier: stage >= 2 ? "Sandbox Express (simulated)" : undefined,
      events: reached.map((e, i) => ({ status: e.status, description: e.description, location: e.location, occurredAt: at(i) })).filter((_, i) => i >= 2),
    };
  },

  async cancelOrder(_ctx, ref) {
    guard();
    const st = await this.getOrderStatus!(_ctx, ref);
    if (["shipped", "in_transit", "out_for_delivery", "delivered"].includes(st.status)) return { cancelled: false, message: "Already shipped — cannot be cancelled. Use the returns process." };
    await q("UPDATE sandbox_supplier_orders SET cancelled = true WHERE ref = $1", [ref]);
    return { cancelled: true, message: "Cancelled before dispatch." };
  },
};
