import { describe, expect, it } from "vitest";
import { sendTake, takeReason } from "@/lib/client/take-upload";
import { dubProblems, dubSchema, latestTakes, roleLines, starterDub, type DubContent } from "@/lib/dub/model";
import { DRIFT_S, follow, linesAt, takeAt } from "@/lib/dub/sync";
import { en } from "@/lib/i18n/en";
import { ru } from "@/lib/i18n/ru";
import { checkImage } from "@/lib/server/media-check";
import { spotAt } from "@/lib/story/spot";

// Gate F (docs/features-audit.md): the voice-acting rules not covered by gates B/C — the timeline
// (trim and line boundaries), subtitles and takes in step with the video (seeking, drift, background),
// several speakers, the steps of keeping a take and what the student is told when one fails, and
// what a scene may refer to.

const scene = (): DubContent => ({ ...starterDub("In the archive", "A2"), rights: true });

describe("the timeline", () => {
  it("a published scene's lines stay inside the trim; boundaries are exact", () => {
    const s = scene();
    expect(dubProblems(s)).toEqual([]);
    // A line may start exactly at the trim's start and end exactly at its end.
    const first = s.lines[0];
    expect(dubProblems({ ...s, trim: { start: first.start, end: s.trim.end } })).toEqual([]);
    expect(dubProblems({ ...s, trim: { start: first.start + 1, end: s.trim.end } })).toContain(`${first.id}: outside the trimmed scene`);
    const last = s.lines[s.lines.length - 1];
    expect(dubProblems({ ...s, trim: { start: s.trim.start, end: last.end } })).toEqual([]);
    expect(dubProblems({ ...s, trim: { start: s.trim.start, end: last.end - 1 } })).toContain(`${last.id}: outside the trimmed scene`);
  });

  it("refuses a trim past the video, longer than a minute or backwards, and lines too short, too long or reversed", () => {
    const s = scene();
    expect(dubProblems(s, s.trim.end - 500)).toContain("trim: past the end of the video");
    expect(dubProblems(s, s.trim.end)).toEqual([]);
    expect(dubProblems({ ...s, trim: { start: 0, end: 60_001 } })).toContain("trim: longer than a minute");
    expect(dubProblems({ ...s, trim: { start: 5000, end: 5000 } })).toContain("trim: the end is before the start");
    const [l1, ...rest] = s.lines;
    expect(dubProblems({ ...s, lines: [{ ...l1, end: l1.start + 399 }, ...rest] })).toContain(
      `${l1.id}: shorter than 400 ms or ends before it starts`,
    );
    expect(dubProblems({ ...s, lines: [{ ...l1, end: l1.start - 10 }, ...rest] })).toContain(
      `${l1.id}: shorter than 400 ms or ends before it starts`,
    );
    expect(dubProblems({ ...s, trim: { start: 0, end: 60_000 }, lines: [{ ...l1, end: l1.start + 15_001 }, ...rest] })).toContain(
      `${l1.id}: longer than 15 s`,
    );
  });

  it("one speaker cannot say two lines at once; two speakers may overlap", () => {
    const s = scene();
    const [l1, l2, ...rest] = s.lines; // eleanor, then the student
    const overlapOther = { ...l2, start: l1.end - 500 };
    expect(dubProblems({ ...s, lines: [l1, overlapOther, ...rest] })).toEqual([]);
    const l3 = rest[0]; // eleanor again
    const overlapSelf = { ...l3, start: l1.end - 500, end: l1.end + 2000 };
    expect(dubProblems({ ...s, lines: [l1, l2, overlapSelf, ...rest.slice(1)] })).toContain(
      `${l3.id}: overlaps ${l1.id} of the same speaker`,
    );
  });
});

