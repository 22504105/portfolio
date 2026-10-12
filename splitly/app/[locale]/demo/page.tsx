import type { Metadata } from "next";
import { StageNotice } from "@/components/shell/StageNotice";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.home.title };
}

export default async function Page({ params }: PageProps<"/[locale]/demo">) {
  const { dictionary } = await pageLocale(params);
  return <StageNotice title={dictionary.home.title} lead={dictionary.home.lead} stage={2} labels={dictionary.stage} />;
}
