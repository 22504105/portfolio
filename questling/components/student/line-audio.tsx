"use client";

import { useAudioNotice, useLineAudio, type Availability, type PlayState } from "@/lib/client/audio";
import { useStudent } from "@/lib/client/student";

// A button that plays one English line (lib/client/audio.ts), in the look of the screen it is on: the
// screen passes its own classes and contents. Disabled when nothing could be heard; while loading or
// playing it says so (aria-busy / aria-pressed) and its icon pulses; pressing again stops it.

export function LineAudioButton({
  text,
  src,
  label,
  className,
  children,
  action,
}: {
  text: string;
  src?: string | null;
  label?: string;
  className: string;
  children: React.ReactNode | ((audio: { availability: Availability; state: PlayState }) => React.ReactNode);
  action?: string;
}) {
  const { availability, state, play } = useLineAudio(text, src);
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={state === "loading" || undefined}
      aria-pressed={state === "playing" || state === "loading"}
      disabled={availability === "none"}
      onClick={play}
      data-action={action}
      data-audio={availability}
      data-audio-state={state}
      className={`${className} ${state === "loading" || state === "playing" ? "[&_.material-symbols-outlined]:animate-pulse [&_svg]:animate-pulse" : ""}`}
    >
      {typeof children === "function" ? children({ availability, state }) : children}
    </button>
  );
}

/** The one-line notice for sound (no voice on the device, sound switched off, a recording that failed). */
export function AudioNotice() {
  const { t } = useStudent();
  const notice = useAudioNotice();
  if (!notice) return null;
  return (
    <div
      role="status"
      data-audio-notice={notice}
      className="bg-surface-container-highest text-text-ivory font-caption text-caption pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[90vw] rounded-full px-4 py-2 text-center shadow-lg"
    >
      {t.audio[notice]}
    </div>
  );
}
