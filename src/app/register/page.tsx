import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "@/components/SimpleForms";
import { getUser } from "@/lib/auth";
export const metadata = { title: "Create an account", robots: { index: false } };
export default async function Register({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next ?? "/account";
  if (await getUser()) redirect("/account");
  return <AuthShell eyebrow="Join SAMovierooms" title="Create your account" footer={<>Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="link">Sign in</Link></>}><RegisterForm next={next} /></AuthShell>;
}
