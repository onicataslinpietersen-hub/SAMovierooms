import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { ForgotForm } from "@/components/SimpleForms";
export const metadata = { title: "Reset your password", robots: { index: false } };
export default function Forgot() {
  return <AuthShell eyebrow="Password recovery" title="Forgot your password?" footer={<Link href="/login" className="link">Back to sign in</Link>}><p className="mb-6 text-sm text-sand">Enter your email and we will send you a link to choose a new password.</p><ForgotForm /></AuthShell>;
}
