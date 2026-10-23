import type { Metadata } from "next";
import { DemoStoryPlayer } from "./demo-story-player";

export const metadata: Metadata = { title: "Тайна забытой башни — Questling (демо)" };

export default function DemoPlayPage() {
  return <DemoStoryPlayer />;
}
