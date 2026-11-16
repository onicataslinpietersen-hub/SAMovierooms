import { AuthShell } from "@/components/AuthShell";
import { TrackForm } from "@/components/SimpleForms";
import Link from "next/link";
export const metadata = { title: "Track your order", description: "Track your SAMovierooms order with your order number and email address." };
export default function Track() {
  return <AuthShell eyebrow="Order tracking" title="Where is my order?" footer={<>Have an account? <Link href="/account/orders" className="link">See all your orders</Link></>}><TrackForm /></AuthShell>;
}
