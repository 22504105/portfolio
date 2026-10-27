"use client";

// Recording one line from the microphone, only after the student pressed a button for it: feature
// detection, the format this browser records in (WebM/Opus on Chrome and Android, MP4/AAC on Safari
// and iOS), clear refusals, and the microphone released as soon as the line is done. Nothing records
// in the background: a hidden page (another app, a call, the screen locked) stops and drops the take.

export type RecorderProblem = "unsupported" | "denied" | "no_microphone" | "busy" | "interrupted" | "failed";

/** The format to record in here, or null when this browser cannot record at all. */
export function recordingFormat(): string | null {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm"])
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  return null;
}

export type Take = { blob: Blob; url: string; mime: string; ms: number };

export type Recording = {
  /** Resolves with the take when stopped (by `stop`, or at `maxMs`), or with a problem. */
  done: Promise<{ ok: true; take: Take } | { ok: false; problem: RecorderProblem }>;
  stop: () => void;
  cancel: () => void;
};

/** Asks for the microphone (the browser shows its own prompt the first time), then records until stopped. */
export async function startRecording(maxMs: number): Promise<{ ok: true; recording: Recording } | { ok: false; problem: RecorderProblem }> {
  const format = recordingFormat();
  if (!format) return { ok: false, problem: "unsupported" };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (error) {
    const name = (error as DOMException).name;
    return {
      ok: false,
      problem:
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "no_microphone"
            : name === "NotReadableError"
              ? "busy"
              : "failed",
    };
  }
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: format, audioBitsPerSecond: 32_000 });
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return { ok: false, problem: "unsupported" };
  }
  const chunks: Blob[] = [];
  const started = performance.now();
  let cancelled = false;
  let interrupted = false;
  const release = () => stream.getTracks().forEach((t) => t.stop());
  const onHidden = () => {
    if (document.visibilityState === "hidden" && recorder.state === "recording") {
      interrupted = true;
      recorder.stop();
    }
  };
  document.addEventListener("visibilitychange", onHidden);
  // The microphone taken away (another app, unplugged) ends the take too.
  stream.getAudioTracks()[0]?.addEventListener("ended", () => {
    if (recorder.state === "recording") {
      interrupted = true;
      recorder.stop();
    }
  });
  const timer = window.setTimeout(() => recorder.state === "recording" && recorder.stop(), maxMs);
  const done = new Promise<{ ok: true; take: Take } | { ok: false; problem: RecorderProblem }>((resolve) => {
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onerror = () => resolve({ ok: false, problem: "failed" });
    recorder.onstop = () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHidden);
      release();
      if (cancelled) return resolve({ ok: false, problem: "interrupted" });
      if (interrupted) return resolve({ ok: false, problem: "interrupted" });
      const mime = (recorder.mimeType || format).split(";")[0];
      const blob = new Blob(chunks, { type: mime });
      if (!blob.size) return resolve({ ok: false, problem: "failed" });
      resolve({ ok: true, take: { blob, url: URL.createObjectURL(blob), mime, ms: Math.round(performance.now() - started) } });
    };
  });
  recorder.start(250);
  return {
    ok: true,
    recording: {
      done,
      stop: () => recorder.state === "recording" && recorder.stop(),
      cancel: () => {
        cancelled = true;
        if (recorder.state === "recording") recorder.stop();
        else release();
      },
    },
  };
}
