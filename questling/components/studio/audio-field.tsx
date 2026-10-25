"use client";

import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useStudio, type MediaRefusal } from "@/lib/client/studio";
import { fill } from "@/lib/i18n";
import { Label } from "./builder-inspector";

// A recording for a scene or a word: pick one of the teacher's, upload a new one (MP3, M4A or WAV; the
// server checks what it really is), listen to it, replace it, take it off. Taking it off also deletes
// the file when nothing else uses it (a published version keeps its recordings). The demo studio has no
// server to keep files, and says so.

const ACCEPT = "audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,.mp3,.m4a,.wav";
const CLIENT_LIMIT = 2 * 1024 * 1024;

const seconds = (ms: number) => (ms / 1000).toFixed(1);

export function AudioField({ value, onChange }: { value: string | undefined; onChange: (id: string | undefined) => void }) {
  const { t, facts, media } = useStudio();
  const a = t.builder.audio;
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<MediaRefusal | null>(null);
  const [pending, start] = useTransition();
  const current = value ? facts.media.find((m) => m.id === value) : undefined;

  const upload = (file: File | undefined) => {
    if (!file || !media) return;
    setError(null);
    if (file.size > CLIENT_LIMIT) return setError("too_large");
    start(async () => {
      const result = await media.upload(file);
      if (!result.ok) return setError(result.reason);
      const previous = value;
      onChange(result.item.id);
      // The replaced recording goes too, unless something else still uses it.
      if (previous && previous !== result.item.id) await media.remove(previous);
    });
  };
  const takeOff = () => {
    const previous = value;
    onChange(undefined);
    if (previous && media) start(async () => void (await media.remove(previous)));
  };

  return (
    <div className="flex flex-col gap-1.5" data-audio-field>
      <Label note={a.note}>{a.label}</Label>
      {!media ? (
        <p className="font-caption text-caption text-text-muted" data-audio-demo>
          {a.demo}
        </p>
      ) : (
        <>
          {current ? (
            <div className="bg-surface-container-low flex flex-col gap-2 rounded-lg p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-label-sm text-label-sm text-text-ivory flex min-w-0 items-center gap-1.5">
                  <Icon name="graphic_eq" className="text-secondary text-[16px]" />
                  <span className="truncate">{current.name}</span>
                </span>
                <span className="font-caption text-caption text-text-muted shrink-0">
                  {fill(a.length, { s: seconds(current.durationMs) })}
                </span>
              </div>
              {/* The browser's own player: the teacher hears exactly the file the students will. */}
              <audio controls preload="none" src={current.url} className="h-8 w-full" data-audio-preview />
            </div>
          ) : value ? (
            <p className="font-caption text-caption text-status-error">{a.missing}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {facts.media.length && !current ? (
              <select
                aria-label={a.pick}
                className="bg-surface-container-lowest text-text-ivory font-label-sm text-label-sm rounded-lg px-2 py-1.5"
                value=""
                onChange={(e) => e.target.value && onChange(e.target.value)}
              >
                <option value="">{a.pick}</option>
                {facts.media.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {seconds(m.durationMs)} s
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => input.current?.click()}
              data-action="upload-audio"
              className="bg-surface-container-high text-text-ivory font-label-sm text-label-sm flex items-center gap-1 rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              <Icon name="upload" className="text-primary text-[16px]" />
              {pending ? a.uploading : current ? a.replace : a.upload}
            </button>
            {value ? (
              <button
                type="button"
                disabled={pending}
                onClick={takeOff}
                data-action="remove-audio"
                className="text-status-error font-label-sm text-label-sm flex items-center gap-1 rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                <Icon name="delete" className="text-[16px]" />
                {a.remove}
              </button>
            ) : null}
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="hidden"
              aria-label={a.upload}
              onChange={(e) => (upload(e.target.files?.[0]), (e.target.value = ""))}
            />
          </div>
          {error ? (
            <p role="alert" className="font-caption text-caption text-status-error" data-audio-error={error}>
              {a.errors[error]}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
