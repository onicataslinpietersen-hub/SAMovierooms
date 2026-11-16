import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
export const metadata = { title: "Shipping & Delivery Policy", description: "How SAMovierooms orders are fulfilled, shipped and delivered across South Africa, including delivery estimates and import duties." };
export default function Page() {
  return (
    <LegalPage title="Shipping & Delivery" intro="How your order gets from our supplier partners to your door, what it costs and how long it should take." updated="November 2026">
      {() => (<>
        <h2>How fulfilment works</h2>
        <p>SAMovierooms does not keep stock. When your payment is confirmed, we place your order with the third-party supplier that stocks your product. That supplier packs your order and ships it directly to you. Your contract is with SAMovierooms and we remain responsible to you for the order.</p>
        <p>An order with products from more than one supplier is delivered as separate shipments, each with its own delivery method, estimate and tracking number.</p>
        <h2>Where we deliver</h2>
        <p>We deliver to street addresses in all nine South African provinces. Couriers generally cannot deliver to PO boxes or private bags.</p>
        <h2>Delivery methods and cost</h2>
        <p>Delivery options are quoted for your specific basket and address, based on the product's weight and packed dimensions, the supplier's warehouse location and the carrier. The options and their prices are shown on each product page (choose your province) and again at checkout before you pay.</p>
        <h2>Delivery estimates</h2>
        <p>Each option shows an <strong>estimated</strong> delivery window in business days. The estimate adds together supplier handling, carrier transit, customs clearance and last-mile delivery to your area; outlying areas take longer.</p>
        <ul>
          <li>Estimates are not guaranteed delivery dates. Customs inspections, carrier delays and public holidays can extend them.</li>
          <li>Some options (for example sea freight for very large items) have estimated windows longer than 30 days. By choosing such an option at checkout you agree to that delivery period.</li>
          <li>If we cannot deliver within the estimated window you chose, or within 30 days where no longer period was agreed, you may cancel the delayed order on 7 days' written notice and receive a full refund.</li>
        </ul>
        <h2>Import duties and VAT</h2>
        <p>Many of our products are shipped to you from outside South Africa and are subject to customs duty and import VAT. Checkout tells you which of two arrangements applies to each delivery option:</p>
        <ul>
          <li><strong>Duties prepaid (DDP).</strong> The estimated duties and VAT are shown and added to your order total. You pay nothing further on delivery.</li>
          <li><strong>Duties on delivery (DAP).</strong> Duties and VAT are <em>not</em> included in what you pay us. The carrier or customs broker will contact you to pay them before delivery, and may add a clearance or disbursement fee. We show an estimate at checkout so you know what to expect; the final amount is determined by SARS and the carrier.</li>
        </ul>
        <p>Import VAT is calculated on the customs value of the goods plus 10%, plus any customs duty. If a parcel is refused or abandoned because duties are not paid, return and destruction costs charged to us may be deducted from your refund.</p>
        <h2>Tracking</h2>
        <p>We email you when your payment is confirmed, when your order ships (with the tracking number) and when it is delivered. You can follow progress at any time on your order page or via <Link href="/track">Track an order</Link>. We only show a status once it has been confirmed by our supplier or the carrier.</p>
        <h2>Damaged or missing parcels</h2>
        <p>Please inspect your parcel on delivery. If it arrives damaged, incomplete or not at all, <Link href="/contact">contact us</Link> as soon as possible — ideally within 48 hours of delivery and with photographs — so we can claim from the carrier and put it right. This does not limit your statutory rights.</p>
      </>)}
    </LegalPage>
  );
}
