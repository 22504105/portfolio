import type { Metadata } from "next";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.home.title };
}

export default function Page() {
  return <HomeScreen />;
}
