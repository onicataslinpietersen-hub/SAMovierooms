import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
export const metadata = { title: "Warranty Policy", description: "Warranty cover on SAMovierooms products: the Consumer Protection Act implied warranty and supplier warranties." };
export default function Page() {
  return (
    <LegalPage title="Warranty" intro="What is covered, for how long, and who to speak to when something goes wrong." updated="November 2026">
      {() => (<>
        <h2>Your statutory warranty (6 months)</h2>
        <p>Every product we sell is covered by the Consumer Protection Act's implied warranty of quality for 6 months from delivery. If the product is defective within that time you may choose a repair, a replacement or a refund, and we carry the cost of returning it. See our <Link href="/returns-policy">Returns &amp; Refunds policy</Link>.</p>
        <h2>Supplier and manufacturer warranties</h2>
        <p>Some products carry an additional warranty from the supplier or manufacturer. Where one applies, its length and terms are stated on the product page under “Warranty”. These warranties are in addition to, not instead of, your statutory rights.</p>
        <p>Please note that products shipped from abroad may not be covered by a South African manufacturer service network. Where a supplier warranty requires the product to be sent abroad, we will tell you what is involved and what it would cost before you decide. If no additional warranty is listed on the product page, only the statutory warranty applies.</p>
        <h2>Claims go through us</h2>
        <p>You never need to deal with our suppliers directly. To make a claim, <Link href="/contact">contact us</Link> with your order number and a description of the fault, with photos or video where possible. We will assess the claim and arrange the repair, replacement or refund.</p>
        <h2>What is not covered</h2>
        <ul>
          <li>Damage from misuse, accidents, liquid, power surges or load-shedding-related surges, or use outside the stated electrical specifications.</li>
          <li>Repairs or modifications by anyone not authorised by us or the manufacturer.</li>
          <li>Consumable parts and normal wear and tear.</li>
        </ul>
        <h2>Electrical compatibility</h2>
        <p>South African mains supply is 230 V at 50 Hz. Each product page states the product's input voltage and plug type where confirmed. If a plug type is not confirmed, a plug adapter may be required. We recommend surge protection for all home cinema equipment.</p>
      </>)}
    </LegalPage>
  );
}
