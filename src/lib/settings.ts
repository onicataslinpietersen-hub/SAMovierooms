import "server-only";
import { q } from "./db";

/** Admin-editable business settings. Defaults are conservative and contain no invented company details. */
export const DEFAULT_SETTINGS = {
  // Pricing guard-rails
  min_margin_bps: 1500,                 // products below this gross margin cannot be published
  // Payment fee model used for profit ESTIMATES (actual fee is recorded per payment when the gateway reports it)
  payment_fee_bps: 320,
  payment_fee_fixed_cents: 200,
  // Customs
  vat_bps: 1500,                        // SA VAT
  customs_uplift_bps: 1000,             // VAT is levied on (customs value + 10%) + duty for imports from outside SACU
  usd_zar: 0,                           // FX rate for supplier price sync; 0 = not configured
  // Legal entity details shown on site (ECT Act s43). Empty until the business provides them.
  legal_name: "",
  registration_number: "",
  vat_number: "",
  physical_address: "",
  support_email: "",
  support_phone: "",
  information_officer: "",              // POPIA
  returns_window_days: 0,               // 0 = not configured; policy page then only states statutory rights
};
export type Settings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<Settings> {
  const rows = await q<{ key: string; value: unknown }>("SELECT key, value FROM settings");
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  return out as Settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await q("INSERT INTO settings(key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, JSON.stringify(value)]);
}
