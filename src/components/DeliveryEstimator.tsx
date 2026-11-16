"use client";
import { useEffect, useState } from "react";
import { PROVINCES, deliveryWindow } from "@/lib/shipping";
import type { ShipmentQuote } from "@/lib/checkout";
import { zar } from "@/lib/money";
import { IconTruck } from "./Icons";

/** Product-page delivery estimate for the visitor's province, quoted live for this exact product. */
export function DeliveryEstimator({ variantId }: { variantId: string }) {
  const [province, setProvince] = useState("");
  const [quote, setQuote] = useState<ShipmentQuote | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => { setProvince(localStorage.getItem("samr-province") ?? ""); }, []);
  useEffect(() => {
    if (!province) return;
    localStorage.setItem("samr-province", province);
    let alive = true;
    setState("loading");
    fetch("/api/shipping/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: [{ variantId, quantity: 1 }], province }) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) { setQuote(d.shipments[0] ?? null); setState("idle"); } })
      .catch(() => alive && setState("error"));
    return () => { alive = false; };
  }, [province, variantId]);

  return (
    <div className="rounded-2xl border border-white/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><IconTruck className="h-5 w-5 text-amber" />Delivery estimate</p>
        <label className="sr-only" htmlFor="est-prov">Your province</label>
        <select id="est-prov" value={province} onChange={(e) => setProvince(e.target.value)} className="field !min-h-10 w-auto !py-0 text-xs">
          <option value="">Choose your province</option>
          {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </div>
      <div className="mt-4 text-sm" aria-live="polite">
        {!province ? <p className="text-ash">Select your province to see delivery methods, costs and estimated dates for this product.</p> : null}
        {state === "loading" ? <p className="text-ash">Getting delivery options…</p> : null}
        {state === "error" ? <p className="text-bad">We could not load delivery options. Please try again.</p> : null}
        {province && state === "idle" && quote ? (
          quote.error ? <p className="text-bad">{quote.error}</p> : (
            <>
              <ul className="space-y-3">
                {quote.options.map((o) => (
                  <li key={o.code} className="flex items-start justify-between gap-4 rounded-xl bg-white/[0.03] p-3">
                    <div>
                      <p className="font-medium">{o.label}</p>
                      <p className="mt-0.5 text-xs text-sand">Estimated {deliveryWindow(o).label} <span className="text-dim">({o.minDays}–{o.maxDays} business days)</span></p>
                      <p className="mt-0.5 text-xs text-ash">{o.incoterm === "DDP" ? `Import duties & VAT prepaid at checkout (est. ${zar(quote.importEstimate.totalCents)})` : `Import duties & VAT payable to the courier before delivery (est. ${zar(quote.importEstimate.totalCents)})`}</p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{zar(o.priceCents)}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-dim">Dates are estimates, not guarantees — customs clearance can add delays.{!quote.importEstimate.dutyRateKnown ? " The import estimate currently covers VAT only; customs duty for this product category has not been confirmed and may apply." : ""}{quote.options.some((o) => o.isSample) ? " Demo store: rates shown are sample figures." : ""}</p>
            </>
          )
        ) : null}
      </div>
    </div>
  );
}
