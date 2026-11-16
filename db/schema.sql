-- SAMovierooms schema. All money is stored as integer ZAR cents.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  first_name    text NOT NULL DEFAULT '',
  last_name     text NOT NULL DEFAULT '',
  phone         text,
  role          text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','support','admin')),
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE password_resets (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE TABLE addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT 'Home',
  recipient   text NOT NULL,
  phone       text NOT NULL,
  line1       text NOT NULL,
  line2       text,
  suburb      text,
  city        text NOT NULL,
  province    text NOT NULL,
  postal_code text NOT NULL,
  country     text NOT NULL DEFAULT 'ZA',
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id          serial PRIMARY KEY,
  parent_id   int REFERENCES categories(id) ON DELETE CASCADE,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  tagline     text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  seo_title   text,
  seo_description text,
  -- customs: tariff heading + duty rate are admin-maintained; verified=false means "estimate only"
  tariff_heading text,
  duty_rate_bps  int NOT NULL DEFAULT 0,
  duty_verified  boolean NOT NULL DEFAULT false,
  sort        int NOT NULL DEFAULT 0
);

CREATE TABLE suppliers (
  id            serial PRIMARY KEY,
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  adapter       text NOT NULL,                 -- key into src/lib/suppliers registry
  status        text NOT NULL DEFAULT 'research' CHECK (status IN ('research','pending_verification','approved','suspended')),
  is_sample     boolean NOT NULL DEFAULT false,
  priority      int NOT NULL DEFAULT 100,       -- lower = preferred
  website       text,
  -- comparison dashboard fields (admin-maintained, never shown to customers)
  verification_notes text NOT NULL DEFAULT '',
  moq_notes        text NOT NULL DEFAULT '',
  ships_to_za      text NOT NULL DEFAULT 'unknown' CHECK (ships_to_za IN ('yes','no','unknown')),
  shipping_methods text NOT NULL DEFAULT '',
  delivery_estimate text NOT NULL DEFAULT '',
  warranty_terms   text NOT NULL DEFAULT '',
  api_availability text NOT NULL DEFAULT '',
  dropship_support text NOT NULL DEFAULT '',
  warehouse_country text NOT NULL DEFAULT 'CN',
  credentials_enc  text,                        -- AES-256-GCM, key derived from APP_SECRET
  last_test_at     timestamptz,
  last_test_ok     boolean,
  last_test_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  brand         text NOT NULL DEFAULT '',
  category_id   int NOT NULL REFERENCES categories(id),
  short_description text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  kind          text NOT NULL DEFAULT 'projector',  -- drives illustration / 3D model / spec layout
  specs         jsonb NOT NULL DEFAULT '{}',        -- structured, see src/lib/specs.ts
  specs_verified boolean NOT NULL DEFAULT false,    -- admin confirms specs against supplier datasheet / sample
  is_sample     boolean NOT NULL DEFAULT false,     -- demo catalogue data
  images        jsonb NOT NULL DEFAULT '[]',        -- [{url, alt}]
  video_url     text,
  warranty      text NOT NULL DEFAULT '',
  returns_info  text NOT NULL DEFAULT '',
  weight_g      int NOT NULL DEFAULT 0,
  length_mm     int NOT NULL DEFAULT 0,
  width_mm      int NOT NULL DEFAULT 0,
  height_mm     int NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'imported' CHECK (status IN ('imported','approved','published','unpublished','rejected')),
  featured      boolean NOT NULL DEFAULT false,
  best_seller   boolean NOT NULL DEFAULT false,
  price_override_cents int,                         -- individual product price (wins over markup rules)
  promo_price_cents int,
  promo_starts  timestamptz,
  promo_ends    timestamptz,
  seo_title     text,
  seo_description text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_status_idx ON products(status);
CREATE INDEX products_search_idx ON products USING gin (to_tsvector('english', name || ' ' || brand || ' ' || short_description));

CREATE TABLE product_variants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku         text NOT NULL UNIQUE,
  name        text NOT NULL DEFAULT 'Standard',
  finish_hex  text,
  sort        int NOT NULL DEFAULT 0
);

