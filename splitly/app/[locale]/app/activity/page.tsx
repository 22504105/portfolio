import type { Metadata } from "next";
import { ActivityScreen } from "@/components/screens/OverviewScreens";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/activity">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.activity.title };
}

export default function Page() {
  return <ActivityScreen />;
}
