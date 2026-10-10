import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requestPasswordReset } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { AccountsUnavailable, AuthPage } from "@/components/auth/AuthPage";
import { Link } from "@/i18n/navigation";
import { accountsAvailable } from "@/lib/auth";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ForgotPasswordPage({ params }: PageProps<"/[locale]/forgot-password">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("auth");
  if (!accountsAvailable()) return <AccountsUnavailable eyebrow={t("eyebrow")} title={t("unavailableTitle")} body={t("unavailableBody")} />;

  return (
    <AuthPage
      eyebrow={t("eyebrow")}
      title={t("forgotTitle")}
      lead={t("forgotLead")}
      footer={
        <p>
          <Link href="/login" className="text-fg underline underline-offset-4 transition-colors duration-(--duration-fast) hover:text-signal">
            {t("backToSignIn")}
          </Link>
        </p>
      }
    >
      <AuthForm
        action={requestPasswordReset}
        hidden={{ locale }}
        fields={[{ name: "email", label: t("email"), type: "email", autoComplete: "email" }]}
        submit={t("sendReset")}
        working={t("working")}
        errors={{ invalid: t("errors.invalid"), throttled: t("errors.throttled"), failed: t("errors.failed") }}
        done={
          <>
            <h2 className="type-h2">{t("checkEmailTitle")}</h2>
            <p className="type-lead mt-4 max-w-xl text-muted">{t("resetSentBody")}</p>
          </>
        }
      />
    </AuthPage>
  );
}
