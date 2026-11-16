import { NextResponse } from "next/server";
import { z } from "zod";
import { cartLineSchema, priceCart } from "@/lib/checkout";

const schema = z.object({ lines: z.array(cartLineSchema).max(30), code: z.string().max(40).optional().nullable() });

/** Prices the cart on the server. Returns only customer-facing figures. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
  const { _resolved, ...cart } = await priceCart(parsed.data.lines, parsed.data.code);
  void _resolved;
  return NextResponse.json(cart);
}