describe("subtitles and takes in step with the video", () => {
  const lines = scene().lines;
  const [l1, l2] = lines;

  it("a line is on screen from its start up to, not including, its end; nothing between lines", () => {
    expect(linesAt(lines, l1.start).map((l) => l.id)).toEqual([l1.id]);
    expect(linesAt(lines, l1.end - 1).map((l) => l.id)).toEqual([l1.id]);
    expect(linesAt(lines, l1.end)).toEqual([]);
    expect(linesAt(lines, l2.start - 1)).toEqual([]);
    // Two speakers at once: both subtitles.
    const both = [l1, { ...l2, start: l1.start + 100 }];
    expect(linesAt(both, l1.start + 200)).toHaveLength(2);
  });

  it("a take starts at the moment of the scene it is needed, also after seeking into the middle of a line", () => {
    const t = l2.start + 1200;
    const { on, want } = takeAt(l2, t);
    expect(on).toBe(true);
    expect(want).toBeCloseTo(1.2);
    expect(follow({ paused: true, currentTime: 0 }, on, want)).toEqual({ play: 1.2 });
  });

  it("drift under the limit is left alone, over it is corrected; outside its line the take stops", () => {
    expect(follow({ paused: false, currentTime: 1.2 + DRIFT_S - 0.01 }, true, 1.2)).toBeNull();
    expect(follow({ paused: false, currentTime: 1.2 - DRIFT_S - 0.01 }, true, 1.2)).toEqual({ seek: 1.2 });
    // A seek far back in the scene: the take jumps with it.
    expect(follow({ paused: false, currentTime: 2.0 }, true, 0.1)).toEqual({ seek: 0.1 });
    expect(takeAt(l2, l2.end).on).toBe(false);
    expect(follow({ paused: false, currentTime: 2 }, false, 0)).toEqual({ pause: true });
    expect(follow({ paused: true, currentTime: 2 }, false, 0)).toBeNull();
  });

  it("the background track follows the scene's own time while a take replaces the voice", () => {
    // In use-scene.ts the background plays at the scene time t/1000 whenever a take is on.
    const t = l2.start + 500;
    expect(follow({ paused: true, currentTime: 0 }, takeAt(l2, t).on, t / 1000)).toEqual({ play: t / 1000 });
  });
});

