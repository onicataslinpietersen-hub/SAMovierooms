import Link from "next/link";
import { BusinessDetails, LegalPage } from "@/components/LegalPage";
export const metadata = { title: "Privacy Policy", description: "How SAMovierooms collects, uses and protects your personal information under POPIA." };
export default function Page() {
  return (
    <LegalPage title="Privacy Policy" intro="How we collect, use, share and protect your personal information, in line with the Protection of Personal Information Act (POPIA)." updated="November 2026">
      {(s) => (<>
        <h2>Who is responsible for your information</h2>
        <p>SAMovierooms is the responsible party for personal information collected through this website.</p>
        <BusinessDetails s={s} />
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account and contact details:</strong> name, email address, phone number, password (stored only as a one-way hash).</li>
          <li><strong>Order details:</strong> delivery address, products ordered, order and payment status, delivery tracking.</li>
          <li><strong>Support messages and reviews</strong> you send us.</li>
          <li><strong>Technical data:</strong> essential cookies that keep you signed in and remember your cart; analytics and advertising cookies only if you consent.</li>
        </ul>
        <p>We do <strong>not</strong> collect or store your card number. Card details are entered on our payment gateway's secure page and never reach our servers.</p>
        <h2>Why we use it</h2>
        <ul>
          <li>To conclude and perform your purchase: process payment, fulfil and deliver your order, handle returns and warranty claims.</li>
          <li>To communicate with you about your order and answer support requests.</li>
          <li>To comply with legal obligations such as tax and consumer-protection record keeping.</li>
          <li>To send marketing emails, only if you have opted in. Every email has an unsubscribe link.</li>
          <li>To improve and secure the website.</li>
        </ul>
        <h2>Who we share it with</h2>
        <ul>
          <li><strong>Supplier partners</strong> who fulfil your order receive your name, delivery address, phone number and the products ordered.</li>
          <li><strong>Couriers and customs brokers</strong> receive the details needed to deliver your parcel and clear it through customs.</li>
          <li><strong>Our payment gateway</strong> processes your payment.</li>
          <li><strong>Service providers</strong> that host the website and send our emails, under confidentiality obligations.</li>
        </ul>
        <p>We do not sell your personal information.</p>
        <h2>Transfers outside South Africa</h2>
        <p>Some supplier partners and carriers are located outside South Africa, including in countries whose data-protection laws may differ from POPIA. We transfer only the information needed to fulfil and deliver your order; the transfer is necessary to perform the contract you conclude with us when you place an order.</p>
        <h2>How long we keep it</h2>
        <p>We keep order records for as long as required by tax and consumer law, and account information until you ask us to delete your account, after which we retain only what the law requires.</p>
        <h2>Security</h2>
        <p>We use encryption in transit, hashed passwords, access controls and encrypted storage of supplier credentials. If a security compromise affects your personal information we will notify you and the Information Regulator as POPIA requires.</p>
        <h2>Your rights</h2>
        <p>You may ask us to confirm what personal information we hold about you, to correct or delete it, and to stop using it for direct marketing. You may withdraw consent at any time. To exercise these rights, <Link href="/contact">contact us</Link>{s.information_officer ? <> or our Information Officer, {s.information_officer}</> : null}.</p>
        <p>You also have the right to lodge a complaint with the Information Regulator (South Africa) — see <a href="https://inforegulator.org.za" rel="noopener noreferrer" target="_blank">inforegulator.org.za</a>.</p>
        <h2>Cookies</h2>
        <p>Essential cookies and local storage keep you signed in and remember your cart and delivery province. Analytics and advertising cookies are loaded only after you choose “Accept all” in the cookie banner; choosing “Essential only” keeps them off.</p>
      </>)}
    </LegalPage>
  );
}
