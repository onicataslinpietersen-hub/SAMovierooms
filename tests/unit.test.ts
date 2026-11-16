import { describe, expect, it } from "vitest";
import { evaluateBundles, evaluateDiscount, profit, resolvePrice, retailRound, type PricingRule } from "../src/lib/pricing";
import { mayClaimCrystalClear4K, powerCompatibility, resolutionClass } from "../src/lib/specs";
import { addBusinessDays, chargeableKg, estimateImportCosts } from "../src/lib/shipping";
import { pfCheckoutFields, pfEncode, pfItnSignature, pfSignature } from "../src/lib/payments/payfast";

const fees = { payment_fee_bps: 300, payment_fee_fixed_cents: 0 };

describe("spec claims", () => {
  it("only a native 3840x2160 panel is native 4K", () => {
    expect(resolutionClass({ native_resolution: "3840x2160" })).toBe("native_4k");
    expect(resolutionClass({ native_resolution: "1920x1080", max_input_resolution: "3840x2160" })).toBe("4k_supported");
    expect(resolutionClass({ native_resolution: "1920 × 1080" })).toBe("full_hd");
    expect(resolutionClass({ max_input_resolution: "3840x2160" })).toBe("unknown");
  });
  it("Crystal-Clear 4K needs native 4K AND verified specs", () => {
    expect(mayClaimCrystalClear4K({ native_resolution: "3840x2160" }, true)).toBe(true);
    expect(mayClaimCrystalClear4K({ native_resolution: "3840x2160" }, false)).toBe(false);
    expect(mayClaimCrystalClear4K({ native_resolution: "1920x1080", max_input_resolution: "3840x2160" }, true)).toBe(false);
  });
  it("flags products that cannot run on 230 V", () => {
    expect(powerCompatibility({ input_voltage: "100–240 V AC, 50/60 Hz" }).ok).toBe(true);
    expect(powerCompatibility({ input_voltage: "110–120 V AC" }).ok).toBe(false);
    expect(powerCompatibility({}).ok).toBe(null);
  });
});

describe("pricing", () => {
  const rules: PricingRule[] = [
    { scope: "global", category_id: null, product_id: null, kind: "percent", value: 4500 },
    { scope: "category", category_id: 2, product_id: null, kind: "percent", value: 8000 },
    { scope: "product", category_id: null, product_id: "p1", kind: "fixed", value: 50000 },
  ];
  const base = { costCents: 200000, productId: "x", categoryChain: [9], overrideCents: null, promoCents: null, promoStarts: null, promoEnds: null };
  it("rounds to retail prices ending in 9", () => { expect(retailRound(290000)).toBe(290900); expect(retailRound(399850)).toBe(399900); });
  it("applies precedence: override > product > category > global", () => {
    expect(resolvePrice(base, rules).source).toBe("global_rule");
    expect(resolvePrice({ ...base, categoryChain: [5, 2] }, rules).source).toBe("category_rule");
    expect(resolvePrice({ ...base, productId: "p1", categoryChain: [2] }, rules)).toMatchObject({ source: "product_rule", regularCents: 250900 });
    expect(resolvePrice({ ...base, productId: "p1", overrideCents: 399900 }, rules)).toMatchObject({ source: "override", finalCents: 399900 });
  });
  it("promo only applies inside its window and below the regular price", () => {
    const now = new Date("2026-06-15");
    const p = { ...base, overrideCents: 399900, promoCents: 349900 };
    expect(resolvePrice({ ...p, promoEnds: new Date("2026-06-30") }, rules, now).finalCents).toBe(349900);
    expect(resolvePrice({ ...p, promoEnds: new Date("2026-06-01") }, rules, now).onPromo).toBe(false);
    expect(resolvePrice({ ...p, promoCents: 500000 }, rules, now).onPromo).toBe(false);
  });
  it("no rule and no override → no price (cannot be sold)", () => { expect(resolvePrice(base, []).finalCents).toBe(0); });
  it("matches the brief's worked example: R3 999 − R2 000 − R300 − R120 = R1 579", () => {
    const r = profit({ retailCents: 399900, costCents: 200000, shippingCostCents: 30000 }, { payment_fee_bps: 0, payment_fee_fixed_cents: 12000 });
    expect(r.grossProfitCents).toBe(157900);
  });
  it("passes delivery through at zero profit and reports losses", () => {
    expect(profit({ retailCents: 100000, costCents: 60000, shippingCostCents: 20000, shippingChargedCents: 20000 }, fees).grossProfitCents).toBe(100000 - 60000 - 3600);
    expect(profit({ retailCents: 100000, costCents: 120000 }, fees).marginBps).toBeLessThan(0);
  });
  it("validates discount codes", () => {
    const d = { code: "X", kind: "percent" as const, value: 1000, min_subtotal_cents: 100000, max_uses: 1, used: 0, starts_at: null, ends_at: null, active: true };
    expect(evaluateDiscount(d, 200000)).toMatchObject({ ok: true, amountCents: 20000 });
    expect(evaluateDiscount(d, 50000).ok).toBe(false);
    expect(evaluateDiscount({ ...d, used: 1 }, 200000).ok).toBe(false);
    expect(evaluateDiscount({ ...d, ends_at: new Date("2020-01-01") }, 200000).ok).toBe(false);
    expect(evaluateDiscount({ ...d, kind: "fixed", value: 999999 }, 200000).amountCents).toBe(200000);
    expect(evaluateDiscount(null, 200000).ok).toBe(false);
  });
  it("bundle applies only when every product is in the cart", () => {
    const b = [{ id: 1, name: "B", percent_off_bps: 500, product_ids: ["a", "b"] }];
    expect(evaluateBundles(b, [{ productId: "a", unitCents: 100000, quantity: 1 }])).toEqual([]);
    expect(evaluateBundles(b, [{ productId: "a", unitCents: 100000, quantity: 2 }, { productId: "b", unitCents: 50000, quantity: 1 }])[0].amountCents).toBe(7500);
  });
});

