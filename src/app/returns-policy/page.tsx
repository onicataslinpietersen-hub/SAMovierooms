import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
export const metadata = { title: "Returns & Refunds Policy", description: "Your rights to cancel, return and be refunded for SAMovierooms orders under the ECT Act and Consumer Protection Act." };
export default function Page() {
  return (
    <LegalPage title="Returns & Refunds" intro="Your rights when you change your mind, when something arrives faulty, and how refunds are paid." updated="November 2026">
      {(s) => (<>
        <h2>Change of mind: the cooling-off period</h2>
        <p>Because you buy from us online, section 44 of the Electronic Communications and Transactions Act lets you cancel your purchase, without giving a reason and without penalty, within <strong>7 days after you receive the goods</strong>.{s.returns_window_days > 7 ? ` We extend this to ${s.returns_window_days} days.` : ""}</p>
        <ul>
          <li>Tell us in writing within that period via <Link href="/contact">our contact page</Link>, quoting your order number.</li>
          <li>Return the goods unused, complete and in their original packaging.</li>
          <li>The only charge you carry is the <strong>direct cost of returning the goods</strong>. Because products may need to go back to a supplier abroad, we will tell you the return address and likely cost before you send anything.</li>
          <li>We refund the full amount you paid us within 30 days of the cancellation.</li>
        </ul>
        <p>The cooling-off right does not apply to certain goods listed in section 42 of the Act — for example goods made to your own specifications, or audio/video recordings and software that you have unsealed.</p>
        <h2>Faulty, unsafe or incorrect goods</h2>
        <p>Under section 56 of the Consumer Protection Act every product carries an implied warranty of quality. If, within <strong>6 months of delivery</strong>, a product is defective, unsafe or not fit for its ordinary purpose, you may return it to us <strong>at our risk and expense</strong> and choose to have it repaired, replaced or refunded. If a repair fails within 3 months, we will replace the product or refund you.</p>
        <p>If we send the wrong product, or it does not match its description on our site, the same applies: we cover the return and you choose a replacement or refund.</p>
        <p>The implied warranty does not cover damage caused by misuse, accidents, power surges, unauthorised repairs or normal wear and tear.</p>
        <h2>How to start a return</h2>
        <ul>
          <li><Link href="/contact">Contact us</Link> with your order number, what is wrong and, for faults or damage, photos or a short video.</li>
          <li>We confirm the return address (which may be our supplier's or a local collection point) and, where we are paying, arrange or reimburse the shipping.</li>
          <li>Please do not post anything back before we have confirmed the address — parcels sent to the wrong place may be lost.</li>
        </ul>
        <h2>Refunds</h2>
        <p>Refunds are paid to the original payment method. Once we process a refund it can take a few business days to reflect, depending on your bank. For cooling-off returns we refund the price and original delivery charge; duties and VAT you paid directly to a carrier or to SARS are not ours to refund, though you may be able to reclaim them from SARS on re-export.</p>
        <h2>Cancelling before dispatch</h2>
        <p>You can ask us to cancel an order at any time before it ships. If the supplier has not yet dispatched it, we cancel it and refund you in full. Once a parcel has shipped it can no longer be cancelled and the returns process above applies.</p>
      </>)}
    </LegalPage>
  );
}
