"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { q } from "@/lib/db";
import { getUser, rateLimit } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";

type Result = { ok: boolean; message: string } | null;
const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

export async function subscribeNewsletter(_: Result, fd: FormData): Promise<Result> {
  const email = z.string().trim().toLowerCase().email().safeParse(fd.get("email"));
  if (!email.success) return { ok: false, message: "Please enter a valid email address." };
  if (!rateLimit("nl:" + (await ip()), 5, 60_000)) return { ok: false, message: "Too many attempts. Please try again in a minute." };
  await q("INSERT INTO newsletter_subscribers(email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET unsubscribed_at = NULL, consent_at = now()", [email.data]);
  return { ok: true, message: "You're on the list. Welcome to SAMovierooms." };
}

const ticket = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  orderNumber: z.string().trim().max(30).optional(),
  subject: z.string().trim().min(3, "Please add a subject").max(160),
  message: z.string().trim().min(10, "Please tell us a little more so we can help").max(4000),
});

export async function createTicket(_: Result, fd: FormData): Promise<Result> {
  if (fd.get("website")) return { ok: true, message: "Thank you." }; // honeypot
  const p = ticket.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (!rateLimit("ticket:" + (await ip()), 4, 10 * 60_000)) return { ok: false, message: "You have sent several messages in a short time. Please try again later." };
  const user = await getUser();
  await q("INSERT INTO support_tickets(user_id, email, name, order_number, subject, message) VALUES ($1,$2,$3,$4,$5,$6)", [user?.id ?? null, p.data.email, p.data.name, p.data.orderNumber || null, p.data.subject, p.data.message]);
  const s = await getSettings();
  if (s.support_email) await sendEmail(s.support_email, `[Support] ${p.data.subject}`, `From: ${p.data.name} <${p.data.email}>\nOrder: ${p.data.orderNumber || "—"}\n\n${p.data.message}`);
  await sendEmail(p.data.email, "We received your message — SAMovierooms", `Hi ${p.data.name},\n\nThanks for getting in touch. Our team will reply to this address.\n\nYour message:\n${p.data.message}`);
  return { ok: true, message: "Thank you — your message has been received. We will reply by email." };
}
