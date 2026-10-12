import type { Metadata } from "next";
import { StageNotice } from "@/components/shell/StageNotice";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/activity">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.activity.title };
}

export default async function Page({ params }: PageProps<"/[locale]/app/activity">) {
  const { dictionary } = await pageLocale(params);
  return <StageNotice title={dictionary.activity.title} lead={dictionary.activity.lead} stage={4} labels={dictionary.stage} />;
}
