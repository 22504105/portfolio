import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { updatePassword } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { AccountsUnavailable, AuthPage } from "@/components/auth/AuthPage";
import { Link } from "@/i18n/navigation";
import { accountsAvailable, homeFor, requireUser } from "@/lib/auth";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Reached from the account page, and from the password-reset email, which
// signs the user in on the way here.
export default async function PasswordPage({ params }: PageProps<"/[locale]/account/password">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("auth");
  if (!accountsAvailable()) return <AccountsUnavailable eyebrow={t("eyebrow")} title={t("unavailableTitle")} body={t("unavailableBody")} />;

  const user = await requireUser(locale, "/account/password");
  const nav = await getTranslations("nav");

  return (
    <AuthPage
      eyebrow={t("eyebrow")}
      title={t("newPasswordTitle")}
      footer={
        <p>
          <Link href={homeFor(user)} className="text-fg underline underline-offset-4 transition-colors duration-(--duration-fast) hover:text-signal">
            <span aria-hidden="true">← </span>
            {user.role === "barber" && user.barberId ? nav("workspace") : nav("account")}
          </Link>
        </p>
      }
    >
      <AuthForm
        action={updatePassword}
        fields={[{ name: "password", label: t("newPassword"), type: "password", autoComplete: "new-password", hint: t("passwordHint") }]}
        submit={t("savePassword")}
        working={t("working")}
        saved={t("passwordSaved")}
        errors={{ weak: t("errors.weak"), failed: t("errors.failed") }}
      />
    </AuthPage>
  );
}
