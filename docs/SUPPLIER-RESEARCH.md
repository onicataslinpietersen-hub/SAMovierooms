# Supplier, shipping, payments and compliance research

Researched November 2026 by web search. **The official documentation sites for Alibaba Open Platform, CJdropshipping
and PayFast could not be opened from the build environment**, so nothing here was confirmed against primary sources,
and no supplier account, API key or sample was available. Treat every point as a lead to verify, not a fact.

## 1. Suppliers

| | CJdropshipping | Alibaba.com | AliExpress (DS API) | South African distributor |
| --- | --- | --- | --- | --- |
| What it is | Dropshipping agent with own warehouses | B2B marketplace of manufacturers | Consumer marketplace | Local importer holding stock |
| Product search / import by API | Yes (product list, product query, variants) | Not confirmed for buyers | Yes, after approval | Rarely |
| Price + stock sync | Yes | Not confirmed | Yes, after approval | Usually a price list / feed |
| Order by API | Yes (create order V2/V3) | **Not confirmed — assume no** | Yes, after approval | No (email/portal) |
| Tracking by API | Yes (older endpoint deprecated June 2024; a newer one replaces it) | Not confirmed | Yes, after approval | No |
| Minimum order | 1 unit | Per supplier, often more than 1 | 1 unit | Account + minimums common |
| Ships single units to SA | **Unconfirmed** | Only if the individual supplier agrees | **Unconfirmed per seller** | Yes |
| SA warranty / compliance | Buyer's problem | Buyer's problem | Buyer's problem | Carried by the distributor |
| In this codebase | Adapter written, **untested** | Manual workflow | Manual workflow | Manual workflow |

**Alibaba.com** — do not assume it can run automated dropshipping. What the search turned up describes the Open
Platform as seller/ISV oriented (apps need an App Key/Secret, an authorised *seller* session and per-API permissions).
Nothing confirmed a generally available buyer-side API for searching, ordering and tracking. Marketplace API access is
also a separate question from whether a given factory will ship one unit, unbranded, to a consumer in South Africa —
that is negotiated supplier by supplier. Questions to put to Alibaba and to each shortlisted supplier: is there a
buyer/dropshipping API and what account type and approval does it need; will you ship single units direct to
customers; do you offer DDP to South Africa; what warranty applies and who pays return freight; can you provide the
datasheet, test reports and plug type.

**CJdropshipping** — the closest fit for automation: public API covering catalogue, stock, freight calculation, order
creation and tracking, with no minimum order. Open points: which shipping lines actually serve South Africa and at
what cost and speed for a 3–10 kg projector; whether any line is DDP; orders must be pre-funded from a CJ wallet; CJ
listings are marketing copy, so specifications still need checking against a real unit. The adapter leaves specs
empty on import for that reason.

**A local distributor is worth pursuing in parallel**, especially for televisions. Importing a single 65–85 inch TV
by air costs thousands of rand and by sea takes over a month, and the importer carries the regulatory burden (below).
A local distributor that dropships for retailers removes customs, compliance and warranty risk at the cost of margin.

## 2. Shipping to South Africa

International express couriers (DHL, FedEx, UPS) bill on the greater of actual and volumetric weight
(L × W × H cm ÷ 5000), which is why bulky items are expensive. The checkout quotes each basket per supplier, per
address, from the supplier adapter — there is no flat rate. **All rates in the demo are sample figures.** Get written
quotes for your real products to Gauteng, Cape Town, Durban and one outlying town before pricing anything.

DDP (seller prepays duties) is better for customers but puts the customs cost and risk on you. DAP means the courier
collects duties from the customer before delivery, plus its own clearance fee — a common source of refused parcels.
The checkout only describes an option as DDP when the supplier's shipping option says so.

## 3. Import duties and VAT

- Import VAT is 15%, levied on the customs value plus 10% plus any customs duty. The 10% uplift came from a commercial
  guide rather than SARS directly; it is an admin setting.
- **Duty rates are unresolved.** Sources conflict: one tariff listing shows 25% for "other monitors and projectors"
  (8528.59.90), another shows projectors under a different heading as free, and TV rates were unclear. The correct
  rate depends on the exact tariff heading for each product. The store therefore ships with every category's duty
  rate at 0% and marked *unconfirmed*, and tells customers the estimate covers VAT only. Have a clearing agent classify
  your products and enter the rates under Admin → Settings.
- Some electronics may also attract ad valorem excise. Ask the clearing agent.

## 4. Electrical safety and regulatory

- **NRCS Letter of Authority (LOA):** reported as required for regulated electrical products before they clear
  customs, and held by the local importer. **ICASA type approval** is reported as required for equipment with radio
  transmitters (Wi-Fi, Bluetooth) — which most smart projectors and TVs have.
- Who counts as "the importer" when goods are shipped directly to a consumer is the key legal question for this
  business model, and the search did not answer it. **Get advice from a customs/regulatory specialist before selling
  imported mains-powered or wireless products.** This is the largest unresolved risk in the plan.
- South Africa is 230 V / 50 Hz with SANS 164 plugs. Product pages show input voltage and plug type and warn when a
  plug type is unconfirmed; products rated only for 110–120 V are flagged incompatible.
- Warranty: imported units usually have no local service network. The Consumer Protection Act's 6-month warranty
  applies to you as the seller regardless, with return freight at your cost — price that in.

## 5. Payment gateways

Fee figures from third-party articles disagreed with each other; get current pricing from each provider.

| | Notes |
| --- | --- |
| **PayFast** | Cards, Instant EFT and other local methods; simplest onboarding. Quoted card fees ranged about 2%–3.2% + R2. Integrated here (signed redirect + ITN webhook); **not yet tested against PayFast's sandbox** — needs your merchant credentials. Refunds are recorded in the admin and completed in the PayFast dashboard. |
| **Peach Payments** | Often described as suited to larger or subscription merchants. Not integrated. |
| **Yoco** | Card gateway; reported not to offer Instant EFT. Not integrated. |
| **Ozow** | Instant EFT only, cheaper per transaction; often paired with a card gateway. Not integrated. |

All settle in ZAR. Do not assume multi-currency or any particular payment method until the provider confirms it for
your account. Adding a gateway means one provider module in `src/lib/payments/`.

## Sources

- https://developers.cjdropshipping.com/en/api/api2/api/shopping.html
- https://developers.cjdropshipping.com/en/api/api2/api/logistic.html
- https://developers.cjdropshipping.com/en/api/api2/api/product.html
- https://openapi.alibaba.com/doc/doc.htm (not reachable)
- https://docs.ecosire.com/odoo-modules/alibaba-store-management
- https://www.sars.gov.za/?p=505
- https://app.jlog.co.za/hs/8528-59-90-monitors-and-projectors-not-incorporating-television-reception-apparatus-recepti
- https://www.freightnews.co.za/customs/tariffs/1094063466/monitors-and-projectors-not-incorporating-television-reception-apparatus
- https://www.epicsourcing.co/post/import-duties-from-china-to-south-africa
- https://nemko.com/blog/market-access-conditions-in-south-africa
- https://www.tuvsud.com/en/services/global-market-access/south-africa
- https://evezone.evetech.co.za/quick-bytes/why-some-imported-wireless-gear-needs-icasa-approval
- https://dodopayments.com/blogs/payfast-alternatives
- https://kolonell.com/en/blog/payment-gateway-decision-guide-south-africa-2026
- https://mctaba.com/learn/payments/south-africa/gateways
