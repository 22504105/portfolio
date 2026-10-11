import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthPage } from "@/components/auth/AuthPage";
import { getMessages } from "@/lib/i18n";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New password", robots: { index: false } };

export default async function Page({ searchParams }: PageProps<"/update-password">) {
  const { auth } = getMessages();
  const params = await searchParams;
  const user = await currentUser();
  // Reached from the link in a reset email, which signs the user in. Without that there is nothing to change.
  if (!user) redirect("/reset-password");

  return (
    <AuthPage title={auth.updateTitle}>
      <AuthForm
        mode="update"
        labels={auth}
        next={typeof params.next === "string" ? safeNext(params.next) : undefined}
        initialError={params.error === "link" ? "link" : undefined}
      />
    </AuthPage>
  );
}
