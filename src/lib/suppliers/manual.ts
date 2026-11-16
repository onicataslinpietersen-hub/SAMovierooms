import "server-only";
import type { SupplierAdapter } from "./types";

/**
 * MANUAL supplier — for suppliers with no usable ordering API (e.g. an Alibaba.com manufacturer you order from
 * through Trade Assurance / chat / email). Orders land in the admin "Awaiting manual fulfilment" queue; an admin places
 * the order with the supplier and records the supplier's order reference and tracking number by hand.
 * The storefront never shows such an order as submitted until an admin has recorded the supplier's confirmation.
 *
 * Shipping options come from the rate card saved with the supplier (credentials JSON: `rate_card`), because there is
 * no API to quote from. Without a rate card the supplier's products cannot be checked out.
 */
type Rate = { code: string; label: string; carrier: string; incoterm: "DDP" | "DAP"; base_rands: number; per_kg_rands: number; min_days: number; max_days: number };

export const manualAdapter: SupplierAdapter = {
  key: "manual",
  label: "Manual fulfilment (no API)",
  capabilities: { catalog: false, stockSync: false, priceSync: false, orders: false, tracking: false, cancel: false },
  credentialFields: [{ key: "rate_card", label: "Shipping rate card (JSON array: code, label, carrier, incoterm, base_rands, per_kg_rands, min_days, max_days)" }, { key: "contact", label: "Supplier contact (email / chat handle)" }],
  notes: "No automation. Admin places each order with the supplier and enters the confirmation + tracking.",
  async testConnection(ctx) {
    try {
      const rates = JSON.parse(ctx.credentials?.rate_card || "[]") as Rate[];
      return rates.length ? { ok: true, message: `Manual supplier with ${rates.length} quoted shipping rate(s).` } : { ok: false, message: "No shipping rate card saved — get real quotes to South Africa from this supplier and enter them." };
    } catch {
      return { ok: false, message: "Rate card is not valid JSON." };
    }
  },
  async getShippingOptions(ctx, req) {
    const { chargeableKg, LAST_MILE_DAYS, zoneFor } = await import("../shipping");
    let rates: Rate[] = [];
    try { rates = JSON.parse(ctx.credentials?.rate_card || "[]"); } catch { /* no rates */ }
    const kg = chargeableKg(req.parcels);
    const lm = LAST_MILE_DAYS[zoneFor(req.destination.province)];
    return rates.map((r) => {
      const cost = Math.round((r.base_rands + r.per_kg_rands * kg) * 100);
      return { code: r.code, label: r.label, carrier: r.carrier, incoterm: r.incoterm, costCents: cost, priceCents: Math.ceil(cost / 1000) * 1000, minDays: r.min_days + lm[0], maxDays: r.max_days + lm[1], breakdown: { handling: [0, 0], transit: [r.min_days, r.max_days], customs: [0, 0], lastMile: lm } };
    });
  },
};
