// Records the built-in English lines with an offline voice and writes them to public/audio:
// the words of the day and their examples, the listening quests, and every scene line and chapter
// word of the built-in campaigns. Piper (MIT) speaks, the en_US-ljspeech-high voice (LJ Speech:
// public domain) is the voice, ffmpeg trims the silence, evens the loudness and makes a mono MP3.
// A line already recorded is skipped: its file is named by a hash of its text (lib/audio/clip.ts).
// Each new file is checked: it is not silent and its length fits its text.
//
//   npx tsx scripts/build-audio.ts [--force] [--list]
//
// Tools (not in the repository): PIPER (default E:\Tools\piper\piper\piper.exe), PIPER_VOICE
// (default E:\Tools\piper\en_US-ljspeech-high.onnx), FFMPEG_DIR (the folder with ffmpeg and ffprobe).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { clipKey, normalizeLine } from "../lib/audio/clip";
import { campaigns } from "../lib/content/campaigns";
import { dailyEntries } from "../lib/content/daily";
import { quickQuests } from "../lib/content/quick-quests";
import { sceneLine } from "../lib/student/story";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "audio");
const manifestPath = path.join(root, "lib", "audio", "manifest.json");
const PIPER = process.env.PIPER ?? "E:\\Tools\\piper\\piper\\piper.exe";
const VOICE = process.env.PIPER_VOICE ?? "E:\\Tools\\piper\\en_US-ljspeech-high.onnx";
const FFMPEG_DIR = process.env.FFMPEG_DIR ?? "E:\\Tools\\ffmpeg\\ffmpeg-9.0.2-essentials_build\\bin";
const ffmpeg = path.join(FFMPEG_DIR, "ffmpeg.exe");
const ffprobe = path.join(FFMPEG_DIR, "ffprobe.exe");
const VOICE_NAME = "Piper en_US-ljspeech-high";
// Slower than conversational speech, for learners.
const LENGTH_SCALE = "1.1";

/** Every line a screen can play, with where it comes from. */
function lines(): { text: string; from: string }[] {
  const found: { text: string; from: string }[] = [];
  const add = (text: string | undefined, from: string) => {
    if (text && /[A-Za-z]/.test(text)) found.push({ text: normalizeLine(text), from });
  };
  for (const entry of dailyEntries) {
    add(entry.word.text, `daily ${entry.id}: word`);
    add(entry.word.example, `daily ${entry.id}: example`);
  }
  for (const quest of quickQuests)
    for (const question of quest.questions) if ("audio" in question) add(question.audio, `quest ${quest.id}/${question.id}`);
  for (const campaign of campaigns)
    for (const chapter of campaign.chapters) {
      for (const word of chapter.words) add(word, `${campaign.id}/${chapter.id}: word`);
      for (const scene of chapter.scenes) {
        add(sceneLine(scene), `${campaign.id}/${scene.id}`);
        if (scene.kind === "dialogue") scene.lines.forEach((line, i) => add(line.text, `${campaign.id}/${scene.id}: line ${i + 1}`));
      }
    }
  const unique = new Map<string, { text: string; from: string }>();
  for (const line of found) if (!unique.has(clipKey(line.text))) unique.set(clipKey(line.text), line);
  return [...unique.values()];
}

const probe = (file: string) =>
  Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());

function meanVolume(file: string): number {
  // ffmpeg prints its measurements on stderr.
  const report = spawnSync(ffmpeg, ["-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  return Number(/mean_volume: (-?[\d.]+) dB/.exec(report)?.[1] ?? "-99");
}

function record(text: string, target: string) {
  const work = path.join(tmpdir(), `questling-audio-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const wav = path.join(work, "line.wav");
  execFileSync(PIPER, ["--model", VOICE, "--length_scale", LENGTH_SCALE, "--output_file", wav], {
    input: text,
    stdio: ["pipe", "ignore", "ignore"],
  });
  // Trim silence at both ends, even the loudness (EBU R128, speech level), mono 48 kbit/s MP3.
  const filter =
    "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse," +
    "loudnorm=I=-18:TP=-2:LRA=11,apad=pad_dur=0.15";
  execFileSync(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    wav,
    "-af",
    filter,
    "-ac",
    "1",
    "-ar",
    "22050",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "48k",
    target,
  ]);
  rmSync(work, { recursive: true, force: true });
}

const force = process.argv.includes("--force");
const all = lines();
if (process.argv.includes("--list")) {
  for (const line of all) console.log(`${clipKey(line.text)}  ${line.from}  ${line.text}`);
  process.exit(0);
}
for (const tool of [PIPER, VOICE, ffmpeg, ffprobe]) if (!existsSync(tool)) throw new Error(`missing ${tool}`);
mkdirSync(out, { recursive: true });

const clips: { key: string; text: string; seconds: number }[] = [];
const problems: string[] = [];
let made = 0;
for (const line of all) {
  const key = clipKey(line.text);
  const file = path.join(out, `${key}.mp3`);
  if (force || !existsSync(file)) {
    record(line.text, file);
    made++;
  }
  const seconds = Math.round(probe(file) * 100) / 100;
  // A sane length: at least a fifth of a second, at most ~0.12 s a character plus a pause.
  const longest = line.text.length * 0.12 + 2;
  if (seconds < 0.2 || seconds > longest) problems.push(`${key} ${seconds}s for ${line.text.length} chars: ${line.text}`);
  const volume = meanVolume(file);
  if (volume < -40) problems.push(`${key} is nearly silent (${volume} dB): ${line.text}`);
  clips.push({ key, text: line.text, seconds });
}
// Files of lines no longer in the content are removed.
const keep = new Set(clips.map((c) => `${c.key}.mp3`));
for (const name of readdirSync(out)) if (name.endsWith(".mp3") && !keep.has(name)) rmSync(path.join(out, name));

clips.sort((a, b) => a.key.localeCompare(b.key));
writeFileSync(manifestPath, JSON.stringify({ voice: VOICE_NAME, clips }, null, 2) + "\n");
const bytes = readdirSync(out).reduce((sum, name) => sum + readFileSync(path.join(out, name)).length, 0);
const total = clips.reduce((sum, c) => sum + c.seconds, 0);
console.log(`${clips.length} lines (${made} recorded now), ${Math.round(total)} s, ${(bytes / 1024 / 1024).toFixed(2)} MB in public/audio`);
if (problems.length) {
  console.log(`problems:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
