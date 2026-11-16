import Link from "next/link";
import { BusinessDetails, LegalPage } from "@/components/LegalPage";
export const metadata = { title: "Terms & Conditions", description: "The terms that apply when you use the SAMovierooms website and buy from us." };
export default function Page() {
  return (
    <LegalPage title="Terms & Conditions" intro="The agreement between you and SAMovierooms when you use this website and place an order." updated="November 2026">
      {(s) => (<>
        <h2>1. About us</h2>
        <p>This website is operated by SAMovierooms. In terms of section 43 of the Electronic Communications and Transactions Act, our details are:</p>
        <BusinessDetails s={s} />
        <h2>2. How we sell</h2>
        <p>SAMovierooms is an online retailer. We do not hold stock: products are supplied and shipped directly to you by third-party suppliers that we select. You buy from, and pay, SAMovierooms; we are responsible to you for your order.</p>
        <h2>3. Products and descriptions</h2>
        <p>We take care to describe products accurately and to list specifications as provided by the supplier and checked by us. In particular, we state each display product's native resolution and distinguish it from the signals it can accept. Illustrations are representative and may differ slightly from the product delivered. If a product does not match its description you may return it under our <Link href="/returns-policy">Returns &amp; Refunds policy</Link>.</p>
        <h2>4. Prices and payment</h2>
        <ul>
          <li>Prices are in South African Rand (ZAR). Delivery charges and, where they are prepaid, estimated import duties and VAT are shown separately at checkout before you pay.</li>
          <li>Where a delivery option is “duties on delivery”, import duties and VAT are payable by you to the carrier and are not included in the amount you pay us.</li>
          <li>Payment is processed by our payment gateway. We do not store card details.</li>
          <li>If a product is listed at an obviously incorrect price through an error, we may cancel the order and refund you in full.</li>
        </ul>
        <h2>5. Orders</h2>
        <p>Before you pay, checkout shows a summary of your order, the total price and your delivery details so that you can review and correct them. An agreement of sale comes into effect when we confirm your payment by email. If our supplier cannot fulfil your order, we will tell you promptly and refund you in full.</p>
        <h2>6. Delivery</h2>
        <p>Delivery is governed by our <Link href="/shipping-policy">Shipping &amp; Delivery policy</Link>. Delivery windows are estimates. Risk in the goods passes to you when they are delivered to the address you gave us.</p>
        <h2>7. Cancellations, returns and warranty</h2>
        <p>Your cooling-off right, your rights when goods are defective and our warranty terms are set out in the <Link href="/returns-policy">Returns &amp; Refunds</Link> and <Link href="/warranty-policy">Warranty</Link> policies, which form part of these terms.</p>
        <h2>8. Your account</h2>
        <p>Keep your password confidential and tell us if you suspect unauthorised use of your account. You may check out as a guest.</p>
        <h2>9. Reviews</h2>
        <p>Reviews must be honest and about your own experience. We moderate reviews and may decline those that are abusive, misleading or unrelated to the product.</p>
        <h2>10. Privacy</h2>
        <p>We process personal information as described in our <Link href="/privacy-policy">Privacy Policy</Link>.</p>
        <h2>11. Liability</h2>
        <p>Nothing in these terms limits or excludes any right you have under the Consumer Protection Act, the Electronic Communications and Transactions Act or any other law that cannot lawfully be excluded. Subject to that, we are not liable for indirect or consequential loss arising from use of the website or products.</p>
        <h2>12. Complaints and disputes</h2>
        <p>Please <Link href="/contact">contact us</Link> first so we can resolve any problem. If you are not satisfied you may approach the Consumer Goods and Services Ombud or the National Consumer Commission.</p>
        <h2>13. Governing law</h2>
        <p>These terms are governed by the laws of the Republic of South Africa.</p>
      </>)}
    </LegalPage>
  );
}
