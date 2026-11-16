"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, requireStaff } from "@/lib/auth";
import { loadProducts, slugify } from "@/lib/catalog";
import { publishBlockers } from "@/lib/admin-data";
import { q, q1 } from "@/lib/db";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { applyStatus, orderEvent, processFulfillment, runSync, syncSupplierOffers } from "@/lib/fulfillment";
import { importCatalogItem } from "@/lib/import";
import { parseRands } from "@/lib/money";
import { cancelOrder } from "@/lib/orders";
import { finaliseRefund, requestRefund } from "@/lib/payments";
import { DEFAULT_SETTINGS, getSettings, setSetting, type Settings } from "@/lib/settings";
import { adapterFor, getSupplier, supplierContext } from "@/lib/suppliers";
import { sendEmail } from "@/lib/email";

export type AdminResult = { ok: boolean; message: string } | null;
const done = (path: string) => { revalidatePath(path); revalidatePath("/", "layout"); };
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ───────── Products ─────────
export async function importProduct(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff();
  const supplier = await getSupplier(Number(fd.get("supplierId")));
  if (!supplier) return { ok: false, message: "Unknown supplier." };
  const adapter = adapterFor(supplier.adapter);
  if (!adapter.searchCatalog) return { ok: false, message: "This supplier has no catalogue API." };
  try {
    const items = await adapter.searchCatalog(await supplierContext(supplier), str(fd, "query"));
    const item = items.find((i) => i.ref === str(fd, "ref"));
    if (!item) return { ok: false, message: "That item is no longer in the supplier catalogue." };
    const r = await importCatalogItem(supplier.id, item, supplier.is_sample);
    await audit(u.id, "product.import", { supplier: supplier.slug, ref: item.ref });
    done("/admin/products");
    return { ok: true, message: r.created ? `Imported “${item.name}”. It is hidden until approved and published.` : `“${item.name}” was already imported — supplier offer refreshed.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function setProductStatus(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff();
  const id = str(fd, "id"), to = str(fd, "status");
  if (!["approved", "published", "unpublished", "rejected", "imported"].includes(to)) return { ok: false, message: "Invalid status." };
  if (to === "published") {
    const p = (await loadProducts("all")).find((x) => x.id === id);
    if (!p) return { ok: false, message: "Product not found." };
    const blockers = publishBlockers(p, await getSettings());
    if (blockers.length) return { ok: false, message: "Cannot publish: " + blockers.join(" ") };
  }
  await q("UPDATE products SET status=$2, updated_at=now() WHERE id=$1", [id, to]);
  await audit(u.id, "product.status", { id, to });
  done("/admin/products");
  return { ok: true, message: `Product ${to}.` };
}

export async function saveProduct(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff();
  const id = str(fd, "id");
  let specs: unknown;
  try { specs = JSON.parse(str(fd, "specs") || "{}"); } catch { return { ok: false, message: "Specifications must be valid JSON." }; }
  if (typeof specs !== "object" || specs === null || Array.isArray(specs)) return { ok: false, message: "Specifications must be a JSON object." };
  const images = str(fd, "images").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [url, alt] = l.split("|").map((x) => x.trim()); return { url, alt: alt ?? "" }; });
  if (images.some((i) => !/^https:\/\//.test(i.url))) return { ok: false, message: "Image URLs must start with https://" };
  const video = str(fd, "videoUrl");
  if (video && !/^https:\/\//.test(video)) return { ok: false, message: "Video URL must start with https://" };
  const name = str(fd, "name");
  if (name.length < 3) return { ok: false, message: "Name is too short." };
  const slug = slugify(str(fd, "slug") || name);
  if (await q1("SELECT 1 FROM products WHERE slug=$1 AND id<>$2", [slug, id])) return { ok: false, message: "Another product already uses that URL slug." };
  const date = (k: string) => (str(fd, k) ? new Date(str(fd, k)) : null);
  const int = (k: string) => Math.max(0, Math.round(Number(fd.get(k) || 0)));
  await q(
    `UPDATE products SET name=$2, slug=$3, brand=$4, category_id=$5, short_description=$6, description=$7, kind=$8, specs=$9::jsonb, specs_verified=$10, images=$11::jsonb, video_url=$12,
       warranty=$13, returns_info=$14, weight_g=$15, length_mm=$16, width_mm=$17, height_mm=$18, featured=$19, best_seller=$20, price_override_cents=$21, promo_price_cents=$22, promo_starts=$23, promo_ends=$24,
       seo_title=$25, seo_description=$26, updated_at=now() WHERE id=$1`,
    [id, name, slug, Number(fd.get("categoryId")), str(fd, "shortDescription"), str(fd, "description"), str(fd, "kind") || "projector", JSON.stringify(specs), fd.get("specsVerified") === "on", JSON.stringify(images), video || null,
      str(fd, "warranty"), str(fd, "returnsInfo"), int("weightG"), int("lengthMm"), int("widthMm"), int("heightMm"), fd.get("featured") === "on", fd.get("bestSeller") === "on", parseRands(str(fd, "priceOverride")), parseRands(str(fd, "promoPrice")), date("promoStarts"), date("promoEnds"),
      str(fd, "seoTitle") || null, str(fd, "seoDescription") || null]);
  await audit(u.id, "product.save", { id });
  // A published product that no longer passes the guards is pulled immediately.
  const p = (await loadProducts("all")).find((x) => x.id === id);
  if (p?.status === "published") {
    const blockers = publishBlockers(p, await getSettings());
    if (blockers.length) {
      await q("UPDATE products SET status='unpublished' WHERE id=$1", [id]);
      done("/admin/products");
      return { ok: false, message: "Saved, but the product was UNPUBLISHED because it no longer meets the publishing rules: " + blockers.join(" ") };
    }
  }
  done("/admin/products");
  return { ok: true, message: "Product saved." };
}

// ───────── Orders & fulfilment ─────────
export async function retryFulfillment(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff(["admin", "support"]);
  const id = str(fd, "id");
  await q("UPDATE fulfillments SET next_attempt_at=now(), attempts = LEAST(attempts, 3) WHERE id=$1 AND status IN ('failed','unknown')", [id]);
  const r = await processFulfillment(id);
  await audit(u.id, "fulfilment.retry", { id, result: r });
  done("/admin/orders");
  return { ok: r === "submitted", message: r === "submitted" ? "Supplier confirmed the order." : `Result: ${r}. See the fulfilment error for details.` };
}

/** Manual fallback: an admin placed the order with the supplier themselves and records the supplier's confirmation. */
export async function recordManualFulfillment(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff(["admin", "support"]);
  const id = str(fd, "id"), ref = str(fd, "supplierOrderRef");
  if (ref.length < 3) return { ok: false, message: "Enter the supplier's order reference exactly as the supplier gave it." };
  const f = await q1<{ order_id: string }>("UPDATE fulfillments SET status='submitted', supplier_order_ref=$2, submitted_at=now(), last_error=NULL, next_attempt_at=NULL, updated_at=now() WHERE id=$1 AND status IN ('awaiting_manual','failed','unknown','pending') RETURNING order_id", [id, ref]);
  if (!f) return { ok: false, message: "This fulfilment is not waiting for a manual order." };
  await q("UPDATE orders SET status='processing' WHERE id=$1 AND status='paid'", [f.order_id]);
  await orderEvent(f.order_id, "supplier_submitted", "Order sent to our fulfilment partner");
  await orderEvent(f.order_id, "internal", `Supplier order ${ref} recorded manually by ${u.email}`, true);
  await audit(u.id, "fulfilment.manual", { id, ref });
  done("/admin/orders");
  return { ok: true, message: "Supplier order recorded." };
}

export async function updateTracking(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff(["admin", "support"]);
  const id = str(fd, "id"), status = str(fd, "status"), tracking = str(fd, "trackingNumber");
  if (!["confirmed", "shipped", "in_transit", "out_for_delivery", "delivered"].includes(status)) return { ok: false, message: "Choose a status." };
  const f = await q1<{ supplier_order_ref: string | null }>("SELECT supplier_order_ref FROM fulfillments WHERE id=$1", [id]);
  if (!f?.supplier_order_ref) return { ok: false, message: "Record the supplier's order reference first." };
  if (["shipped", "in_transit", "out_for_delivery"].includes(status) && !tracking && !(await q1("SELECT 1 FROM fulfillments WHERE id=$1 AND tracking_number IS NOT NULL", [id]))) return { ok: false, message: "A tracking number is required to mark a shipment as shipped." };
  const note = str(fd, "note") || { confirmed: "Order confirmed by supplier", shipped: "Parcel handed to carrier", in_transit: "In transit", out_for_delivery: "Out for delivery", delivered: "Delivered" }[status]!;
  await applyStatus(id, { status, trackingNumber: tracking || undefined, carrier: str(fd, "carrier") || undefined, trackingUrl: /^https:\/\//.test(str(fd, "trackingUrl")) ? str(fd, "trackingUrl") : undefined, events: [{ status, description: note, occurredAt: new Date() }] }, "admin");
  await audit(u.id, "fulfilment.tracking", { id, status });
  done("/admin/orders");
  return { ok: true, message: "Tracking updated and customer notified where applicable." };
}

export async function adminCancelOrder(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff();
  const r = await cancelOrder(str(fd, "id"), u.id, str(fd, "reason") || "Cancelled by admin");
  await audit(u.id, "order.cancel", { id: str(fd, "id"), result: r.message });
  done("/admin/orders");
  return r;
}

export async function adminRefund(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff();
  const cents = parseRands(str(fd, "amount"));
  if (!cents) return { ok: false, message: "Enter a refund amount." };
  const r = await requestRefund(str(fd, "id"), cents, str(fd, "reason"), u.id);
  await audit(u.id, "order.refund", { id: str(fd, "id"), cents });
  done("/admin/orders");
  return r;
}

export async function markRefundProcessed(fd: FormData) {
  const u = await requireStaff();
  await finaliseRefund(str(fd, "refundId"));
  await audit(u.id, "refund.processed", { id: str(fd, "refundId") });
  done("/admin/orders");
}

export async function resolveAlert(fd: FormData) {
  await requireStaff(["admin", "support"]);
  await q("UPDATE alerts SET resolved_at=now() WHERE id=$1", [fd.get("id")]);
  done("/admin");
}

export async function runSyncNow(_: AdminResult): Promise<AdminResult> {
  const u = await requireStaff();
  const r = await runSync();
  await audit(u.id, "sync.run", r);
  done("/admin");
  return { ok: true, message: `Sync complete — ${r.submitted}/${r.attempted} fulfilments submitted, ${r.tracked} shipments checked, ${r.offersUpdated} supplier offers updated.` };
}

// ───────── Suppliers ─────────
export async function saveSupplier(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff();
  const id = Number(fd.get("id"));
  const s = await getSupplier(id);
  if (!s) return { ok: false, message: "Supplier not found." };
  const status = str(fd, "status");
  if (!["research", "pending_verification", "approved", "suspended"].includes(status)) return { ok: false, message: "Invalid status." };
  if (status === "approved" && s.status !== "approved" && fd.get("confirmVerified") !== "on") return { ok: false, message: "To approve a supplier, tick the confirmation that a sample was tested and South African shipping quotes were obtained." };
  const adapter = adapterFor(s.adapter);
  const existing = decryptJson<Record<string, string>>(s.credentials_enc) ?? {};
  const creds: Record<string, string> = { ...existing };
  for (const f of adapter.credentialFields) { const v = str(fd, `cred_${f.key}`); if (v) creds[f.key] = v; }
  const ships = ["yes", "no", "unknown"].includes(str(fd, "shipsToZa")) ? str(fd, "shipsToZa") : "unknown";
  await q(
    `UPDATE suppliers SET name=$2, status=$3, priority=$4, website=$5, verification_notes=$6, moq_notes=$7, ships_to_za=$8, shipping_methods=$9, delivery_estimate=$10, warranty_terms=$11, api_availability=$12, dropship_support=$13, warehouse_country=$14, credentials_enc=$15 WHERE id=$1`,
    [id, str(fd, "name") || s.name, status, Number(fd.get("priority") || 100), str(fd, "website") || null, str(fd, "verificationNotes"), str(fd, "moqNotes"), ships, str(fd, "shippingMethods"), str(fd, "deliveryEstimate"), str(fd, "warrantyTerms"), str(fd, "apiAvailability"), str(fd, "dropshipSupport"), (str(fd, "warehouseCountry") || "CN").toUpperCase().slice(0, 2), Object.keys(creds).length ? encryptJson(creds) : null]);
  await audit(u.id, "supplier.save", { id, status });
  done("/admin/suppliers");
  return { ok: true, message: "Supplier saved." };
}

export async function addSupplier(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff();
  const name = str(fd, "name"), adapter = str(fd, "adapter") || "manual";
  if (name.length < 2) return { ok: false, message: "Enter a supplier name." };
  const slug = slugify(name);
  if (await q1("SELECT 1 FROM suppliers WHERE slug=$1", [slug])) return { ok: false, message: "A supplier with that name already exists." };
  const row = await q1<{ id: number }>("INSERT INTO suppliers(slug, name, adapter, status) VALUES ($1,$2,$3,'research') RETURNING id", [slug, name, adapter]);
  await audit(u.id, "supplier.add", { slug });
  redirect(`/admin/suppliers/${row!.id}`);
}

export async function testSupplier(_: AdminResult, fd: FormData): Promise<AdminResult> {
  await requireStaff();
  const s = await getSupplier(Number(fd.get("id")));
  if (!s) return { ok: false, message: "Supplier not found." };
  let r: { ok: boolean; message: string };
  try { r = await adapterFor(s.adapter).testConnection(await supplierContext(s)); } catch (e) { r = { ok: false, message: (e as Error).message }; }
  await q("UPDATE suppliers SET last_test_at=now(), last_test_ok=$2, last_test_message=$3 WHERE id=$1", [s.id, r.ok, r.message]);
  done("/admin/suppliers");
  return r;
}

export async function syncSupplier(_: AdminResult, fd: FormData): Promise<AdminResult> {
  await requireStaff();
  try {
    const r = await syncSupplierOffers(Number(fd.get("id")));
    done("/admin/suppliers");
    return { ok: true, message: `${r.updated} offer(s) changed.${r.unpublished.length ? ` Unpublished for low margin: ${r.unpublished.join(", ")}.` : ""}` };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

// ───────── Pricing ─────────
export async function savePricingRule(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff();
  const scope = str(fd, "scope"), kind = str(fd, "kind");
  if (!["global", "category", "product"].includes(scope) || !["percent", "fixed"].includes(kind)) return { ok: false, message: "Invalid rule." };
  const raw = Number(fd.get("value"));
  if (!Number.isFinite(raw) || raw < 0) return { ok: false, message: "Enter a positive markup." };
  const value = kind === "percent" ? Math.round(raw * 100) : Math.round(raw * 100);
  const categoryId = scope === "category" ? Number(fd.get("categoryId")) : null, productId = scope === "product" ? str(fd, "productId") : null;
  if (scope === "global") await q("DELETE FROM pricing_rules WHERE scope='global'");
  if (scope === "category") await q("DELETE FROM pricing_rules WHERE scope='category' AND category_id=$1", [categoryId]);
  if (scope === "product") await q("DELETE FROM pricing_rules WHERE scope='product' AND product_id=$1", [productId]);
  await q("INSERT INTO pricing_rules(scope, category_id, product_id, kind, value) VALUES ($1,$2,$3,$4,$5)", [scope, categoryId, productId, kind, value]);
  await audit(u.id, "pricing.rule", { scope, kind, value });
  const { enforceMargins } = await import("@/lib/fulfillment");
  const pulled = await enforceMargins();
  done("/admin/pricing");
  return { ok: true, message: `Rule saved.${pulled.length ? ` Unpublished for falling below the minimum margin: ${pulled.join(", ")}.` : ""}` };
}

export async function deletePricingRule(fd: FormData) {
  await requireStaff();
  await q("DELETE FROM pricing_rules WHERE id=$1 AND scope <> 'global'", [fd.get("id")]);
  done("/admin/pricing");
}

export async function saveDiscount(_: AdminResult, fd: FormData): Promise<AdminResult> {
  await requireStaff();
  const code = str(fd, "code").toUpperCase().replace(/[^A-Z0-9-]/g, ""), kind = str(fd, "kind"), raw = Number(fd.get("value"));
  if (code.length < 3 || !["percent", "fixed"].includes(kind) || !(raw > 0)) return { ok: false, message: "Enter a code (3+ characters) and a value." };
  if (kind === "percent" && raw > 90) return { ok: false, message: "Percentage discounts are capped at 90%." };
  await q(`INSERT INTO discounts(code, kind, value, min_subtotal_cents, max_uses, ends_at) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (code) DO UPDATE SET kind=EXCLUDED.kind, value=EXCLUDED.value, min_subtotal_cents=EXCLUDED.min_subtotal_cents, max_uses=EXCLUDED.max_uses, ends_at=EXCLUDED.ends_at, active=true`,
    [code, kind, Math.round(raw * 100), parseRands(str(fd, "minSubtotal")) ?? 0, fd.get("maxUses") ? Number(fd.get("maxUses")) : null, str(fd, "endsAt") ? new Date(str(fd, "endsAt") + "T23:59:59") : null]);
  done("/admin/pricing");
  return { ok: true, message: `Discount ${code} saved.` };
}

export async function toggleDiscount(fd: FormData) {
  await requireStaff();
  await q("UPDATE discounts SET active = NOT active WHERE id=$1", [fd.get("id")]);
  done("/admin/pricing");
}

export async function saveBundle(_: AdminResult, fd: FormData): Promise<AdminResult> {
  await requireStaff();
  const ids = fd.getAll("productIds").map(String).filter((x) => z.string().uuid().safeParse(x).success), pct = Number(fd.get("percent"));
  if (ids.length < 2) return { ok: false, message: "Choose at least two products for a bundle." };
  if (!(pct > 0 && pct <= 50)) return { ok: false, message: "Bundle discount must be between 0 and 50%." };
  await q("INSERT INTO bundles(name, percent_off_bps, product_ids) VALUES ($1,$2,$3::uuid[])", [str(fd, "name") || "Bundle", Math.round(pct * 100), ids]);
  done("/admin/pricing");
  return { ok: true, message: "Bundle saved." };
}

export async function deleteBundle(fd: FormData) {
  await requireStaff();
  await q("DELETE FROM bundles WHERE id=$1", [fd.get("id")]);
  done("/admin/pricing");
}

// ───────── Settings, categories, support ─────────
export async function saveSettings(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff();
  const text: (keyof Settings)[] = ["legal_name", "registration_number", "vat_number", "physical_address", "support_email", "support_phone", "information_officer"];
  for (const k of text) if (fd.has(k)) await setSetting(k, str(fd, k) as never);
  const pct: (keyof Settings)[] = ["min_margin_bps", "payment_fee_bps", "vat_bps", "customs_uplift_bps"];
  for (const k of pct) if (fd.has(k)) { const v = Number(fd.get(k)); if (Number.isFinite(v) && v >= 0 && v <= 100) await setSetting(k, Math.round(v * 100) as never); }
  if (fd.has("payment_fee_fixed_cents")) await setSetting("payment_fee_fixed_cents", (parseRands(str(fd, "payment_fee_fixed_cents")) ?? DEFAULT_SETTINGS.payment_fee_fixed_cents) as never);
  if (fd.has("usd_zar")) await setSetting("usd_zar", (Number(fd.get("usd_zar")) || 0) as never);
  if (fd.has("returns_window_days")) await setSetting("returns_window_days", Math.max(0, Math.round(Number(fd.get("returns_window_days")) || 0)) as never);
  await audit(u.id, "settings.save", {});
  const { enforceMargins } = await import("@/lib/fulfillment");
  const pulled = await enforceMargins();
  done("/admin/settings");
  return { ok: true, message: `Settings saved.${pulled.length ? ` Unpublished for falling below the minimum margin: ${pulled.join(", ")}.` : ""}` };
}

export async function saveCategoryCustoms(_: AdminResult, fd: FormData): Promise<AdminResult> {
  await requireStaff();
  const rate = Number(fd.get("dutyRate"));
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { ok: false, message: "Duty rate must be between 0 and 100%." };
  await q("UPDATE categories SET tariff_heading=$2, duty_rate_bps=$3, duty_verified=$4 WHERE id=$1", [Number(fd.get("id")), str(fd, "tariffHeading") || null, Math.round(rate * 100), fd.get("verified") === "on"]);
  done("/admin/settings");
  return { ok: true, message: "Customs settings saved." };
}

export async function replyTicket(_: AdminResult, fd: FormData): Promise<AdminResult> {
  const u = await requireStaff(["admin", "support"]);
  const reply = str(fd, "reply");
  if (reply.length < 2) return { ok: false, message: "Write a reply first." };
  const t = await q1<{ email: string; subject: string; name: string }>("UPDATE support_tickets SET admin_reply=$2, status='answered', updated_at=now() WHERE id=$1 RETURNING email, subject, name", [str(fd, "id"), reply]);
  if (!t) return { ok: false, message: "Ticket not found." };
  await sendEmail(t.email, `Re: ${t.subject}`, `Hi ${t.name || "there"},\n\n${reply}\n\n— SAMovierooms Support`);
  await audit(u.id, "ticket.reply", { id: str(fd, "id") });
  done("/admin/support");
  return { ok: true, message: "Reply sent." };
}

export async function moderateReview(fd: FormData) {
  await requireStaff(["admin", "support"]);
  const status = str(fd, "status");
  if (["approved", "rejected"].includes(status)) await q("UPDATE reviews SET status=$2 WHERE id=$1", [fd.get("id"), status]);
  done("/admin/support");
}
