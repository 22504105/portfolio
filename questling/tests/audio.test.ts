import { describe, expect, it } from "vitest";
import { clipKey, clipUrl, normalizeLine } from "@/lib/audio/clip";
import manifest from "@/lib/audio/manifest.json";
import { campaigns } from "@/lib/content/campaigns";
import { dailyEntries } from "@/lib/content/daily";
import { quickQuests } from "@/lib/content/quick-quests";
import { sceneLine } from "@/lib/student/story";

// The built-in recordings (scripts/build-audio.ts): every English line a screen can play has one.

describe("built-in recordings", () => {
  it("cover every word of the day, its example, every listening quest, and every line of both campaigns", () => {
    const missing: string[] = [];
    const need = (text: string, from: string) => {
      if (!clipUrl(text)) missing.push(`${from}: ${text}`);
    };
    for (const entry of dailyEntries) {
      need(entry.word.text, `daily ${entry.id}`);
      need(entry.word.example, `daily ${entry.id} example`);
    }
    for (const quest of quickQuests)
      for (const question of quest.questions) if ("audio" in question && question.audio) need(question.audio, `quest ${quest.id}`);
    expect(campaigns).toHaveLength(2);
    for (const campaign of campaigns)
      for (const chapter of campaign.chapters) {
        for (const word of chapter.words) need(word, `${campaign.id} word`);
        for (const scene of chapter.scenes) {
          need(sceneLine(scene), `${campaign.id}/${scene.id}`);
          if (scene.kind === "dialogue") for (const line of scene.lines) need(line.text, `${campaign.id}/${scene.id} line`);
        }
      }
    expect(missing).toEqual([]);
  });

  it("find a line however its quotes and spaces were typed, and nothing that was not recorded", () => {
    expect(normalizeLine("  I’ve   been “here”. ")).toBe(`I've been "here".`);
    expect(clipKey("Whisper")).toBe(clipKey(" whisper "));
    expect(clipUrl("A line nobody ever recorded.")).toBeNull();
  });

  it("are short, mono MP3 files with a sane length for their text", () => {
    expect(manifest.voice).toBe("Piper en_US-ljspeech-high");
    for (const clip of manifest.clips) {
      expect(clip.seconds, clip.text).toBeGreaterThan(0.2);
      expect(clip.seconds, clip.text).toBeLessThan(clip.text.length * 0.12 + 2);
    }
  });
});
