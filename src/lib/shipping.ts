/**
 * South African delivery + import-cost estimates (pure functions — unit tested).
 * Everything here is an ESTIMATE; nothing is presented to customers as a guaranteed date.
 */
export const PROVINCES = [
  { code: "GP", name: "Gauteng", zone: "main" },
  { code: "WC", name: "Western Cape", zone: "main" },
  { code: "KZN", name: "KwaZulu-Natal", zone: "main" },
  { code: "EC", name: "Eastern Cape", zone: "regional" },
  { code: "FS", name: "Free State", zone: "regional" },
  { code: "MP", name: "Mpumalanga", zone: "regional" },
  { code: "NW", name: "North West", zone: "regional" },
  { code: "LP", name: "Limpopo", zone: "outlying" },
  { code: "NC", name: "Northern Cape", zone: "outlying" },
] as const;
export type ProvinceCode = (typeof PROVINCES)[number]["code"];
export type Zone = "main" | "regional" | "outlying";

export const zoneFor = (province: string): Zone => PROVINCES.find((p) => p.code === province)?.zone ?? "regional";

/** Extra last-mile business days once a parcel has cleared customs at the port of entry. */
export const LAST_MILE_DAYS: Record<Zone, [number, number]> = { main: [1, 2], regional: [2, 4], outlying: [3, 6] };

export type Parcel = { weightG: number; lengthMm: number; widthMm: number; heightMm: number; quantity: number };

/** Couriers bill on the greater of actual and volumetric weight (L×W×H cm / 5000). */
export function chargeableKg(parcels: Parcel[]): number {
  let total = 0;
  for (const p of parcels) {
    const actual = p.weightG / 1000;
    const vol = ((p.lengthMm / 10) * (p.widthMm / 10) * (p.heightMm / 10)) / 5000;
    total += Math.max(actual, vol) * p.quantity;
  }
  return Math.max(0.5, Math.ceil(total * 2) / 2);
}

export type ShippingOption = {
  code: string;
  label: string;
  carrier: string;
  /** DDP: duties & VAT prepaid by the seller. DAP: recipient pays duties & VAT to the carrier before delivery. */
  incoterm: "DDP" | "DAP";
  priceCents: number;        // charged to the customer
  costCents: number;         // paid by the business to the supplier/carrier — internal only
  minDays: number;           // business days, door to door, including customs + last mile
  maxDays: number;
  breakdown: { handling: [number, number]; transit: [number, number]; customs: [number, number]; lastMile: [number, number] };
  isSample?: boolean;        // true when the rate comes from the sandbox supplier rather than a live quote
};

export type PublicShippingOption = Omit<ShippingOption, "costCents">;
export const toPublicOption = ({ costCents: _c, ...rest }: ShippingOption): PublicShippingOption => rest;

export type ImportEstimate = {
  customsValueCents: number;
  dutyCents: number;
  vatCents: number;
  totalCents: number;
  dutyRateKnown: boolean;    // false when any line's category duty rate has not been verified by the admin
};

/**
 * SA import VAT = 15% × (customs value × 1.10 + duty) for goods from outside the customs union.
 * Duty = customs value × the tariff rate for the item's heading. Rates are maintained per category by the admin.
 */
export function estimateImportCosts(
  lines: { valueCents: number; quantity: number; dutyRateBps: number; dutyVerified: boolean }[],
  cfg: { vat_bps: number; customs_uplift_bps: number },
): ImportEstimate {
  let value = 0, duty = 0, known = true;
  for (const l of lines) {
    const v = l.valueCents * l.quantity;
    value += v;
    duty += Math.round((v * l.dutyRateBps) / 10000);
    if (!l.dutyVerified) known = false;
  }
  const vatBase = Math.round(value * (1 + cfg.customs_uplift_bps / 10000)) + duty;
  const vat = Math.round((vatBase * cfg.vat_bps) / 10000);
  return { customsValueCents: value, dutyCents: duty, vatCents: vat, totalCents: duty + vat, dutyRateKnown: known };
}

export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export function deliveryWindow(opt: { minDays: number; maxDays: number }, from = new Date()): { from: Date; to: Date; label: string } {
  const a = addBusinessDays(from, opt.minDays), b = addBusinessDays(from, opt.maxDays);
  const f = (d: Date) => d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  return { from: a, to: b, label: `${f(a)} – ${f(b)}` };
}
