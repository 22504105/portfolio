"use client";

import { Clock, Copy, Link2, Send, UserPlus, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorText, useApp } from "@/components/app/AppProvider";
import { Button, buttonClass, inputClass, Problem } from "@/components/ui/controls";
import { QrCode } from "@/components/ui/QrCode";
import type { Group, Invite } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDay } from "./parts";

type InviteSheetProps = {
  group: Group;
  open: boolean;
  onClose: () => void;
  /** The invitation made in this visit, kept by the screen so that closing the sheet does not lose a link shown once. */
  invite: Invite | null;
  onInvite: (invite: Invite | null) => void;
  /** Takes the person to where someone is added by name. */
  onGuest: () => void;
};

/**
 * Stitch's invitation sheet: it rises from the bottom of a phone and stands
 * in the middle of a wide screen. Inside: the link with the button that
 * copies it, sharing it in Telegram, its QR code, and the way to add someone
 * by name instead. In the demo, which has nobody to invite, it says so.
 *
 * It is the browser's own dialog: focus stays inside it, Escape closes it,
 * and the page behind is out of reach while it is open.
 */
export function InviteSheet({ group, open, onClose, invite, onInvite, onGuest }: InviteSheetProps) {
  const { t, store, base, locale, account, notify } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const sheet = dialog.current;
    if (!sheet) return;
    if (open && !sheet.open) sheet.showModal();
    if (!open && sheet.open) sheet.close();
  }, [open]);

  const link =
    invite &&
    (account?.bot ? `https://t.me/${account.bot}?startapp=${invite.token}` : `${window.location.origin}${base}/join?t=${invite.token}`);

  async function act(work: () => Promise<void>) {
    setProblem(null);
    setBusy(true);
    try {
      await work();
    } catch (caught) {
      setProblem(errorText(t, caught));
    }
    setBusy(false);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="invite-title"
      onClose={onClose}
      // A tap on the dimmed page around the sheet closes it; one inside does not.
      onClick={(event) => event.target === dialog.current && onClose()}
      className="bg-surface text-ink fixed inset-x-0 top-auto bottom-0 mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] p-0 shadow-[0_-12px_40px_rgb(0_0_0/0.25)] backdrop:bg-black/50 sm:inset-0 sm:m-auto sm:h-fit sm:rounded-[28px]"
    >
      <div className="flex flex-col gap-4 p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <span aria-hidden="true" className="bg-line mx-auto -mt-1.5 h-1 w-10 rounded-full sm:hidden" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-primary flex items-center gap-1.5 text-[0.8125rem] leading-5 font-medium">
              <UsersRound aria-hidden="true" className="size-4" />
              {t.people.inviteSub}
            </p>
            <h2 id="invite-title" className="type-title break-words">
              {group.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="bg-surface-2 text-ink hover:bg-accent-soft inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {store.kind === "demo" ? (
          <p className="type-small bg-surface-2 text-ink-muted rounded-card p-4">{t.people.inviteDemo}</p>
        ) : (
          <>
            <p className="type-small text-ink-muted">{t.people.inviteHint}</p>
            {invite && link ? (
              <>
                {/* The link on its own panel with the button that copies it. */}
                <div className="bg-surface-2 rounded-card flex flex-col gap-2.5 p-3.5">
                  <p className="text-ink-muted flex items-start gap-1.5 text-[0.8125rem] leading-5">
                    <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {fill(t.people.inviteExpires, { date: formatDay(invite.expiresAt, locale, true), n: invite.maxUses })}
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      aria-label={t.people.inviteLink}
                      className={cn(inputClass, "type-small")}
                      value={link}
                      onFocus={(event) => event.target.select()}
                    />
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigator.clipboard.writeText(link).then(
                          () => notify(t.people.inviteCopied),
                          // No clipboard here: the link is in the box beside the button, to be copied by hand.
                          () => setProblem(null),
                        )
                      }
                    >
                      <Copy aria-hidden="true" className="size-4" />
                      {t.people.inviteCopy}
                    </Button>
                  </div>
                </div>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(fill(t.people.inviteText, { group: group.name }))}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonClass("primary"), "h-13 w-full")}
                >
                  <Send aria-hidden="true" className="size-5" />
                  {t.people.inviteShare}
                </a>
                <QrCode value={link} label={t.people.inviteQr} className="border-line mx-auto size-44 rounded-[14px] border" />
              </>
            ) : (
              <Button className="h-13 w-full" busy={busy} onClick={() => act(async () => onInvite(await store.createInvite(group.id)))}>
                <Link2 aria-hidden="true" className="size-5" />
                {t.people.inviteCreate}
              </Button>
            )}
            {problem && <Problem>{problem}</Problem>}
            <Button
              variant="ghost"
              small
              className="self-start"
              onClick={() =>
                act(async () => {
                  const revoked = await store.revokeInvites(group.id);
                  onInvite(null);
                  notify(fill(t.people.inviteRevoked, { n: revoked }));
                })
              }
            >
              {t.people.inviteRevoke}
            </Button>
          </>
        )}

        <div className="bg-surface-2 rounded-card flex items-center gap-3 p-3.5">
          <span aria-hidden="true" className="bg-surface text-primary flex size-11 shrink-0 items-center justify-center rounded-[12px]">
            <UserPlus className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t.people.guestRow}</p>
            <p className="text-ink-muted text-[0.8125rem] leading-5">{t.people.guestRowHint}</p>
          </div>
          <Button variant="secondary" small onClick={onGuest}>
            {t.people.add}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
