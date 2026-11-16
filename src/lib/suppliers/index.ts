import "server-only";
import { q, q1 } from "../db";
import { decryptJson } from "../crypto";
import { getSettings } from "../settings";
import { sandboxAdapter } from "./sandbox";
import { manualAdapter } from "./manual";
import { cjAdapter } from "./cjdropshipping";
import type { SupplierAdapter, SupplierContext } from "./types";

/** Adapter registry. To add a supplier: write one module implementing SupplierAdapter and register it here. */
export const ADAPTERS: Record<string, SupplierAdapter> = {
  [sandboxAdapter.key]: sandboxAdapter,
  [manualAdapter.key]: manualAdapter,
  [cjAdapter.key]: cjAdapter,
};

export const adapterFor = (key: string): SupplierAdapter => ADAPTERS[key] ?? manualAdapter;

export type SupplierRow = {
  id: number; slug: string; name: string; adapter: string; status: string; is_sample: boolean; priority: number; website: string | null;
  verification_notes: string; moq_notes: string; ships_to_za: string; shipping_methods: string; delivery_estimate: string; warranty_terms: string;
  api_availability: string; dropship_support: string; warehouse_country: string; credentials_enc: string | null;
  last_test_at: Date | null; last_test_ok: boolean | null; last_test_message: string | null;
};

export async function supplierContext(s: Pick<SupplierRow, "id" | "slug" | "credentials_enc" | "warehouse_country">): Promise<SupplierContext> {
  const settings = await getSettings();
  return { supplierId: s.id, slug: s.slug, credentials: decryptJson<Record<string, string>>(s.credentials_enc), warehouseCountry: s.warehouse_country, usdZar: settings.usd_zar };
}

export const getSupplier = (id: number) => q1<SupplierRow>("SELECT * FROM suppliers WHERE id = $1", [id]);
export const listSuppliers = () => q<SupplierRow>("SELECT * FROM suppliers ORDER BY priority, name");
