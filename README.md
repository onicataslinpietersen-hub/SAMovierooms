# SAMovierooms

**Bring the Cinema Home.** A South African home-cinema storefront with a zero-inventory (dropshipping) back end:
cinematic storefront, checkout in ZAR, supplier-independent automated fulfilment, tracking, and an admin dashboard
with private profit reporting.

> **Status: working demo, not yet a trading store.** Everything runs end to end against a *simulated* supplier and a
> *simulated* payment gateway, with a fictional sample catalogue. No real supplier has been verified and no real
> payment has been taken. See [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md) before going live.

## Run it

Requires Node 22+ and PostgreSQL 14+.

```bash
cp .env.example .env          # set DATABASE_URL, APP_SECRET, CRON_SECRET, ADMIN_PASSWORD
npm install
npm run db:migrate
npm run db:seed               # categories, sample catalogue, suppliers, admin user
npm run dev                   # http://localhost:3000   (admin: /admin)
```

The admin login is `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (change the default password).

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests: pricing, 4K claim rules, customs maths, PayFast signing |
| `npm run test:e2e` | Order pipeline against the database + sandbox supplier (payment → supplier → tracking → delivery, and every failure path) |
| `npm run sync` | One background-worker tick (same as `POST /api/cron/sync`) |
| `npm run db:reset` | Rebuild a **dev** database from scratch |

Schedule `POST /api/cron/sync` with header `x-cron-secret: $CRON_SECRET` every 5–10 minutes in production.
It retries fulfilments, syncs tracking, stock and prices, and raises alerts.

## How it is built

- **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4**, PostgreSQL via `pg` (schema in `db/schema.sql`).
- **3D**: React Three Fiber projector viewer, loaded only on capable desktops when scrolled into view; phones get a
  lightweight illustration with an opt-in "View in 3D" button. Motion via `motion` (Framer Motion).
- **No stock photography**: the hero scene and product visuals are original SVG/3D, so the demo ships with no borrowed
  imagery. Real supplier photos replace the illustrations per product in the admin.

```
src/lib/pricing.ts        markup rules, promo, discounts, bundles, profit        (pure, unit-tested)
src/lib/specs.ts          structured specs + which marketing claims are allowed  (pure, unit-tested)
src/lib/shipping.ts       chargeable weight, SA zones, import duty/VAT estimate  (pure, unit-tested)
src/lib/checkout.ts       server-side cart pricing, shipping quotes, order creation
src/lib/payments/         gateway abstraction: PayFast + sandbox; idempotent payment application; refunds
src/lib/fulfillment.ts    the fulfilment engine + background worker
src/lib/suppliers/        one module per supplier (sandbox, manual, cjdropshipping) + registry
src/app/admin/            dashboard: orders, products, suppliers, pricing, finance, support, settings
```

### Rules the code enforces

- **Supplier cost never reaches the browser.** Catalogue data has an internal shape (with offers) and a public shape;
  only the public one is passed to client components or returned by APIs.
- **A supplier is contacted only after payment is confirmed**, through one function (`applyPaymentResult`) that is safe
  against replayed and concurrent gateway notifications.
- **An order is never shown as submitted unless the supplier returned a reference** (or an admin recorded one).
  Timeouts are stored as `unknown` and reconciled by lookup before any retry, so a retry cannot create a second parcel.
  A unique key per (order, supplier) backs this at the database level.
- **"Native 4K" comes only from the `native_resolution` field.** A projector that accepts 4K input is labelled
  "4K input supported". "Crystal-Clear 4K Entertainment" appears only for verified native-4K products.
- **Publishing is blocked** while specs are unverified, native resolution is missing on a display product, or the
  margin is under the admin's minimum. A supplier price rise that breaks the margin unpublishes the product and alerts.
- **Customer-visible tracking steps are only those confirmed** by the gateway, the supplier or the carrier.
- **Delivery windows are per product and address** and always labelled as estimates; DDP vs DAP is spelled out with
  an import-cost estimate before payment.

### Adding a supplier

Implement `SupplierAdapter` (`src/lib/suppliers/types.ts`) in a new module and register it in
`src/lib/suppliers/index.ts`. Declare its `capabilities`; anything it cannot do automatically falls back to the manual
workflow in the admin (order queue → record the supplier's reference → enter tracking).

## Security notes

Sessions are random tokens stored hashed, in `httpOnly` cookies; passwords use bcrypt; role checks run in every admin
page *and* every admin server action; supplier credentials are AES-256-GCM encrypted at rest; card data never touches
the app; webhooks are signature-checked, confirmed server-to-server and de-duplicated; login, order, quote and contact
endpoints are rate-limited (in memory — move to Redis when running more than one instance).

Not included, to add at deployment: managed Postgres backups, error monitoring (e.g. Sentry), object storage/CDN for
product photos, and a WAF/bot protection layer.
