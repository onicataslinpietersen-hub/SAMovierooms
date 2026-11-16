import { q, q1, pool } from "../src/lib/db";
import bcrypt from "bcryptjs";
const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
import { importCatalogItem } from "../src/lib/import";
import { SANDBOX_CATALOG } from "../src/lib/suppliers/sandbox-catalog";

const TREE: [string, string, string, string, [string, string][]][] = [
  ["projectors", "Projectors", "The big screen, wherever you want it.", "From native 4K laser projectors for dedicated cinema rooms to pocket-sized portables for nights under the stars.", [
    ["native-4k-projectors", "Native 4K Projectors"], ["4k-compatible-projectors", "4K-Compatible Projectors"], ["full-hd-projectors", "Full HD Projectors"], ["portable-projectors", "Portable Projectors"], ["smart-projectors", "Smart Projectors"], ["laser-projectors", "Laser Projectors"], ["outdoor-projectors", "Outdoor Projectors"]]],
  ["televisions", "Televisions", "Picture-perfect, lights on or off.", "4K, OLED and QLED televisions chosen for film, sport and series.", [
    ["4k-smart-tvs", "4K Smart TVs"], ["oled-televisions", "OLED Televisions"], ["qled-televisions", "QLED Televisions"], ["large-screen-televisions", "Large-Screen Televisions"]]],
  ["home-theatre", "Home Theatre", "Sound you feel, not just hear.", "Surround systems, soundbars and subwoofers that complete the picture.", [
    ["surround-sound-systems", "Surround Sound Systems"], ["soundbars", "Soundbars"], ["subwoofers", "Subwoofers"], ["home-theatre-packages", "Home Theatre Packages"]]],
  ["accessories", "Accessories", "The finishing touches.", "Screens, mounts, cables and lighting — the details that turn a room into a cinema.", [
    ["projector-screens", "Projector Screens"], ["ceiling-mounts", "Ceiling Mounts"], ["tripods", "Tripods"], ["hdmi-cables", "HDMI Cables"], ["streaming-accessories", "Streaming Accessories"], ["remote-controls", "Remote Controls"], ["ambient-lighting", "Ambient Lighting"]]],
];

