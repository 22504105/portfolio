"use client";

import { useSyncExternalStore } from "react";

// Says the word aloud with the device's own English voice (Web Speech API).
// No audio file and no outside service. Where the browser has no speech
// synthesis the button is shown disabled rather than pretending to work.

const subscribe = () => () => {};
const hasSpeech = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function PronounceButton({ word }: { word: string }) {
  const supported = useSyncExternalStore(subscribe, hasSpeech, () => true);

  function speak() {
    if (!hasSpeech()) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={speak}
      disabled={!supported}
      aria-label="Слушать произношение"
      className="border-magicViolet/40 text-magicViolet flex h-6 w-6 items-center justify-center rounded-full border bg-[#272338] transition-colors hover:text-white disabled:opacity-40"
    >
      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path>
      </svg>
    </button>
  );
}
