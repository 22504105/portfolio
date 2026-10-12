// The pictures the interface shows, named in one place.
//
// The cover picture is a drawing made for Splitly as a vector file: sharp at
// any size. When a finished illustration is supplied (the concept's original,
// 1600 px wide or more), put the file in public/illustrations/ and change the
// one entry below: nothing in the interface needs to change, because every
// screen asks for the picture by name and lays it out by its proportions.

export type Illustration = { src: string; width: number; height: number };

export const ILLUSTRATIONS = {
  /** The cover: four friends and the bill they are splitting. */
  friends: { src: "/illustrations/friends.svg", width: 960, height: 600 },
} as const satisfies Record<string, Illustration>;
