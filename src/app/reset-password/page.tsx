import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { ResetForm } from "@/components/SimpleForms";
export const metadata = { title: "Choose a new password", robots: { index: false } };
export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return <AuthShell eyebrow="Password recovery" title="Choose a new password" footer={<Link href="/forgot-password" className="link">Request a new link</Link>}>{token ? <ResetForm token={token} /> : <p className="text-sm text-bad">This reset link is missing its token. Please request a new one.</p>}</AuthShell>;
}
