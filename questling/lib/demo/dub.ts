import { emptyWorld, type World } from "@/lib/game/world";
import { starterDub, type AssignedDub } from "@/lib/dub/model";

// The demo's voice-acting scene: the built-in archive clip (scripts/build-demo-clip.mts), "assigned"
// by the demo mentor. Recordings stay in the browser; nobody reviews them, and the screen says so.

export const DEMO_DUB: AssignedDub = {
  exercise: "d-demo-archive",
  version: 1,
  groupId: "demo",
  dueAt: null,
  content: {
    ...starterDub("In the archive", "A2"),
    description: "Eleanor meets a new student among the old maps.",
    instructions: "Choose the student's part, listen to each line, then record it in your own voice.",
    background: "demo:archive-bg",
  },
};

export const demoWorld = (): World => ({ ...emptyWorld(), dubs: [DEMO_DUB] });
