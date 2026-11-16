import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get databaseUrl() { return req("DATABASE_URL"); },
  get appSecret() {
    const s = req("APP_SECRET");
    if (s.length < 24) throw new Error("APP_SECRET must be at least 24 characters");
    return s;
  },
  get siteUrl() { return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""); },
  get demoMode() { return process.env.DEMO_MODE === "true"; },
  get paymentProvider() { return process.env.PAYMENT_PROVIDER || "sandbox"; },
  get cronSecret() { return process.env.CRON_SECRET || ""; },
  payfast: {
    get merchantId() { return process.env.PAYFAST_MERCHANT_ID || ""; },
    get merchantKey() { return process.env.PAYFAST_MERCHANT_KEY || ""; },
    get passphrase() { return process.env.PAYFAST_PASSPHRASE || ""; },
    get sandbox() { return process.env.PAYFAST_SANDBOX !== "false"; },
  },
  get smtpUrl() { return process.env.SMTP_URL || ""; },
  get emailFrom() { return process.env.EMAIL_FROM || "SAMovierooms <no-reply@example.com>"; },
};
