import type { Metadata } from "next";
import { AnalyticsScreen } from "@/components/screens/OverviewScreens";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/analytics">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.analytics.title };
}

export default function Page() {
  return <AnalyticsScreen />;
}
