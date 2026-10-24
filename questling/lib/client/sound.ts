"use client";

import { useSyncExternalStore } from "react";

// Sound: English words and sentences read aloud by the device's own voice (Web Speech API),
// switched on and off by the sound buttons of the welcome and character screens. The choice
// is kept on this device. No audio files and no outside service; where the browser has no
// speech synthesis the buttons say so by being disabled.

const KEY = "questling-sound";
const listeners = new Set<() => void>();

function readOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSound(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  if (!on && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useSoundOn(): boolean {
  return useSyncExternalStore(subscribe, readOn, () => true);
}

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

const noop = () => () => {};
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(noop, speechSupported, () => true);
}

/** Reads English text aloud, unless sound is off. */
export function speak(text: string) {
  if (!speechSupported() || !readOn()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
