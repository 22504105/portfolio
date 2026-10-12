import type { Metadata } from "next";
import { StageNotice } from "@/components/shell/StageNotice";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/analytics">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.analytics.title };
}

export default async function Page({ params }: PageProps<"/[locale]/app/analytics">) {
  const { dictionary } = await pageLocale(params);
  return <StageNotice title={dictionary.analytics.title} lead={dictionary.analytics.lead} stage={4} labels={dictionary.stage} />;
}
