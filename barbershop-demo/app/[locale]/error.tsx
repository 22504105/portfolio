"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Container } from "@/components/layout/Container";
import { Button, ButtonLink } from "@/components/ui/Button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// What a visitor sees when a page fails. The failure itself is not shown: in
// production its message is replaced by the server anyway, and a stack trace
// helps nobody but an attacker. The digest is a reference that can be matched
// to the server log.
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error("Page error", error.digest ?? "");
  }, [error]);

  return (
    <Container className="py-section">
      <h1 className="type-h1 max-w-[16ch]">{t("title")}</h1>
      <p className="type-lead mt-6 max-w-xl text-muted">{t("body")}</p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button variant="signal" size="lg" onClick={reset}>
          {t("retry")}
        </Button>
        <ButtonLink href="/" variant="outline" size="lg">
          {t("home")}
        </ButtonLink>
      </div>
      {error.digest && <p className="type-small mt-10 tabular-nums text-muted">{t("reference", { code: error.digest })}</p>}
    </Container>
  );
}
