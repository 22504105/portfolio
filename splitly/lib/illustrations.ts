// The pictures the interface shows, named in one place.
//
// The cover picture is the illustration made with the Stitch design (four
// friends unpacking shopping, a receipt between them), kept at the size it
// was made, 1200 px wide, and only ever shown smaller. A vector drawing made
// earlier stays beside it (friends.svg) as the fallback. To use another
// picture, put the file in public/illustrations/ and change the one entry
// below: nothing in the interface needs to change, because every screen asks
// for the picture by name and lays it out by its proportions.

export type Illustration = { src: string; width: number; height: number };

export const ILLUSTRATIONS = {
  /** The cover: four friends and the bill they are splitting. */
  friends: { src: "/illustrations/friends.webp", width: 1200, height: 896 },
} as const satisfies Record<string, Illustration>;
