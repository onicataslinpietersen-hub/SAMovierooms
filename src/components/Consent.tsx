"use client";
import Script from "next/script";
import { useEffect, useState } from "react";

const GA = process.env.NEXT_PUBLIC_GA_ID;
const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/** POPIA-friendly: analytics and advertising pixels only load after the visitor opts in. */
export function Consent() {
  const [choice, setChoice] = useState<"unknown" | "yes" | "no">("unknown");
  const [ready, setReady] = useState(false);
  useEffect(() => { setChoice((localStorage.getItem("samr-consent") as "yes" | "no" | null) ?? "unknown"); setReady(true); }, []);
  const decide = (v: "yes" | "no") => { localStorage.setItem("samr-consent", v); setChoice(v); };
  if (!ready || (!GA && !PIXEL)) return null;
  return (
    <>
      {choice === "yes" && GA ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA}',{anonymize_ip:true});`}</Script>
        </>
      ) : null}
      {choice === "yes" && PIXEL ? (
        <Script id="px" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');`}</Script>
      ) : null}
      {choice === "unknown" ? (
        <div className="glass fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-2xl rounded-2xl p-5 sm:flex sm:items-center sm:gap-6" role="dialog" aria-label="Cookie preferences">
          <p className="text-sm text-sand">We use essential cookies to run the store. With your permission we also use analytics and advertising cookies to improve it. <a className="link" href="/privacy-policy">Privacy policy</a></p>
          <div className="mt-4 flex shrink-0 gap-2 sm:mt-0">
            <button className="btn-ghost btn-sm" onClick={() => decide("no")}>Essential only</button>
            <button className="btn-primary btn-sm" onClick={() => decide("yes")}>Accept all</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
