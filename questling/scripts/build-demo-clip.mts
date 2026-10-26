// The built-in voice-acting scene (lib/dub/model.ts DEMO_ARCHIVE_LINES): an original clip made here,
// so the demo and new teachers have a scene with no rights question at all. A slow pan over the app's
// own library illustration, the five lines read by Piper (public-domain LJSpeech voice; the student's
// part pitched down to tell the speakers apart), each placed at its line's start, over quiet room
// tone. Also writes the background alone (room tone, no voices) for "my voice" playback, and the
// student's lines alone as the demo studio's recording to review (a synthetic voice, said so on screen).
//   npx tsx scripts/build-demo-clip.mts   (needs E:\Tools\piper and ffmpeg, as scripts/build-audio.ts)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEMO_ARCHIVE_LINES } from "../lib/dub/model";

const PIPER = process.env.PIPER ?? "E:\\Tools\\piper\\piper\\piper.exe";
const VOICE = process.env.PIPER_VOICE ?? "E:\\Tools\\piper\\en_US-ljspeech-high.onnx";
const FFMPEG = path.join(process.env.FFMPEG_DIR ?? "E:\\Tools\\ffmpeg\\ffmpeg-9.0.2-essentials_build\\bin", "ffmpeg.exe");
const LENGTH_MS = 18_000;
const out = path.resolve("public/media/demo");
mkdirSync(out, { recursive: true });
const work = mkdtempSync(path.join(process.env.TEMP ?? os.tmpdir(), "questling-clip-"));

try {
  const voices: string[] = [];
  for (const line of DEMO_ARCHIVE_LINES) {
    const wav = path.join(work, `${line.id}.wav`);
    execFileSync(PIPER, ["--model", VOICE, "--length_scale", "1.05", "--output_file", wav], { input: line.text, stdio: ["pipe", "ignore", "ignore"] });
    const placed = path.join(work, `${line.id}-placed.wav`);
    // Fit the reading into the line's slot, pitch the student lower, and delay it to the line's start.
    const slot = (line.end - line.start) / 1000;
    // The pitch shift goes in a pass of its own: after asetrate in the same chain, adelay is ignored.
    let source = wav;
    if (line.speaker === "student") {
      source = path.join(work, `${line.id}-pitched.wav`);
      execFileSync(FFMPEG, ["-v", "error", "-y", "-i", wav, "-af", "asetrate=22050*0.84,aresample=22050,atempo=1.19", source]);
    }
    execFileSync(FFMPEG, [
      "-v", "error", "-y", "-i", source,
      "-af", `silenceremove=start_periods=1:start_threshold=-45dB,atrim=end=${slot},apad=whole_dur=${slot},adelay=delays=${line.start}:all=1,apad=whole_dur=${LENGTH_MS / 1000},atrim=end=${LENGTH_MS / 1000},aresample=44100`,
      "-ac", "1", placed,
    ]);
    voices.push(placed);
    // The demo studio's "student recording" to review: the student's lines alone, as takes.
    if (line.speaker === "student")
      execFileSync(FFMPEG, ["-v", "error", "-y", "-i", source, "-af", "silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-18", "-ac", "1", "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart", path.join(out, `take-${line.id}.m4a`)]);
  }
  // Room tone: quiet brown noise, low-passed, with a soft fade; the scene's only sound besides the voices.
  const room = path.join(work, "room.wav");
  execFileSync(FFMPEG, [
    "-v", "error", "-y", "-f", "lavfi", "-i", `anoisesrc=color=brown:amplitude=0.05:duration=${LENGTH_MS / 1000}:sample_rate=44100`,
    "-af", "lowpass=f=600,afade=t=in:d=1,afade=t=out:st=16.5:d=1.5", "-ac", "1", room,
  ]);
  execFileSync(FFMPEG, ["-v", "error", "-y", "-i", room, "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart", path.join(out, "archive-bg.m4a")]);

  const mix = path.join(work, "mix.wav");
  execFileSync(FFMPEG, [
    "-v", "error", "-y", ...voices.flatMap((v) => ["-i", v]), "-i", room,
    "-filter_complex", `amix=inputs=${voices.length + 1}:duration=longest:normalize=0,loudnorm=I=-18:TP=-2`, "-ac", "1", mix,
  ]);
  // A slow pan across the illustration, 640×360, small enough for phones.
  execFileSync(FFMPEG, [
    "-v", "error", "-y", "-loop", "1", "-i", "public/images/grand-library.webp", "-i", mix,
    "-filter_complex", `[0:v]scale=1280:-2,zoompan=z='1.15+0.0006*on':x='iw/2-(iw/zoom/2)+on*0.4':y='ih/2-(ih/zoom/2)':d=${(LENGTH_MS / 1000) * 15}:s=640x360:fps=15,format=yuv420p[v]`,
    "-map", "[v]", "-map", "1:a", "-t", String(LENGTH_MS / 1000),
    "-c:v", "libx264", "-profile:v", "main", "-crf", "30", "-preset", "slow", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart",
    path.join(out, "archive.mp4"),
  ]);
  console.log(`wrote ${path.join(out, "archive.mp4")} and archive-bg.m4a`);
} finally {
  if (!process.env.KEEP) rmSync(work, { recursive: true, force: true });
  else console.log(work);
}
