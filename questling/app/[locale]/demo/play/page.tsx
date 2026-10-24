import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demoStory } from "@/lib/demo/story";
import { fill, getDictionary, isLocale } from "@/lib/i18n";
import { DemoStoryPlayer } from "./demo-story-player";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/play">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: fill(getDictionary(locale).meta.demoTitle, { page: demoStory(locale).question.storyTitle }) };
}

export default async function DemoPlayPage({ params }: PageProps<"/[locale]/demo/play">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <DemoStoryPlayer locale={locale} t={getDictionary(locale)} />;
}
