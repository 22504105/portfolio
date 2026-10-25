import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_AUDIO_BYTES, MAX_AUDIO_MS, validateAudio } from "@/lib/server/media";

// A teacher's recording is checked by its content, not by its name: the bytes must be MP3, M4A (AAC in
// MP4) or WAV, decodable, short enough and small enough. Fixtures: tests/fixtures/audio (made by ffmpeg).

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(import.meta.dirname, "fixtures", "audio", name)));

describe("checking an uploaded recording", () => {
  it("accepts real MP3, M4A and WAV, and reads their length from the file", async () => {
    for (const [name, mime] of [
      ["ok.mp3", "audio/mpeg"],
      ["ok.m4a", "audio/mp4"],
      ["ok.wav", "audio/wav"],
    ] as const) {
      const result = await validateAudio(fixture(name));
      expect(result, name).toMatchObject({ ok: true, mime });
      if (result.ok) expect(result.durationMs, name).toBeGreaterThan(1300);
      if (result.ok) expect(result.durationMs, name).toBeLessThan(1800);
    }
  });

  it("judges by content: a renamed picture, a text with an MP3 header, empty bytes are refused", async () => {
    expect(await validateAudio(fixture("notaudio.png"))).toEqual({ ok: false, reason: "type" });
    expect(await validateAudio(fixture("fake.mp3"))).toEqual({ ok: false, reason: "unreadable" });
    expect(await validateAudio(new Uint8Array())).toEqual({ ok: false, reason: "type" });
  });

  it("refuses a recording that is too long or too large", async () => {
    expect(await validateAudio(fixture("long.mp3"))).toEqual({ ok: false, reason: "too_long" });
    expect(MAX_AUDIO_MS).toBe(60_000);
    const big = new Uint8Array(MAX_AUDIO_BYTES + 1);
    big.set(fixture("ok.wav"));
    expect(await validateAudio(big)).toEqual({ ok: false, reason: "too_large" });
  });
});
