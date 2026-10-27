"use client";

import { builtInClip } from "@/lib/dub/model";

// The demo's media: built-in files shipped with the app ("demo:archive"), and the visitor's own takes,
// kept in this browser's memory only (they are gone on reload, which the demo screens say).

const takes = new Map<string, string>();

export function keepDemoTake(blob: Blob): string {
  const id = `local:${crypto.randomUUID()}`;
  takes.set(id, URL.createObjectURL(blob));
  return id;
}

export const demoMediaUrl = (id: string): string | null => takes.get(id) ?? builtInClip(id);