async function main() {
  if (await q1("SELECT 1 FROM categories LIMIT 1")) { console.log("Already seeded."); return; }
  let sort = 0;
  for (const [slug, name, tagline, description, kids] of TREE) {
    const parent = (await q1<{ id: number }>("INSERT INTO categories(slug, name, tagline, description, sort, seo_title, seo_description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [slug, name, tagline, description, sort++, `${name} South Africa`, `Shop ${name.toLowerCase()} online in South Africa. ${description}`]))!;
    for (const [s, n] of kids) await q("INSERT INTO categories(parent_id, slug, name, sort, seo_title, seo_description) VALUES ($1,$2,$3,$4,$5,$6)", [parent.id, s, n, sort++, `${n} South Africa`, `Buy ${n.toLowerCase()} online in South Africa, delivered to your door.`]);
  }

  // --- Suppliers. Only the sandbox is approved; real suppliers start in research / pending verification. ---
  const sandbox = (await q1<{ id: number }>(
    `INSERT INTO suppliers(slug, name, adapter, status, is_sample, priority, verification_notes, moq_notes, ships_to_za, shipping_methods, delivery_estimate, warranty_terms, api_availability, dropship_support)
     VALUES ('sandbox','Sandbox Supplier (simulated)','sandbox','approved',true,10,'Simulated supplier for demos and automated tests. Not a real company.','1 unit','yes','Simulated express (DDP), standard air (DAP), freight','Simulated: 7–14 business days express','Sample','Full (simulated): catalogue, stock, price, orders, tracking, cancel','Yes (simulated)') RETURNING id`))!;
  await q(
    `INSERT INTO suppliers(slug, name, adapter, status, priority, website, verification_notes, moq_notes, ships_to_za, shipping_methods, delivery_estimate, warranty_terms, api_availability, dropship_support) VALUES
     ('cjdropshipping','CJdropshipping','cjdropshipping','pending_verification',20,'https://cjdropshipping.com',
      'Established dropshipping agent with its own warehouses and sourcing. NOT yet verified by us: order a projector sample to a South African address and check build quality, the real native resolution/brightness, plug type and packaging before approving.',
      'No minimum — single-unit orders','unknown','CJPacket lines and express couriers; exact lines to South Africa must be confirmed with a freight quote','Unverified — confirm with a live freight quote to ZA','Varies per product; CJ after-sales/dispute policy applies. No South African manufacturer warranty unless the factory offers one.',
      'Public API 2.0: product search, variants, stock, freight calculation, order creation, tracking. Adapter is built but UNTESTED against a live account.','Yes — core business model; orders must be paid from a CJ wallet balance'),
     ('alibaba','Alibaba.com manufacturers','manual','research',40,'https://www.alibaba.com',
      'B2B marketplace of individual manufacturers and trading companies; quality depends entirely on the specific supplier. Shortlist Verified / audited suppliers with multi-year history, use Trade Assurance, and order samples.',
      'Set per supplier — often 1–50+ units; many sell paid samples','unknown','Arranged by each supplier: express couriers (DHL/FedEx/UPS), air or sea freight; DDP only if the supplier offers it','Per supplier quote','Per supplier — get it in writing, including who pays return freight',
      'The Alibaba.com Open Platform is aimed at sellers and approved ISVs. We could not confirm any generally available buyer-side API for automated ordering; the docs were unreachable from the build environment. Treat as NO automated ordering until proven otherwise.','Only where an individual supplier agrees to ship single units direct to customers (blind dropshipping) — negotiate per supplier'),
     ('aliexpress-ds','AliExpress Dropshipping (DS API)','manual','research',50,'https://www.aliexpress.com',
      'Consumer-facing marketplace; sellers vary widely. Higher risk of exaggerated projector specs ("4K" meaning 4K input). Vet per seller and test samples.',
      'No minimum','unknown','AliExpress Standard / Cainiao and seller-arranged couriers','Per listing','Usually limited; AliExpress buyer protection window',
      'A Dropshipping API exists (product, freight, order, tracking) but requires developer registration and approval. No adapter built yet.','Yes, once API access is approved'),
     ('sa-distributor','South African distributor (to be identified)','manual','research',30,NULL,
      'A local authorised distributor or importer holds stock in South Africa and carries the regulatory approvals (NRCS LOA, ICASA) and a local warranty. Strongly worth pursuing for televisions and other bulky or high-value items.',
      'Usually an account + minimum order, though some distributors dropship for online retailers','yes','Local couriers','Typically 2–7 business days nationwide','Local manufacturer / distributor warranty',
      'Rarely an API — usually a price list, stock feed or email ordering (use the manual workflow)','Some do — ask for a reseller dropship agreement')`);

  for (const item of SANDBOX_CATALOG) await importCatalogItem(sandbox.id, item, true);

  // --- Pricing rules (admin-editable) ---
  await q("INSERT INTO pricing_rules(scope, kind, value) VALUES ('global','percent',4500)");
  const acc = (await q1<{ id: number }>("SELECT id FROM categories WHERE slug='accessories'"))!;
  const tv = (await q1<{ id: number }>("SELECT id FROM categories WHERE slug='televisions'"))!;
  await q("INSERT INTO pricing_rules(scope, category_id, kind, value) VALUES ('category',$1,'percent',8000), ('category',$2,'percent',3000)", [acc.id, tv.id]);

  // Publish most of the sample catalogue; leave a few as 'imported' so the approval workflow can be tried.
  const hold = ["Studio Full HD", "Maestro Universal Remote", "Tremor 12″ Subwoofer", "Prism 65″ QLED"];
  await q("UPDATE products SET status='published', specs_verified=true, returns_info='' WHERE NOT (name = ANY($1))", [hold]);
  await q("UPDATE products SET featured=true WHERE name = ANY($1)", [["Lumière One 4K Laser", "Halo UST 4K Laser TV", "Ember Go Portable", "Noir 65″ OLED"]]);
  await q("UPDATE products SET best_seller=true WHERE name = ANY($1)", [["Nocturne 1080p (4K input)", "Atlas Full HD Smart", "Ember Go Portable", "Overture Soundbar 3.1", "Silverline 100″ Fixed-Frame Screen", "Canvas 55″ 4K Smart TV", "Afterglow Bias Lighting Kit", "Lumen Ultra High Speed HDMI Cable"]]);
  const promo = await q1<{ id: string }>("SELECT id FROM products WHERE name='Atlas Full HD Smart'");
  await q("UPDATE products SET promo_price_cents=379900, promo_ends = now() + interval '30 days' WHERE id=$1", [promo!.id]);

  await q("INSERT INTO discounts(code, kind, value, min_subtotal_cents) VALUES ('WELCOME10','percent',1000,100000)");
  const b = await q<{ id: string }>("SELECT id FROM products WHERE name = ANY($1)", [["Nocturne 1080p (4K input)", "Silverline 100″ Fixed-Frame Screen", "Overture Soundbar 3.1"]]);
  await q("INSERT INTO bundles(name, percent_off_bps, product_ids) VALUES ('Starter Cinema bundle', 500, $1::uuid[])", [b.map((x) => x.id)]);

  const email = (process.env.ADMIN_EMAIL || "admin@samovierooms.local").toLowerCase();
  await q("INSERT INTO users(email, password_hash, first_name, last_name, role) VALUES ($1,$2,'Store','Admin','admin')", [email, await hashPassword(process.env.ADMIN_PASSWORD || "ChangeMe!2026")]);
  console.log(`Seeded ${SANDBOX_CATALOG.length} sample products. Admin login: ${email}`);
}
main().then(() => pool().end()).catch((e) => { console.error(e); process.exit(1); });
