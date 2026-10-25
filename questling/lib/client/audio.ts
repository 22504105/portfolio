"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { clipUrl } from "@/lib/audio/clip";
import { useSoundOn } from "./sound";

// Playing English aloud, in this order: a recording (a teacher's upload, or the built-in one for the
// line, lib/audio/clip.ts); else the device's own English voice (Web Speech API); else nothing, and the
// screen says so. One sound at a time: starting another, or leaving the screen, stops the one playing.
// A button is never shown as working when nothing will be heard (the brief): what a button can do is
// known before it is pressed (`availability`), and what happened after is reported (`state`, notices).

export type Availability = "file" | "speech" | "none" | "muted" | "checking";
export type PlayState = "idle" | "loading" | "playing" | "failed";
export type Notice = "unavailable" | "muted" | "failed";

// ——— The device's English voice ———

const hasSynthesis = () => typeof window !== "undefined" && "speechSynthesis" in window;
type Voices = "checking" | "english" | "none";
let voices: Voices = "checking";
const voiceListeners = new Set<() => void>();

function checkVoices() {
  if (!hasSynthesis()) {
    voices = "none";
    return;
  }
  const english = window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith("en"));
  if (english) voices = "english";
}

function watchVoices(listener: () => void) {
  voiceListeners.add(listener);
  if (voices === "checking" && hasSynthesis()) {
    checkVoices();
    const changed = () => {
      checkVoices();
      voiceListeners.forEach((l) => l());
    };
    window.speechSynthesis.addEventListener?.("voiceschanged", changed);
    // Some WebViews (Telegram on part of Android) never list a voice: after a moment, there is none.
    setTimeout(() => {
      if (voices === "checking") voices = "none";
      voiceListeners.forEach((l) => l());
    }, 1500);
  }
  return () => voiceListeners.delete(listener);
}

const readVoices = () => {
  if (voices === "checking") checkVoices();
  if (!hasSynthesis()) voices = "none";
  return voices;
};

/** Whether the device can read English aloud: "checking" until its voices are known. */
export function useEnglishVoice(): Voices {
  return useSyncExternalStore(watchVoices, readVoices, () => "checking");
}

// ——— One player for the whole app ———

type Owner = symbol;
let element: HTMLAudioElement | null = null;
let owner: Owner | null = null;
let stopCurrent: (() => void) | null = null;

/** Stops whatever is playing (a recording or the device's voice). */
export function stopAudio() {
  stopCurrent?.();
  stopCurrent = null;
  owner = null;
}

function speakLine(text: string, onEnd: () => void): boolean {
  if (!hasSynthesis() || readVoices() !== "english") return false;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const all = window.speechSynthesis.getVoices();
    const voice = all.find((v) => v.lang.toLowerCase().startsWith("en-us")) ?? all.find((v) => v.lang.toLowerCase().startsWith("en"));
    utterance.lang = voice?.lang ?? "en-US";
    try {
      if (voice) utterance.voice = voice;
    } catch {
      // Some engines refuse a voice they did not hand out themselves; the language is enough.
    }
    utterance.rate = 0.9;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

// ——— Notices: one line at the bottom of the screen, for a few seconds ———

let notice: { kind: Notice; at: number } | null = null;
const noticeListeners = new Set<() => void>();
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

export function showNotice(kind: Notice) {
  notice = { kind, at: Date.now() };
  noticeListeners.forEach((l) => l());
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice = null;
    noticeListeners.forEach((l) => l());
  }, 4000);
}

export function useAudioNotice(): Notice | null {
  return useSyncExternalStore(
    (l) => (noticeListeners.add(l), () => noticeListeners.delete(l)),
    () => notice?.kind ?? null,
    () => null,
  );
}

// ——— A button's audio ———

/**
 * The audio of one line. `src` is a teacher's recording, if any; else the line's built-in one is used.
 * `availability` says what pressing will do; `state` what is happening; `play` toggles it.
 */
export function useLineAudio(text: string, src?: string | null) {
  const soundOn = useSoundOn();
  const voice = useEnglishVoice();
  const file = src ?? (text ? clipUrl(text) : null);
  const [state, setState] = useState<PlayState>("idle");
  const [me] = useState<Owner>(() => Symbol("line"));

  const availability: Availability = !soundOn
    ? "muted"
    : file
      ? "file"
      : voice === "english"
        ? "speech"
        : voice === "checking"
          ? "checking"
          : "none";

  // Leaving the screen (or this line) stops it.
  useEffect(
    () => () => {
      if (owner === me) stopAudio();
    },
    [me, text, src],
  );

  const play = useCallback(async () => {
    if (owner === me && (state === "playing" || state === "loading")) {
      stopAudio();
      setState("idle");
      return;
    }
    if (availability === "muted") return showNotice("muted");
    if (availability === "none" || availability === "checking") return showNotice("unavailable");
    stopAudio();
    owner = me;
    const done = () => {
      if (owner === me) owner = null;
      setState("idle");
    };
    // A failed recording is reported twice (the element's error and play()'s rejection): fall back once.
    let fellBack = false;
    const fallBack = () => {
      if (owner !== me || fellBack) return;
      fellBack = true;
      if (speakLine(text, done)) {
        setState("playing");
        stopCurrent = () => (window.speechSynthesis.cancel(), setState("idle"));
      } else {
        owner = null;
        setState("failed");
        showNotice("failed");
      }
    };
    if (availability === "speech") return fallBack();

    // A recording: loading, then playing; a failure (network, format, a WebView refusing) falls back.
    element ??= new Audio();
    const audio = element;
    setState("loading");
    const cleanup = () => {
      audio.onplaying = audio.onended = audio.onerror = null;
    };
    stopCurrent = () => {
      cleanup();
      audio.pause();
      setState("idle");
    };
    audio.onplaying = () => owner === me && setState("playing");
    audio.onended = () => (cleanup(), done());
    audio.onerror = () => (cleanup(), fallBack());
    audio.src = file!;
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch (error) {
      // An abort because another sound started is not a failure.
      if ((error as DOMException)?.name !== "AbortError") {
        cleanup();
        fallBack();
      }
    }
  }, [availability, file, me, state, text]);

  return { availability, state: owner === me || state === "failed" ? state : "idle", play };
}
