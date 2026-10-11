import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthPage } from "@/components/auth/AuthPage";
import { getMessages } from "@/lib/i18n";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function Page({ searchParams }: PageProps<"/login">) {
  const { auth } = getMessages();
  const params = await searchParams;
  const user = await currentUser();
  // Someone already signed in has no use for this page.
  if (user) redirect("/app/overview");

  return (
    <AuthPage title={auth.loginTitle}>
      <AuthForm
        mode="login"
        labels={auth}
        next={typeof params.next === "string" ? safeNext(params.next) : undefined}
        initialError={params.error === "link" ? "link" : undefined}
      />
    </AuthPage>
  );
}
