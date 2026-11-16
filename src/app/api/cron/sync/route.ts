import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runSync } from "@/lib/fulfillment";

/** Background worker tick: retries fulfilments, syncs tracking, stock and prices. Schedule every 5–10 minutes. */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") ?? "";
  if (!env.cronSecret || !safeEqual(secret, env.cronSecret)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  return NextResponse.json(await runSync());
}