describe("shipping & customs", () => {
  it("bills on the greater of actual and volumetric weight", () => {
    expect(chargeableKg([{ weightG: 7200, lengthMm: 520, widthMm: 420, heightMm: 260, quantity: 1 }])).toBe(11.5);
    expect(chargeableKg([{ weightG: 20000, lengthMm: 100, widthMm: 100, heightMm: 100, quantity: 2 }])).toBe(40);
  });
  it("import VAT = 15% × (value × 1.10 + duty)", () => {
    const e = estimateImportCosts([{ valueCents: 1000000, quantity: 1, dutyRateBps: 1000, dutyVerified: true }], { vat_bps: 1500, customs_uplift_bps: 1000 });
    expect(e).toMatchObject({ dutyCents: 100000, vatCents: 180000, totalCents: 280000, dutyRateKnown: true });
    expect(estimateImportCosts([{ valueCents: 100, quantity: 1, dutyRateBps: 0, dutyVerified: false }], { vat_bps: 1500, customs_uplift_bps: 1000 }).dutyRateKnown).toBe(false);
  });
  it("skips weekends in delivery windows", () => { expect(addBusinessDays(new Date("2026-11-13T10:00:00"), 1).getDay()).toBe(1); });
});

describe("PayFast signing", () => {
  it("encodes like PHP urlencode", () => { expect(pfEncode("a b&c/d~(e)")).toBe("a+b%26c%2Fd%7E%28e%29"); });
  it("signature is stable, order-sensitive and passphrase-sensitive", () => {
    const pairs: [string, string][] = [["merchant_id", "10000100"], ["amount", "100.00"], ["item_name", "Test Item"]];
    const s = pfSignature(pairs, "secret");
    expect(s).toMatch(/^[0-9a-f]{32}$/);
    expect(pfSignature(pairs, "secret")).toBe(s);
    expect(pfSignature([...pairs].reverse(), "secret")).not.toBe(s);
    expect(pfSignature(pairs, "other")).not.toBe(s);
  });
  it("a tampered ITN amount fails verification", () => {
    const itn: [string, string][] = [["m_payment_id", "abc"], ["pf_payment_id", "1"], ["payment_status", "COMPLETE"], ["amount_gross", "100.00"], ["custom_str1", ""]];
    const sig = pfItnSignature(itn, "pp");
    expect(pfItnSignature(itn.map(([k, v]) => [k, k === "amount_gross" ? "1.00" : v]), "pp")).not.toBe(sig);
  });
  it("checkout fields carry ZAR amount and a signature last", () => {
    const f = pfCheckoutFields({ merchantId: "1", merchantKey: "k", passphrase: "p", siteUrl: "https://x.co.za", paymentId: "pay1", orderNumber: "SAM-1", accessToken: "t", amountCents: 571410, email: "a@b.co", firstName: "A", lastName: "" });
    expect(Object.fromEntries(f).amount).toBe("5714.10");
    expect(f[f.length - 1][0]).toBe("signature");
    expect(f.some(([k]) => k === "name_last")).toBe(false);
  });
});
