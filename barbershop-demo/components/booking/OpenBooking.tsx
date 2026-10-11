"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { openManageLink } from "@/app/actions/booking";
import { useRouter } from "@/i18n/navigation";
import { looksLikeToken } from "@/lib/booking/link-token";
import { useLinkToken } from "@/lib/use-link-token";

// Where "view or change my booking" in an email lands. It trades the token in
// the link for a short session cookie and moves on to the booking itself.
// Opening the link changes nothing about the booking.
export function OpenBooking() {
  const t = useTranslations("booking");
  const router = useRouter();
  const token = useLinkToken();
  const started = useRef(false);

  useEffect(() => {
    if (token === null || started.current) return;
    started.current = true;

    const invalid = () => router.replace({ pathname: "/booking/manage", query: { link: "invalid" } });
    if (!looksLikeToken(token)) return invalid();
    openManageLink(token).then((opened) => (opened ? router.replace("/booking/manage") : invalid()), invalid);
  }, [token, router]);

  return (
    <div role="status">
      <h1 className="type-h1 max-w-[16ch]">{t("manage.opening")}</h1>
      <noscript>
        <p className="type-body mt-6 max-w-xl">{t("confirm.needsScript")}</p>
      </noscript>
    </div>
  );
}