-- A supplier's offer for one of our variants. The cheapest in-stock offer from the
-- highest-priority approved supplier is used for pricing + fulfilment.
CREATE TABLE supplier_products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   int NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  variant_id    uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  supplier_ref  text NOT NULL,                  -- supplier's product/variant id
  cost_cents    int NOT NULL,                   -- wholesale, ZAR cents
  source_currency text NOT NULL DEFAULT 'ZAR',
  source_amount numeric(12,2),
  stock         int NOT NULL DEFAULT 0,
  moq           int NOT NULL DEFAULT 1,
  last_synced_at timestamptz,
  UNIQUE (supplier_id, variant_id)
);

CREATE TABLE pricing_rules (
  id          serial PRIMARY KEY,
  scope       text NOT NULL CHECK (scope IN ('global','category','product')),
  category_id int REFERENCES categories(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES products(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('percent','fixed')),
  value       int NOT NULL,                     -- percent: basis points; fixed: cents
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE discounts (
  id          serial PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  kind        text NOT NULL CHECK (kind IN ('percent','fixed')),
  value       int NOT NULL,
  min_subtotal_cents int NOT NULL DEFAULT 0,
  max_uses    int,
  used        int NOT NULL DEFAULT 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE bundles (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  percent_off_bps int NOT NULL,
  product_ids uuid[] NOT NULL,
  active      boolean NOT NULL DEFAULT true
);

CREATE SEQUENCE order_number_seq START 10001;

CREATE TABLE orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number        text NOT NULL UNIQUE,
  access_token  text NOT NULL,                   -- lets guests view their order
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  email         text NOT NULL,
  status        text NOT NULL DEFAULT 'pending_payment'
                CHECK (status IN ('pending_payment','paid','processing','partially_shipped','shipped','delivered','cancelled','refunded','payment_failed')),
  ship_recipient text NOT NULL,
  ship_phone    text NOT NULL,
  ship_line1    text NOT NULL,
  ship_line2    text,
  ship_suburb   text,
  ship_city     text NOT NULL,
  ship_province text NOT NULL,
  ship_postal_code text NOT NULL,
  ship_country  text NOT NULL DEFAULT 'ZA',
  subtotal_cents int NOT NULL,
  discount_cents int NOT NULL DEFAULT 0,
  shipping_cents int NOT NULL DEFAULT 0,
  duties_collected_cents int NOT NULL DEFAULT 0,   -- only when shipping is DDP
  total_cents   int NOT NULL,
  discount_code text,
  -- internal economics (never exposed to customers)
  cost_cents          int NOT NULL DEFAULT 0,
  shipping_cost_cents int NOT NULL DEFAULT 0,
  import_cost_cents   int NOT NULL DEFAULT 0,
  payment_fee_cents   int NOT NULL DEFAULT 0,
  refunded_cents      int NOT NULL DEFAULT 0,
  -- consents captured at checkout (ECT Act / CPA / POPIA)
  accepted_terms_at timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  paid_at       timestamptz
);
CREATE INDEX orders_user_idx ON orders(user_id);
CREATE INDEX orders_created_idx ON orders(created_at);

CREATE TABLE fulfillments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id   int NOT NULL REFERENCES suppliers(id),
  -- One fulfilment per (order, supplier): the DB-level guard against duplicate supplier orders.
  idempotency_key text NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','submitting','awaiting_manual','submitted','confirmed','shipped','in_transit','out_for_delivery','delivered','failed','unknown','cancel_requested','cancelled')),
  supplier_order_ref text,                       -- set ONLY from a supplier response / admin entry
  shipping_method text NOT NULL,
  shipping_carrier text,
  incoterm      text NOT NULL DEFAULT 'DAP' CHECK (incoterm IN ('DDP','DAP')),
  eta_min_days  int,
  eta_max_days  int,
  shipping_cents int NOT NULL DEFAULT 0,
  shipping_cost_cents int NOT NULL DEFAULT 0,
  duties_estimate_cents int NOT NULL DEFAULT 0,
  tracking_number text,
  tracking_url  text,
  attempts      int NOT NULL DEFAULT 0,
  last_error    text,
  next_attempt_at timestamptz,
  submitted_at  timestamptz,
  shipped_at    timestamptz,
  delivered_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fulfillments_status_idx ON fulfillments(status);

CREATE TABLE order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  fulfillment_id uuid REFERENCES fulfillments(id) ON DELETE SET NULL,
  product_id    uuid REFERENCES products(id) ON DELETE SET NULL,
  variant_id    uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  supplier_id   int REFERENCES suppliers(id),
  supplier_ref  text,
  name          text NOT NULL,
  variant_name  text NOT NULL DEFAULT '',
  sku           text NOT NULL,
  quantity      int NOT NULL CHECK (quantity > 0),
  unit_price_cents int NOT NULL,
  unit_cost_cents  int NOT NULL
);

CREATE TABLE payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider      text NOT NULL,
  provider_ref  text,
  status        text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','succeeded','failed','cancelled')),
  amount_cents  int NOT NULL,
  fee_cents     int NOT NULL DEFAULT 0,
  raw           jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_provider_ref_idx ON payments(provider, provider_ref) WHERE provider_ref IS NOT NULL;

CREATE TABLE tracking_events (
  id            bigserial PRIMARY KEY,
  fulfillment_id uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  status        text NOT NULL,                   -- shipped | in_transit | customs | out_for_delivery | delivered | exception | info
  description   text NOT NULL,
  location      text,
  occurred_at   timestamptz NOT NULL,
  source        text NOT NULL,                   -- 'supplier' | 'carrier' | 'admin'
  UNIQUE (fulfillment_id, status, occurred_at)
);

-- Customer-visible order timeline. Rows are only written when the event actually happened.
CREATE TABLE order_events (
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  message     text NOT NULL,
  internal    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id  uuid REFERENCES payments(id),
  amount_cents int NOT NULL,
  reason      text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','processed','failed')),
  provider_ref text,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       text NOT NULL DEFAULT '',
  body        text NOT NULL DEFAULT '',
  verified_purchase boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

CREATE TABLE wishlist_items (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  email       text NOT NULL,
  name        text NOT NULL DEFAULT '',
  order_number text,
  subject     text NOT NULL,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  admin_reply text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE newsletter_subscribers (
  email       text PRIMARY KEY,
  consent_at  timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz
);

CREATE TABLE settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

CREATE TABLE email_outbox (
  id          bigserial PRIMARY KEY,
  to_email    text NOT NULL,
  subject     text NOT NULL,
  body        text NOT NULL,
  status      text NOT NULL DEFAULT 'queued',     -- queued | sent | failed | logged (no SMTP configured)
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Idempotency for inbound webhooks (payment ITNs, supplier callbacks)
CREATE TABLE webhook_events (
  id          bigserial PRIMARY KEY,
  source      text NOT NULL,
  event_key   text NOT NULL,
  valid       boolean NOT NULL,
  payload     jsonb,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, event_key)
);

CREATE TABLE alerts (
  id          bigserial PRIMARY KEY,
  severity    text NOT NULL DEFAULT 'warning',
  kind        text NOT NULL,
  message     text NOT NULL,
  order_id    uuid REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id int REFERENCES suppliers(id) ON DELETE CASCADE,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- State for the built-in SANDBOX supplier (a simulated external system used for demos and tests).
CREATE TABLE sandbox_supplier_orders (
  ref             text PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  payload         jsonb NOT NULL,
  cancelled       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
