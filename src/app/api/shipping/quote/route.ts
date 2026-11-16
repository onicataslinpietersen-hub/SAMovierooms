import { NextResponse } from "next/server";
import { z } from "zod";
import { cartLineSchema, quoteShipments } from "@/lib/checkout";
import { PROVINCES } from "@/lib/shipping";
import { rateLimit } from "@/lib/auth";

const schema = z.object({
  lines: z.array(cartLineSchema).min(1).max(30),
  province: z.enum(PROVINCES.map((p) => p.code) as [string, ...string[]]),
  postalCode: z.string().regex(/^\d{4}$/).optional().default("0000"),
  city: z.string().max(80).optional().default(""),
});

/** Delivery options + import-cost estimate for a basket and destination. Wholesale/courier cost is never returned. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit("quote:" + ip, 60, 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  return NextResponse.json({ shipments: await quoteShipments(p.data.lines, p.data) });
}
