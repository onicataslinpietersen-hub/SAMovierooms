import "server-only";
import { q, q1 } from "./db";
import { env } from "./env";

/**
 * Every outgoing message is recorded in email_outbox. If SMTP_URL is configured it is also sent;
 * otherwise it is stored with status "logged" so the admin can see exactly what customers would have received.
 */
export async function sendEmail(to: string, subject: string, body: string) {
  const row = await q1<{ id: string }>("INSERT INTO email_outbox(to_email, subject, body, status) VALUES ($1,$2,$3,$4) RETURNING id", [to, subject, body, env.smtpUrl ? "queued" : "logged"]);
  if (!env.smtpUrl) return;
  try {
    const nodemailer = await import("nodemailer");
    await nodemailer.createTransport(env.smtpUrl).sendMail({ from: env.emailFrom, to, subject, text: body });
    await q("UPDATE email_outbox SET status='sent' WHERE id=$1", [row!.id]);
  } catch (e) {
    await q("UPDATE email_outbox SET status='failed', error=$2 WHERE id=$1", [row!.id, (e as Error).message]);
  }
}

export const orderUrl = (o: { number: string; access_token: string }) => `${env.siteUrl}/order/${o.number}?t=${o.access_token}`;
