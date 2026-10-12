"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { Button, buttonClass, Loading, Problem } from "@/components/ui/controls";
import { fill } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** What someone sees after following an invitation: which group it is for, and a way in. */
export function JoinScreen() {
  const { t, store, base, changed, notify } = useApp();
  const router = useRouter();
  const token = useSearchParams().get("t") ?? "";
  const { data: preview, error } = useLoad((current) => current.previewInvite(token), `invite:${token}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function join(claimMemberId?: string) {
    setBusy(claimMemberId ?? "new");
    setFailure(null);
    try {
      const groupId = await store.acceptInvite(token, claimMemberId);
      changed();
      notify(fill(t.join.joined, { group: preview?.groupName ?? "" }));
      router.replace(`${base}/groups/${groupId}`);
    } catch (caught) {
      setFailure(errorText(t, caught));
      setBusy(null);
    }
  }

  if (error) {
    // One answer for every kind of bad link, as on the server: nothing to learn by trying.
    return (
      <>
        <h1 className="type-title">{error === "not_found" ? t.join.badTitle : t.join.title}</h1>
        <p className="type-lead text-ink-muted mt-2">{error === "not_found" ? t.join.badBody : errorText(t, error)}</p>
        <Link href={`${base}/groups`} className={cn(buttonClass("secondary"), "mt-6")}>
          {t.group.toGroups}
        </Link>
      </>
    );
  }
  if (!preview) return <Loading label={t.common.loading} />;

  return (
    <>
      <h1 className="type-title">{t.join.title}</h1>
      <p className="type-lead text-ink-muted mt-2 break-words">{fill(t.join.lead, { group: preview.groupName })}</p>
      {failure && <Problem className="mt-4">{failure}</Problem>}

      <Button className="mt-6 w-full sm:w-auto" busy={busy === "new"} disabled={busy !== null} onClick={() => join()}>
        {t.join.asNew}
      </Button>

      {preview.guests.length > 0 && (
        <section aria-labelledby="join-claim" className="card mt-6 p-4 sm:p-5">
          <h2 id="join-claim" className="type-heading">
            {t.join.claimTitle}
          </h2>
          <p className="type-small text-ink-muted mt-1 mb-4">{t.join.claimHint}</p>
          <ul className="flex flex-col gap-2">
            {preview.guests.map((guest) => (
              <li key={guest.id}>
                <Button
                  variant="secondary"
                  className="w-full justify-start break-words"
                  busy={busy === guest.id}
                  disabled={busy !== null}
                  onClick={() => join(guest.id)}
                >
                  {fill(t.join.claim, { name: guest.name })}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
