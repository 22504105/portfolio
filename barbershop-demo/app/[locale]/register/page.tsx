import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { signUp } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { AccountsUnavailable, AuthPage } from "@/components/auth/AuthPage";
import { Link, redirect } from "@/i18n/navigation";
import { accountsAvailable, getSessionUser, homeFor } from "@/lib/auth";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const LINK = "text-fg underline underline-offset-4 transition-colors duration-(--duration-fast) hover:text-signal";

export default async function RegisterPage({ params }: PageProps<"/[locale]/register">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("auth");
  if (!accountsAvailable()) return <AccountsUnavailable eyebrow={t("eyebrow")} title={t("unavailableTitle")} body={t("unavailableBody")} />;

  const user = await getSessionUser();
  if (user) redirect({ href: homeFor(user), locale });

  return (
    <AuthPage
      eyebrow={t("eyebrow")}
      title={t("signUpTitle")}
      lead={t("signUpLead")}
      footer={
        <p>
          {t("haveAccount")}{" "}
          <Link href="/login" className={LINK}>
            {t("signIn")}
          </Link>
        </p>
      }
    >
      <AuthForm
        action={signUp}
        hidden={{ locale }}
        fields={[
          { name: "name", label: t("name"), type: "text", autoComplete: "name" },
          { name: "email", label: t("email"), type: "email", autoComplete: "email" },
          { name: "password", label: t("password"), type: "password", autoComplete: "new-password", hint: t("passwordHint") },
        ]}
        submit={t("createAccount")}
        working={t("working")}
        errors={{ invalid: t("errors.invalid"), weak: t("errors.weak"), throttled: t("errors.throttled"), failed: t("errors.failed") }}
        done={
          <>
            <h2 className="type-h2">{t("checkEmailTitle")}</h2>
            <p className="type-lead mt-4 max-w-xl text-muted">{t("checkEmailBody")}</p>
          </>
        }
      />
    </AuthPage>
  );
}
