import "server-only";
import { parseBuffer } from "music-metadata";

// What an uploaded file really is, read from its bytes (never from its name or the type the browser
// claimed): the server reads each upload back from storage and keeps it only if it passes here.
//   * Video: MP4 with H.264 (AAC sound or none), or WebM with VP8/VP9 (Opus/Vorbis or none) — what
//     phones and Telegram's WebViews play. MOV, HEVC and anything else are refused with a reason.
//   * Voice (students' recordings, from MediaRecorder): WebM/Opus (Chrome, Android) or MP4/AAC (Safari).
//   * Images: PNG, JPEG or WebP, with their size read from the header.

export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
export const VIDEO_MAX_MS = 60_000;
export const VOICE_MAX_BYTES = 2 * 1024 * 1024;
export const VOICE_MAX_MS = 30_000;
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_MAX_SIDE = 4096;

export type Checked =
  | { ok: true; mime: string; durationMs: number | null; width?: number; height?: number; codecs: string[] }
  | { ok: false; reason: "type" | "codec" | "duration" | "too_large" | "damaged" };

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
const isMp4 = (b: Uint8Array) => b.length > 12 && ascii(b, 4, 8) === "ftyp";
const isQuickTime = (b: Uint8Array) => isMp4(b) && ascii(b, 8, 12) === "qt  ";
const isWebm = (b: Uint8Array) => b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;

async function probe(bytes: Uint8Array) {
  try {
    // The container is told by its own signature (checked above); the parser is named by an audio
    // type because music-metadata refuses to guess "video/*" in some builds, though it reads them.
    const mimeType = isWebm(bytes) ? "audio/webm" : isMp4(bytes) ? "audio/mp4" : "audio/mpeg";
    return await parseBuffer(bytes, { mimeType, size: bytes.length }, { duration: true, skipCovers: true });
  } catch {
    return null;
  }
}

const codecsOf = (meta: Awaited<ReturnType<typeof probe>>) =>
  (meta?.format.trackInfo ?? []).map((t) => (t.codecName ?? "").replace(/[<>]/g, "").toLowerCase()).filter(Boolean);

export async function checkVideo(bytes: Uint8Array): Promise<Checked> {
  if (bytes.length > VIDEO_MAX_BYTES) return { ok: false, reason: "too_large" };
  if (isQuickTime(bytes)) return { ok: false, reason: "type" };
  const mime = isMp4(bytes) ? "video/mp4" : isWebm(bytes) ? "video/webm" : null;
  if (!mime) return { ok: false, reason: "type" };
  const meta = await probe(bytes);
  if (!meta) return { ok: false, reason: "damaged" };
  const codecs = codecsOf(meta);
  const video = codecs.filter((c) => /^(avc1|avc3|h264|vp8|vp9|hev1|hvc1|av01|mp4v)$/.test(c));
  const audio = codecs.filter((c) => !video.includes(c));
  const videoOk = mime === "video/mp4" ? video.length === 1 && /^avc[13]$/.test(video[0]) : video.length === 1 && /^vp[89]$/.test(video[0]);
  const audioOk = audio.every((c) => (mime === "video/mp4" ? c === "mpeg-4/aac" : c === "opus" || c === "vorbis"));
  if (!videoOk || !audioOk) return { ok: false, reason: "codec" };
  const duration = meta.format.duration;
  if (!duration || !Number.isFinite(duration)) return { ok: false, reason: "damaged" };
  if (duration * 1000 > VIDEO_MAX_MS + 500) return { ok: false, reason: "duration" };
  const track = meta.format.trackInfo?.find((t) => t.video);
  return {
    ok: true,
    mime,
    durationMs: Math.round(duration * 1000),
    codecs,
    ...(track?.video?.pixelWidth ? { width: track.video.pixelWidth, height: track.video.pixelHeight } : {}),
  };
}

/** A student's line: short, sound only. MediaRecorder's WebM may carry no duration; then the size bounds it. */
/** A student's line: short, sound only. MediaRecorder's WebM may carry no duration; then the size bounds it. */
export const checkVoice = (bytes: Uint8Array) => checkSound(bytes, VOICE_MAX_BYTES, VOICE_MAX_MS, false);

/** A scene's background sound (music, ambience without the voices): up to the scene's length; MP3 too. */
export const BACKGROUND_MAX_BYTES = 5 * 1024 * 1024;
export const checkBackground = (bytes: Uint8Array) => checkSound(bytes, BACKGROUND_MAX_BYTES, VIDEO_MAX_MS, true);

const isMp3 = (b: Uint8Array) => (b.length > 3 && ascii(b, 0, 3) === "ID3") || (b.length > 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0);

async function checkSound(bytes: Uint8Array, maxBytes: number, maxMs: number, mp3: boolean): Promise<Checked> {
  if (bytes.length > maxBytes) return { ok: false, reason: "too_large" };
  const mime = isMp4(bytes) && !isQuickTime(bytes) ? "audio/mp4" : isWebm(bytes) ? "audio/webm" : mp3 && isMp3(bytes) ? "audio/mpeg" : null;
  if (!mime) return { ok: false, reason: "type" };
  const meta = await probe(bytes);
  if (!meta) return { ok: false, reason: "damaged" };
  const codecs = mime === "audio/mpeg" ? ["mp3"] : codecsOf(meta);
  const want = mime === "audio/mp4" ? "mpeg-4/aac" : mime === "audio/webm" ? "opus" : "mp3";
  if (!codecs.length || codecs.some((c) => c !== want)) return { ok: false, reason: "codec" };
  const duration = meta.format.duration;
  if (duration && Number.isFinite(duration) && duration * 1000 > maxMs + 500) return { ok: false, reason: "duration" };
  return { ok: true, mime, durationMs: duration && Number.isFinite(duration) ? Math.round(duration * 1000) : null, codecs };
}

export function checkImage(bytes: Uint8Array): Checked {
  if (bytes.length > IMAGE_MAX_BYTES) return { ok: false, reason: "too_large" };
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let mime: string | null = null;
  let width = 0;
  let height = 0;
  if (bytes.length > 24 && bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG") {
    mime = "image/png";
    width = dv.getUint32(16);
    height = dv.getUint32(20);
  } else if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = "image/jpeg";
    // The first start-of-frame marker holds the size.
    for (let i = 2; i + 9 < bytes.length;) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      const length = dv.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        height = dv.getUint16(i + 5);
        width = dv.getUint16(i + 7);
        break;
      }
      i += 2 + length;
    }
  } else if (bytes.length > 30 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    mime = "image/webp";
    const chunk = ascii(bytes, 12, 16);
    if (chunk === "VP8X") {
      width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    } else if (chunk === "VP8 ") {
      width = dv.getUint16(26, true) & 0x3fff;
      height = dv.getUint16(28, true) & 0x3fff;
    } else if (chunk === "VP8L") {
      const bits = dv.getUint32(21, true);
      width = 1 + (bits & 0x3fff);
      height = 1 + ((bits >> 14) & 0x3fff);
    }
  }
  if (!mime) return { ok: false, reason: "type" };
  if (!width || !height) return { ok: false, reason: "damaged" };
  if (width > IMAGE_MAX_SIDE || height > IMAGE_MAX_SIDE) return { ok: false, reason: "too_large" };
  return { ok: true, mime, durationMs: null, width, height, codecs: [] };
}
