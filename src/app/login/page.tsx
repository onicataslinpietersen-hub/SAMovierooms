import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/SimpleForms";
import { getUser } from "@/lib/auth";
export const metadata = { title: "Sign in", robots: { index: false } };
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next ?? "/account";
  if (await getUser()) redirect("/account");
  return <AuthShell eyebrow="Welcome back" title="Sign in" footer={<>New to SAMovierooms? <Link href={`/register?next=${encodeURIComponent(next)}`} className="link">Create an account</Link></>}><LoginForm next={next} /></AuthShell>;
}
