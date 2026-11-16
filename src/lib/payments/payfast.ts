import crypto from "node:crypto";

/**
 * PayFast helpers (pure — unit tested).
 * NOTE: implemented from PayFast's documented custom-integration flow (signed form POST + ITN callback).
 * developers.payfast.co.za was not reachable from the build environment, so validate against the PayFast
 * sandbox with your own merchant credentials before going live.
 */

/** PHP urlencode()-compatible: spaces → '+', everything except A–Z a–z 0–9 - _ . encoded with UPPERCASE hex. */
export function pfEncode(v: string): string {
  return encodeURIComponent(v.trim())
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
}

/** Signature = md5 of "k=v&k=v…" in the given order (empty values skipped), plus "&passphrase=…" when one is set. */
export function pfSignature(pairs: [string, string][], passphrase: string): string {
  let s = pairs.filter(([k, v]) => k !== "signature" && v !== "" && v !== undefined && v !== null).map(([k, v]) => `${k}=${pfEncode(String(v))}`).join("&");
  if (passphrase) s += `&passphrase=${pfEncode(passphrase)}`;
  return crypto.createHash("md5").update(s).digest("hex");
}

/** ITN signature covers every posted field in the order received (including empty ones), except `signature`. */
export function pfItnSignature(pairs: [string, string][], passphrase: string): string {
  let s = pairs.filter(([k]) => k !== "signature").map(([k, v]) => `${k}=${pfEncode(v)}`).join("&");
  if (passphrase) s += `&passphrase=${pfEncode(passphrase)}`;
  return crypto.createHash("md5").update(s).digest("hex");
}

export const pfHost = (sandbox: boolean) => (sandbox ? "sandbox.payfast.co.za" : "www.payfast.co.za");

export function pfCheckoutFields(o: {
  merchantId: string; merchantKey: string; passphrase: string; siteUrl: string;
  paymentId: string; orderNumber: string; accessToken: string; amountCents: number; email: string; firstName: string; lastName: string;
}): [string, string][] {
  // Field order matters for the signature and follows PayFast's documented attribute order.
  const pairs: [string, string][] = [
    ["merchant_id", o.merchantId],
    ["merchant_key", o.merchantKey],
    ["return_url", `${o.siteUrl}/order/${o.orderNumber}?t=${o.accessToken}`],
    ["cancel_url", `${o.siteUrl}/order/${o.orderNumber}?t=${o.accessToken}&cancelled=1`],
    ["notify_url", `${o.siteUrl}/api/webhooks/payfast`],
    ["name_first", o.firstName],
    ["name_last", o.lastName],
    ["email_address", o.email],
    ["m_payment_id", o.paymentId],
    ["amount", (o.amountCents / 100).toFixed(2)],
    ["item_name", `SAMovierooms order ${o.orderNumber}`],
  ];
  const filtered = pairs.filter(([, v]) => v !== "");
  return [...filtered, ["signature", pfSignature(filtered, o.passphrase)]];
}
