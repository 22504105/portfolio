import processed from "./images.json";
import sources from "./image-sources.json";

/** Every photograph the site has a place for. docs/image-brief.md describes each one. */
export type ImageKey = keyof typeof sources;

export type ProcessedImage = {
  src: string;
  width: number;
  height: number;
  /** A tiny blurred version, shown while the photograph loads. */
  blur: string;
};

// images.json is written by `npm run images`. A photograph that has not been
// supplied yet is simply absent from it, and its place shows an empty frame.
const available = processed as Partial<Record<ImageKey, ProcessedImage>>;

export function getImage(key: ImageKey): ProcessedImage | undefined {
  return available[key];
}

/** The portrait of a barber, by the barber's slug. */
export const BARBER_PORTRAITS: Record<string, ImageKey> = {
  "marcus-hale": "marcusHale",
  "daniyar-akhmetov": "daniyarAkhmetov",
  "theo-okafor": "theoOkafor",
  "leon-fischer": "leonFischer",
};
