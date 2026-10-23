import type { Metadata } from "next";
import { HomeScreen } from "@/components/student/home-screen";
import { demoHome } from "@/lib/demo/home";

export const metadata: Metadata = { title: "Главная — Questling (демо)" };

export default function DemoHomePage() {
  return <HomeScreen view={demoHome} base="/demo" />;
}
