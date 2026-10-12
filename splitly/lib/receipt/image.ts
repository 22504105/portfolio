// Getting a photo ready to be read, in the browser. The photo is checked,
// redrawn on a canvas (which drops whatever the camera wrote into the file:
// place, time, device), turned if needed, and optionally made easier to read.
// The original is never uploaded; what leaves the device is its hash, to
// notice the same receipt twice.

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export const IMAGE_LIMITS = {
  bytes: 15 * 1024 * 1024,
  minSide: 300,
  maxSide: 12_000,
  /** The longest side the recogniser is given: more is slower, not better. */ workSide: 2000,
} as const;

export type ImageProblem = "type" | "too_large" | "too_small" | "too_big" | "unreadable";

/** What can be told about a file before it is opened. PDFs and anything else that is not a photo are refused here. */
export function checkFile(file: { type: string; size: number }): ImageProblem | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size > IMAGE_LIMITS.bytes) return "too_large";
  if (file.size === 0) return "unreadable";
  return null;
}

/** What can be told once its size is known. */
export function checkSize(width: number, height: number): ImageProblem | null {
  if (Math.min(width, height) < IMAGE_LIMITS.minSide) return "too_small";
  if (Math.max(width, height) > IMAGE_LIMITS.maxSide) return "too_big";
  return null;
}

/** The size to work at: the longest side brought down to the working limit, never up. */
export function workSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, IMAGE_LIMITS.workSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** SHA-256 of the file as it came, in hex. */
export async function hashOf(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type Turn = 0 | 90 | 180 | 270;

/**
 * Grey, with the darkest tenth pushed to black and the lightest to white:
 * thermal paper is grey on grey, and this is most of what "enhance" can do.
 */
export function stretchContrast(pixels: Uint8ClampedArray): void {
  const histogram = new Uint32Array(256);
  for (let index = 0; index < pixels.length; index += 4) {
    const grey = Math.round(pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114);
    pixels[index] = grey;
    histogram[grey]++;
  }
  const count = pixels.length / 4;
  const level = (fraction: number) => {
    let seen = 0;
    for (let value = 0; value < 256; value++) {
      seen += histogram[value];
      if (seen >= count * fraction) return value;
    }
    return 255;
  };
  const low = level(0.1);
  const high = Math.max(low + 1, level(0.9));
  for (let index = 0; index < pixels.length; index += 4) {
    const value = Math.max(0, Math.min(255, Math.round(((pixels[index] - low) * 255) / (high - low))));
    pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
  }
}

/** The photo redrawn: sized for reading, turned, optionally enhanced, as a JPEG with nothing of the original file's own data. */
export async function prepare(file: Blob, turn: Turn, enhance: boolean): Promise<{ blob: Blob; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    // "from-image": a phone photo taken upright is drawn upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("unreadable" satisfies ImageProblem);
  }
  try {
    const problem = checkSize(bitmap.width, bitmap.height);
    if (problem) throw new Error(problem);
    const size = workSize(bitmap.width, bitmap.height);
    const sideways = turn === 90 || turn === 270;
    const canvas = document.createElement("canvas");
    canvas.width = sideways ? size.height : size.width;
    canvas.height = sideways ? size.width : size.height;
    const context = canvas.getContext("2d", { willReadFrequently: enhance });
    if (!context) throw new Error("unreadable" satisfies ImageProblem);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((turn * Math.PI) / 180);
    context.drawImage(bitmap, -size.width / 2, -size.height / 2, size.width, size.height);
    if (enhance) {
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      stretchContrast(data.data);
      context.putImageData(data, 0, 0);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    // Give the memory back at once: a phone has little to spare.
    const { width, height } = canvas;
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error("unreadable" satisfies ImageProblem);
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}
