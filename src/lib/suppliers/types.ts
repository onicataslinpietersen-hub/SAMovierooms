import type { Parcel, ShippingOption } from "../shipping";
import type { Specs } from "../specs";

export type SupplierContext = {
  supplierId: number;
  slug: string;
  credentials: Record<string, string> | null;
  warehouseCountry: string;
  usdZar: number;
};

export type CatalogItem = {
  ref: string;
  name: string;
  brand: string;
  categorySlug: string;       // suggested SAMovierooms category
  kind: string;
  shortDescription: string;
  description: string;
  specs: Specs;
  images: { url: string; alt: string }[];
  warranty: string;
  weightG: number; lengthMm: number; widthMm: number; heightMm: number;
  variants: { ref: string; name: string; finishHex?: string; costCents: number; sourceCurrency: string; sourceAmount: number; stock: number; moq: number }[];
};

export type Offer = { ref: string; costCents: number | null; sourceCurrency: string; sourceAmount: number | null; stock: number | null };

export type Destination = { recipient: string; phone: string; line1: string; line2?: string | null; suburb?: string | null; city: string; province: string; postalCode: string; country: string; email: string };

export type ShippingRequest = { destination: Pick<Destination, "province" | "postalCode" | "country" | "city">; parcels: Parcel[]; items: { ref: string; quantity: number }[] };

export type SubmitOrderRequest = {
  idempotencyKey: string;     // also sent to the supplier as our order number so the order can be found again
  destination: Destination;
  shippingCode: string;
  items: { ref: string; sku: string; name: string; quantity: number }[];
};

export type SupplierOrderStatus = {
  status: "submitted" | "confirmed" | "shipped" | "in_transit" | "out_for_delivery" | "delivered" | "cancelled" | "failed";
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  events: { status: string; description: string; location?: string; occurredAt: Date }[];
};

/**
 * `ambiguous` = we do not know whether the supplier created the order (timeout / dropped connection).
 * The engine must reconcile via findOrder() before it is allowed to submit again.
 */
export class SupplierError extends Error {
  constructor(message: string, public opts: { retryable: boolean; ambiguous?: boolean } = { retryable: true }) {
    super(message);
  }
}

export interface SupplierAdapter {
  key: string;
  label: string;
  /** What this integration can do automatically. Anything false falls back to the manual admin workflow. */
  capabilities: { catalog: boolean; stockSync: boolean; priceSync: boolean; orders: boolean; tracking: boolean; cancel: boolean };
  credentialFields: { key: string; label: string; secret?: boolean }[];
  notes: string;
  testConnection(ctx: SupplierContext): Promise<{ ok: boolean; message: string }>;
  searchCatalog?(ctx: SupplierContext, query: string): Promise<CatalogItem[]>;
  getOffers?(ctx: SupplierContext, refs: string[]): Promise<Offer[]>;
  getShippingOptions(ctx: SupplierContext, req: ShippingRequest): Promise<ShippingOption[]>;
  submitOrder?(ctx: SupplierContext, req: SubmitOrderRequest): Promise<{ supplierOrderRef: string }>;
  findOrder?(ctx: SupplierContext, idempotencyKey: string): Promise<{ supplierOrderRef: string } | null>;
  getOrderStatus?(ctx: SupplierContext, supplierOrderRef: string): Promise<SupplierOrderStatus>;
  cancelOrder?(ctx: SupplierContext, supplierOrderRef: string): Promise<{ cancelled: boolean; message: string }>;
}

export async function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new SupplierError(`${what} timed out after ${ms} ms`, { retryable: true, ambiguous: true })), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t!);
  }
}
