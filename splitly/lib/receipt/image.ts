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

/** The working size with a small photo brought up to it (at most doubled): a messenger's copy of a photo has letters too small to read well. */
export function enlargedSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(2, IMAGE_LIMITS.workSide / Math.max(width, height));
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

/**
 * The paper's tone and the shadows on it evened out: each point is set
 * against the average of its surroundings, so that paper comes out the same
 * light grey everywhere and ink stays as much darker than it as it was. This
 * is what brings back a name lost under a shadow or under print showing
 * through from the other side. `pixels` is RGBA and is changed in place (to
 * greys); `width` and `height` are the picture's.
 */
export function evenOut(pixels: Uint8ClampedArray, width: number, height: number): void {
  const grey = new Float32Array(width * height);
  for (let index = 0; index < grey.length; index++)
    grey[index] = pixels[index * 4] * 0.299 + pixels[index * 4 + 1] * 0.587 + pixels[index * 4 + 2] * 0.114;

  // Sums over any rectangle in four look-ups: the average around every point without adding its neighbours up each time.
  const stride = width + 1;
  const sums = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += grey[y * width + x];
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + row;
    }
  }
  // The surroundings: wide enough to span several letters, so that a letter is judged against paper, not against itself.
  const half = Math.max(12, Math.round(Math.max(width, height) / 60));
  for (let y = 0; y < height; y++) {
    const top = Math.max(0, y - half);
    const bottom = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - half);
      const right = Math.min(width, x + half + 1);
      const around =
        (sums[bottom * stride + right] - sums[top * stride + right] - sums[bottom * stride + left] + sums[top * stride + left]) /
        ((right - left) * (bottom - top));
      const value = Math.max(0, Math.min(255, Math.round((grey[y * width + x] / Math.max(1, around)) * 235)));
      const at = (y * width + x) * 4;
      pixels[at] = pixels[at + 1] = pixels[at + 2] = value;
    }
  }
}

/** The photo redrawn: sized for reading, turned, optionally enhanced, with nothing of the original file's own data. */
export async function prepare(
  file: Blob,
  turn: Turn,
  enhance: boolean,
  /** "evened": enlarged if small (small print reads badly) and with the paper's tone evened out; a second way to read the same photo. */
  way: "plain" | "evened" = "plain",
): Promise<{ blob: Blob; width: number; height: number }> {
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
    const size = way === "evened" ? enlargedSize(bitmap.width, bitmap.height) : workSize(bitmap.width, bitmap.height);
    const sideways = turn === 90 || turn === 270;
    const canvas = document.createElement("canvas");
    canvas.width = sideways ? size.height : size.width;
    canvas.height = sideways ? size.width : size.height;
    const context = canvas.getContext("2d", { willReadFrequently: enhance || way === "evened" });
    if (!context) throw new Error("unreadable" satisfies ImageProblem);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((turn * Math.PI) / 180);
    context.drawImage(bitmap, -size.width / 2, -size.height / 2, size.width, size.height);
    if (way === "evened") {
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      evenOut(data.data, canvas.width, canvas.height);
      context.putImageData(data, 0, 0);
    } else if (enhance) {
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      stretchContrast(data.data);
      context.putImageData(data, 0, 0);
    }
    // Without loss: squeezing the picture again as a JPEG smears the edges of small print, and digits are read wrong
    // ("12.00" came out as "112.300"). The file never leaves the device, so its size costs nothing.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    // Give the memory back at once: a phone has little to spare.
    const { width, height } = canvas;
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error("unreadable" satisfies ImageProblem);
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}
