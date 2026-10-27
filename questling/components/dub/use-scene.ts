"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DubContent, DubLine } from "@/lib/dub/model";
import { follow, linesAt, takeAt, type TrackStep } from "@/lib/dub/sync";

// Playing a voice-acting scene over one <video>: a single line (at normal or slower speed), or the
// whole trimmed scene, either as it is or with the student's character replaced by their takes.
// Takes are separate audio elements started at their line's time and kept in step with the video
// (corrected when they drift by more than 150 ms). While a take plays, the video is silent — the
// original's voice and its music are mixed in one track, so muting it silences both; when the
// teacher gave a background track, it plays in those moments instead.

export type Playing = { kind: "line"; line: string } | { kind: "scene"; mine: boolean } | null;

function apply(media: HTMLMediaElement, step: TrackStep) {
  if (!step) return;
  if ("pause" in step) media.pause();
  else if ("seek" in step) media.currentTime = step.seek;
  else {
    media.currentTime = step.play;
    void media.play().catch(() => {});
  }
}

export function useScene(content: DubContent, opts: { takes?: Map<string, string>; background?: string | null; role?: string }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const audios = useRef(new Map<string, HTMLAudioElement>());
  const background = useRef<HTMLAudioElement | null>(null);
  const frame = useRef(0);
  const [playing, setPlaying] = useState<Playing>(null);
  const [time, setTime] = useState(content.trim.start);

  // One audio element per take (and the background), made when the links are known.
  useEffect(() => {
    const made = new Map<string, HTMLAudioElement>();
    for (const [line, url] of opts.takes ?? []) {
      const audio = new Audio(url);
      audio.preload = "auto";
      made.set(line, audio);
    }
    audios.current = made;
    background.current = opts.background ? Object.assign(new Audio(opts.background), { preload: "auto", loop: false }) : null;
    return () => {
      made.forEach((a) => a.pause());
      background.current?.pause();
    };
  }, [opts.takes, opts.background]);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    video.current?.pause();
    if (video.current) {
      video.current.muted = false;
      video.current.playbackRate = 1;
    }
    audios.current.forEach((a) => a.pause());
    background.current?.pause();
    setPlaying(null);
  }, []);

  useEffect(() => stop, [stop]);

  /** One line of the original, from its start to its end, at `rate` (1, 0.75 or 0.5; pitch is kept where the browser can). */
  const playLine = useCallback(
    async (line: DubLine, rate = 1, muted = false) => {
      const v = video.current;
      if (!v) return;
      stop();
      v.currentTime = line.start / 1000;
      v.playbackRate = rate;
      v.muted = muted;
      setPlaying({ kind: "line", line: line.id });
      try {
        await v.play();
      } catch {
        setPlaying(null);
        return;
      }
      const tick = () => {
        setTime(v.currentTime * 1000);
        if (v.paused || v.currentTime * 1000 >= line.end) return stop();
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [stop],
  );

  /** The whole trimmed scene; with `mine`, the role's lines are the student's takes. */
  const playScene = useCallback(
    async (mine: boolean) => {
      const v = video.current;
      if (!v) return;
      stop();
      v.currentTime = content.trim.start / 1000;
      setPlaying({ kind: "scene", mine });
      try {
        await v.play();
      } catch {
        setPlaying(null);
        return;
      }
      const own = mine ? content.lines.filter((l) => l.speaker === opts.role && audios.current.has(l.id)) : [];
      const tick = () => {
        const t = v.currentTime * 1000;
        setTime(t);
        if (v.paused || v.ended || t >= content.trim.end) return stop();
        let replaced = false;
        for (const line of own) {
          const audio = audios.current.get(line.id)!;
          const { on, want } = takeAt(line, t);
          replaced ||= on;
          apply(audio, follow(audio, on, want));
        }
        v.muted = replaced;
        const bg = background.current;
        if (bg) apply(bg, follow(bg, replaced, t / 1000));
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [content, opts.role, stop],
  );

  /** The lines being spoken now (for subtitles). */
  const current = linesAt(content.lines, time);

  return { video, playing, time, current, playLine, playScene, stop };
}
