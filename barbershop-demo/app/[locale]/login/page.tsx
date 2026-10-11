import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { signIn } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { AccountsUnavailable, AuthPage } from "@/components/auth/AuthPage";
import { Link, redirect } from "@/i18n/navigation";
import { accountsAvailable, getSessionUser, homeFor, safeNext } from "@/lib/auth";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const LINK = "text-fg underline underline-offset-4 transition-colors duration-(--duration-fast) hover:text-signal";

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("auth");
  if (!accountsAvailable()) return <AccountsUnavailable eyebrow={t("eyebrow")} title={t("unavailableTitle")} body={t("unavailableBody")} />;

  const query = await searchParams;
  const next = safeNext(first(query.next), "");
  const user = await getSessionUser();
  if (user) redirect({ href: next || homeFor(user), locale });

  return (
    <AuthPage
      eyebrow={t("eyebrow")}
      title={t("signInTitle")}
      lead={first(query.link) === "invalid" ? t("linkInvalid") : t("signInLead")}
      footer={
        <>
          <p>
            {t("noAccount")}{" "}
            <Link href="/register" className={LINK}>
              {t("createAccount")}
            </Link>
          </p>
          <p>
            <Link href="/forgot-password" className={LINK}>
              {t("forgot")}
            </Link>
          </p>
        </>
      }
    >
      <AuthForm
        action={signIn}
        hidden={{ locale, next }}
        fields={[
          { name: "email", label: t("email"), type: "email", autoComplete: "email" },
          { name: "password", label: t("password"), type: "password", autoComplete: "current-password" },
        ]}
        submit={t("signIn")}
        working={t("working")}
        errors={{ credentials: t("errors.credentials"), throttled: t("errors.throttled"), failed: t("errors.failed") }}
      />
    </AuthPage>
  );
}
