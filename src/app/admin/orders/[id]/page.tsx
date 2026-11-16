import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Card, Field, PageHead, Scroll, dt } from "@/components/admin/ui";
import { StatusChip } from "@/components/OrderList";
import { adminCancelOrder, adminRefund, markRefundProcessed, recordManualFulfillment, retryFulfillment, updateTracking } from "@/app/actions/admin";
import { requireStaff } from "@/lib/auth";
import { zar } from "@/lib/money";
import { getOrderBundle } from "@/lib/orders";
import { adapterFor } from "@/lib/suppliers";

export const metadata = { title: "Order" };

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireStaff(["admin", "support"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const b = await getOrderBundle({ id });
  if (!b) notFound();
  const { order: o, items, fulfillments, events, tracking, payments, refunds } = b;
  const admin = u.role === "admin";
  const profit = o.total_cents - o.refunded_cents - o.cost_cents - o.shipping_cost_cents - o.import_cost_cents - o.payment_fee_cents;
  const refundable = o.total_cents - o.refunded_cents;
  return (
    <>
      <PageHead title={`Order ${o.number}`} sub={`Placed ${dt(o.created_at)}${o.paid_at ? ` · paid ${dt(o.paid_at)}` : ""}`}>
        <StatusChip status={o.status} />
        <Link href={`/order/${o.number}?t=${o.access_token}`} target="_blank" className="btn-ghost btn-sm">Customer view</Link>
        <Link href="/admin/orders" className="btn-ghost btn-sm">Back</Link>
      </PageHead>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {fulfillments.map((f, i) => {
            const adapter = adapterFor(f.adapter);
            const its = items.filter((x) => x.fulfillment_id === f.id);
            const stuck = ["awaiting_manual", "failed", "unknown", "pending"].includes(f.status) && !!o.paid_at;
            return (
              <Card key={f.id} title={`Fulfilment ${i + 1} — ${f.supplier_name}`}>
                <div className="flex flex-wrap items-center gap-3 text-sm"><StatusChip status={f.status} /><span className="text-ash">{adapter.label}</span><span className="text-ash">· {f.shipping_method} ({f.incoterm}) · est. {f.eta_min_days}–{f.eta_max_days} business days</span></div>
                <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-ash">Our reference (idempotency key)</dt><dd className="font-mono">{f.idempotency_key}</dd></div>
                  <div><dt className="text-xs text-ash">Supplier order reference</dt><dd className="font-mono">{f.supplier_order_ref ?? <span className="text-amber">not confirmed by supplier</span>}</dd></div>
                  <div><dt className="text-xs text-ash">Tracking number</dt><dd className="font-mono">{f.tracking_number ?? "—"}</dd></div>
                  <div><dt className="text-xs text-ash">Attempts / next retry</dt><dd>{f.attempts} · {f.next_attempt_at ? dt(f.next_attempt_at) : "none scheduled"}</dd></div>
                  <div><dt className="text-xs text-ash">Submitted / shipped / delivered</dt><dd>{dt(f.submitted_at)} / {dt(f.shipped_at)} / {dt(f.delivered_at)}</dd></div>
                  {admin ? <div><dt className="text-xs text-ash">Shipping charged / cost · duties est.</dt><dd>{zar(f.shipping_cents)} / {zar(f.shipping_cost_cents)} · {zar(f.duties_estimate_cents)}</dd></div> : null}
                </dl>
                {f.last_error ? <p className="mt-4 rounded-lg bg-bad/10 p-3 text-xs leading-relaxed text-bad"><strong>Last error:</strong> {f.last_error}</p> : null}
                <Scroll><table className="table-admin mt-4"><thead><tr><th>Item</th><th>SKU</th><th>Supplier ref</th><th>Qty</th><th className="text-right">Price</th>{admin ? <th className="text-right">Cost</th> : null}</tr></thead>
                  <tbody>{its.map((it) => <tr key={it.id}><td>{it.name}{it.variant_name !== "Standard" ? ` — ${it.variant_name}` : ""}</td><td className="font-mono text-xs">{it.sku}</td><td className="font-mono text-xs">{(it as unknown as { supplier_ref: string }).supplier_ref}</td><td>{it.quantity}</td><td className="text-right tabular-nums">{zar(it.unit_price_cents)}</td>{admin ? <td className="text-right tabular-nums">{zar(it.unit_cost_cents)}</td> : null}</tr>)}</tbody></table></Scroll>

                {o.paid_at && !["cancelled", "delivered"].includes(f.status) ? (
                  <div className="mt-5 grid gap-5 border-t border-white/[0.07] pt-5 lg:grid-cols-2">
                    {stuck ? (
                      <div>
                        <p className="text-sm font-semibold">{f.status === "awaiting_manual" ? "Manual fulfilment" : "Resolve fulfilment"}</p>
                        <p className="mt-1 text-xs leading-relaxed text-ash">{f.status === "unknown" ? "The supplier did not answer in time. Check with the supplier whether the order exists BEFORE ordering again — otherwise the customer may receive two parcels." : "Place this order with the supplier yourself, then enter the reference the supplier gives you. The customer is only told the order was sent once you record it."}</p>
                        <ActionForm action={recordManualFulfillment} className="mt-3 flex items-end gap-2" inline><input type="hidden" name="id" value={f.id} /><div className="flex-1"><Field label="Supplier's order reference" name="supplierOrderRef" required /></div><button className="btn-primary btn-sm mb-0.5">Record</button></ActionForm>
                        {adapter.capabilities.orders && ["failed", "unknown"].includes(f.status) ? <ActionForm action={retryFulfillment} className="mt-3"><input type="hidden" name="id" value={f.id} /><button className="btn-ghost btn-sm">Retry via API (reconciles first)</button></ActionForm> : null}
                      </div>
                    ) : null}
                    {f.supplier_order_ref ? (
                      <ActionForm action={updateTracking} className="space-y-3">
                        <input type="hidden" name="id" value={f.id} />
                        <p className="text-sm font-semibold">Update status / tracking manually</p>
                        <p className="text-xs text-ash">{adapter.capabilities.tracking ? "Normally synced automatically from the supplier. Use only to correct it." : "This supplier has no tracking API — enter what the supplier or carrier tells you."}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="label" htmlFor={`st-${f.id}`}>Status</label><select id={`st-${f.id}`} name="status" className="field" defaultValue=""><option value="" disabled>Choose…</option><option value="confirmed">Confirmed by supplier</option><option value="shipped">Shipped</option><option value="in_transit">In transit</option><option value="out_for_delivery">Out for delivery</option><option value="delivered">Delivered</option></select></div>
                          <Field label="Tracking number" name="trackingNumber" defaultValue={f.tracking_number} />
                          <Field label="Carrier" name="carrier" defaultValue={f.shipping_carrier} />
                          <Field label="Carrier tracking URL" name="trackingUrl" defaultValue={f.tracking_url} placeholder="https://…" />
                        </div>
                        <Field label="Note shown to customer (optional)" name="note" />
                        <button className="btn-ghost btn-sm">Save tracking</button>
                      </ActionForm>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
          <Card title="Order history">
            <ol className="space-y-3 border-l border-white/12 pl-5">
              {[...events.map((e) => ({ at: e.created_at, text: e.message, tag: e.internal ? "internal" : "customer-visible" })), ...tracking.map((t) => ({ at: t.occurred_at, text: `${t.description}${t.location ? ` — ${t.location}` : ""}`, tag: `tracking · ${t.source}` }))].sort((a, b) => +a.at - +b.at).map((e, i) => (
                <li key={i} className="relative text-sm"><span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-smoke" /><p>{e.text}</p><p className="text-xs text-dim">{dt(e.at)} · {e.tag}</p></li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <p className="text-sm">{o.ship_recipient}<br /><a className="link" href={`mailto:${o.email}`}>{o.email}</a><br />{o.ship_phone}</p>
            <address className="mt-3 text-sm not-italic leading-relaxed text-sand">{o.ship_line1}{o.ship_line2 ? <><br />{o.ship_line2}</> : null}{o.ship_suburb ? <><br />{o.ship_suburb}</> : null}<br />{o.ship_city}, {o.ship_province} {o.ship_postal_code}</address>
          </Card>
          <Card title="Payment">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ash">Subtotal</dt><dd>{zar(o.subtotal_cents)}</dd></div>
              <div className="flex justify-between"><dt className="text-ash">Discount{o.discount_code ? ` (${o.discount_code})` : ""}</dt><dd>−{zar(o.discount_cents)}</dd></div>
              <div className="flex justify-between"><dt className="text-ash">Shipping charged</dt><dd>{zar(o.shipping_cents)}</dd></div>
              <div className="flex justify-between"><dt className="text-ash">Duties collected (DDP)</dt><dd>{zar(o.duties_collected_cents)}</dd></div>
              <div className="flex justify-between border-t border-white/[0.08] pt-2 font-semibold"><dt>Total</dt><dd>{zar(o.total_cents, { decimals: true })}</dd></div>
            </dl>
            <ul className="mt-4 space-y-1 text-xs text-ash">{payments.map((p) => <li key={p.id}>{dt(p.created_at)} · {p.provider} · <span className={p.status === "succeeded" ? "text-ok" : p.status === "initiated" ? "" : "text-bad"}>{p.status}</span>{p.provider_ref ? ` · ${p.provider_ref}` : ""}</li>)}</ul>
          </Card>
          {admin ? (
            <Card title="Profit (private)">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ash">Revenue</dt><dd>{zar(o.total_cents)}</dd></div>
                <div className="flex justify-between"><dt className="text-ash">Refunded</dt><dd>−{zar(o.refunded_cents)}</dd></div>
                <div className="flex justify-between"><dt className="text-ash">Supplier cost</dt><dd>−{zar(o.cost_cents)}</dd></div>
                <div className="flex justify-between"><dt className="text-ash">Shipping cost</dt><dd>−{zar(o.shipping_cost_cents)}</dd></div>
                <div className="flex justify-between"><dt className="text-ash">Import costs paid by us (DDP)</dt><dd>−{zar(o.import_cost_cents)}</dd></div>
                <div className="flex justify-between"><dt className="text-ash">Payment fee{payments.some((p) => p.fee_cents) ? "" : " (estimate)"}</dt><dd>−{zar(o.payment_fee_cents)}</dd></div>
                <div className={`flex justify-between border-t border-white/[0.08] pt-2 font-semibold ${profit < 0 ? "text-bad" : "text-ok"}`}><dt>Estimated gross profit</dt><dd>{zar(profit)}</dd></div>
              </dl>
            </Card>
          ) : null}
          {admin ? (
            <Card title="Cancel & refund">
              {refunds.length ? <ul className="mb-4 space-y-2 text-sm">{refunds.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.03] p-3"><span>{zar(r.amount_cents, { decimals: true })} · <span className={r.status === "processed" ? "text-ok" : "text-amber"}>{r.status}</span><span className="block text-xs text-ash">{r.reason}</span></span>{r.status === "requested" ? <form action={markRefundProcessed}><input type="hidden" name="refundId" value={r.id} /><button className="btn-ghost btn-sm">Mark processed in gateway</button></form> : null}</li>)}</ul> : null}
              {!["cancelled", "refunded", "delivered"].includes(o.status) ? (
                <ActionForm action={adminCancelOrder} confirm={`Cancel order ${o.number}? Paid orders are cancelled at the supplier where possible and refunded.`}>
                  <input type="hidden" name="id" value={o.id} /><Field label="Cancellation reason" name="reason" required /><button className="btn-ghost btn-sm mt-3 !border-bad/50 !text-bad">Cancel order</button>
                </ActionForm>
              ) : null}
              {o.paid_at && refundable > 0 ? (
                <ActionForm action={adminRefund} className="mt-5 border-t border-white/[0.07] pt-5" confirm="Issue this refund?">
                  <input type="hidden" name="id" value={o.id} />
                  <div className="grid grid-cols-2 gap-3"><Field label={`Refund amount (max ${zar(refundable, { decimals: true })})`} name="amount" inputMode="decimal" defaultValue={(refundable / 100).toFixed(2)} required /><Field label="Reason" name="reason" required /></div>
                  <button className="btn-ghost btn-sm mt-3">Refund</button>
                </ActionForm>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
