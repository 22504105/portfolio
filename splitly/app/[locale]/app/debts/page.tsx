import type { Metadata } from "next";
import { DebtsScreen } from "@/components/screens/OverviewScreens";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/debts">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.debtsAll.title };
}

export default function Page() {
  return <DebtsScreen />;
}