describe("several speakers", () => {
  const s = scene();

  it("each role voices only its own lines, in time order; with one speaker 'listen' voices them all", () => {
    expect(roleLines(s, "student", "roleplay").map((l) => l.speaker)).toEqual(["student", "student"]);
    expect(roleLines(s, "eleanor", "voiceover").every((l) => l.speaker === "eleanor")).toBe(true);
    const solo: DubContent = { ...s, speakers: [s.speakers[0]], lines: s.lines.filter((l) => l.speaker === s.speakers[0].id) };
    expect(roleLines(solo, solo.speakers[0].id, "listen")).toHaveLength(solo.lines.length);
    const shuffled: DubContent = { ...s, lines: [...s.lines].reverse() };
    const starts = roleLines(shuffled, "student", "roleplay").map((l) => l.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("the newest take of each of the role's lines is what goes to the mentor; a missing line means not ready", () => {
    const takes = [
      { lineId: "l2", mediaId: "old", createdAt: "2026-10-27T10:00:00Z" },
      { lineId: "l2", mediaId: "new", createdAt: "2026-10-27T10:05:00Z" },
      { lineId: "l4", mediaId: "only", createdAt: "2026-10-27T10:01:00Z" },
    ];
    const latest = latestTakes(s, { role: "student", mode: "roleplay", takes })!;
    expect(latest.get("l2")?.mediaId).toBe("new");
    expect(latest.get("l4")?.mediaId).toBe("only");
    expect(latestTakes(s, { role: "student", mode: "roleplay", takes: takes.slice(0, 2) })).toBeNull();
  });
});

describe("keeping a take", () => {
  const blob = new Blob([new Uint8Array(100)], { type: "audio/webm" });
  const args = { exercise: "d-1", line: "l2", blob, mime: "audio/webm" };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const ticket = json(200, { id: "m1", url: "https://storage.example/put", contentType: "audio/webm" });

  it("asks, puts to storage with the signed type, confirms", async () => {
    const calls: string[] = [];
    const post = async (path: string) => (calls.push(path), path === "media/upload" ? ticket.clone() : json(200, { ok: true }));
    const put = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`PUT ${(init?.headers as Record<string, string>)["Content-Type"]}`);
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    expect(await sendTake(post, put, args)).toEqual({ ok: true });
    expect(calls).toEqual(["media/upload", "PUT audio/webm", "media/complete"]);
  });

  it("names the step that failed: no connection, a refusal with its reason, storage unreachable, the content check", async () => {
    const ok = (async () => new Response(null, { status: 200 })) as typeof fetch;
    expect(await sendTake(async () => null, ok, args)).toEqual({ ok: false, reason: "network" });
    expect(await sendTake(async () => json(409, { error: "quota" }), ok, args)).toEqual({ ok: false, reason: "quota" });
    expect(await sendTake(async () => json(500, "not json"), ok, args)).toEqual({ ok: false, reason: "server" });
    const thrown = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    expect(await sendTake(async () => ticket.clone(), thrown, args)).toEqual({ ok: false, reason: "upload" });
    const expired = (async () => new Response(null, { status: 403 })) as typeof fetch;
    expect(await sendTake(async () => ticket.clone(), expired, args)).toEqual({ ok: false, reason: "upload" });
    const refusedContent = async (path: string) => (path === "media/upload" ? ticket.clone() : json(422, { error: "codec" }));
    expect(await sendTake(refusedContent, ok, args)).toEqual({ ok: false, reason: "codec" });
    const lostOnConfirm = async (path: string) => (path === "media/upload" ? ticket.clone() : null);
    expect(await sendTake(lostOnConfirm, ok, args)).toEqual({ ok: false, reason: "network" });
  });

  it("every reason is told in words in both languages; unknown ones become 'something went wrong'", () => {
    expect(takeReason("quota")).toBe("quota");
    expect(takeReason("<b>odd</b>")).toBe("other");
    for (const dict of [ru, en]) for (const text of Object.values(dict.dub.keepReasons)) expect(text.length).toBeGreaterThan(10);
    expect(Object.keys(ru.dub.keepReasons).sort()).toEqual(Object.keys(en.dub.keepReasons).sort());
  });
});

describe("what a scene may refer to", () => {
  const s = scene();

  it("video and background: a stored file's id or a built-in clip — not a link, a path or a script", () => {
    expect(dubSchema.safeParse(s).success).toBe(true);
    for (const video of ["javascript:alert(1)", "https://evil.example/v.mp4", "../../etc/passwd", "demo:../x", "demo:<script>"])
      expect(dubSchema.safeParse({ ...s, video }).success, video).toBe(false);
    expect(dubSchema.safeParse({ ...s, background: "data:audio/mp3;base64,AAAA" }).success).toBe(false);
  });

  it("ids are plain; line text is kept as text (the screens render it escaped, never as HTML)", () => {
    expect(dubSchema.safeParse({ ...s, lines: [{ ...s.lines[0], id: 'l1" onclick="x' }, ...s.lines.slice(1)] }).success).toBe(false);
    expect(dubSchema.safeParse({ ...s, speakers: [{ ...s.speakers[0], id: "<b>" }, s.speakers[1]] }).success).toBe(false);
    const text = '<img src=x onerror="alert(1)">';
    const parsed = dubSchema.parse({ ...s, lines: [{ ...s.lines[0], text }, ...s.lines.slice(1)] });
    expect(parsed.lines[0].text).toBe(text);
  });

  it("an SVG is never taken as a picture (it can carry scripts)", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(checkImage(svg).ok).toBe(false);
  });
});

describe("picture search taps", () => {
  const spot = (id: string, x: number, y: number, w: number, h: number) => ({
    id,
    label: id,
    gloss: { ru: "", en: "" },
    found: { ru: "", en: "" },
    x,
    y,
    w,
    h,
  });
  const table = spot("table", 0.2, 0.5, 0.5, 0.3);
  const key = spot("key", 0.4, 0.55, 0.08, 0.08);

  it("the same fractions find the same spot at any picture size; the smallest nested spot wins", () => {
    for (const width of [320, 360, 390, 430, 1440]) {
      const height = width * 0.5625;
      const px = (fx: number, fy: number) => spotAt([table, key], (fx * width) / width, (fy * height) / height);
      expect(px(0.44, 0.59)?.id, `${width}px`).toBe("key");
      expect(px(0.25, 0.75)?.id, `${width}px`).toBe("table");
      expect(px(0.9, 0.1), `${width}px`).toBeNull();
    }
  });

  it("a finger just outside the edge still counts (2 % slack), further out does not", () => {
    expect(spotAt([key], 0.4 - 0.019, 0.56)?.id).toBe("key");
    expect(spotAt([key], 0.4 - 0.03, 0.56)).toBeNull();
  });
});
