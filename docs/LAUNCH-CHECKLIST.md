# Before SAMovierooms takes a real order

The three non-negotiables from the brief come first, because the store is only as good as the supplier behind it.

## 1. Supplier verification
- [ ] Shortlist suppliers and order a **sample projector** to a South African address.
- [ ] Measure it against the listing: native resolution, brightness, noise, build, plug type, packaging.
- [ ] Get the datasheet and warranty terms in writing.
- [ ] Record the outcome on the supplier's admin page, then set it to **Approved** (the form requires this confirmation).

## 2. Shipping verification
- [ ] Written quotes for your actual products to Johannesburg, Cape Town, Durban and one outlying town.
- [ ] Confirm DDP or DAP per shipping method, and the courier's clearance fees.
- [ ] Have a clearing agent classify each product category; enter tariff headings and duty rates in Admin → Settings.
- [ ] Get advice on NRCS LOA and ICASA obligations for direct-to-consumer imports.

## 3. Automated fulfilment
- [ ] Enter the supplier's API key; press **Test connection**.
- [ ] Check the adapter's endpoints against the supplier's current API docs (the CJdropshipping adapter is untested).
- [ ] Place one real, low-value order from payment through supplier dispatch to delivery, and watch tracking update.
- [ ] Cancel one order before dispatch and confirm the supplier-side cancellation and the refund.

## Then the rest
- [ ] PayFast merchant account; set credentials; run the checkout against PayFast's **sandbox**; then `PAYFAST_SANDBOX=false`.
- [ ] `DEMO_MODE=false` — removes the sandbox supplier and sandbox gateway and re-enables search indexing.
- [ ] Remove the sample catalogue; import, verify and publish real products with real photography.
- [ ] Company details, Information Officer and support contacts in Admin → Settings (shown on the site as required by the ECT Act).
- [ ] Attorney review of the five policy pages (they are drafts).
- [ ] `SMTP_URL` so customer emails are actually delivered.
- [ ] Scheduler calling `POST /api/cron/sync` every 5–10 minutes.
- [ ] Hosting with HTTPS, managed Postgres with automated backups, error monitoring.
- [ ] Change the seeded admin password; create named staff accounts.
- [ ] Confirm your VAT registration position with an accountant.
- [ ] Optional: `NEXT_PUBLIC_GA_ID` / `NEXT_PUBLIC_META_PIXEL_ID` (loaded only after cookie consent).
