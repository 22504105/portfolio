import type { Metadata } from "next";
import { StageNotice } from "@/components/shell/StageNotice";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/add">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.add.title };
}

export default async function Page({ params }: PageProps<"/[locale]/demo/add">) {
  const { dictionary } = await pageLocale(params);
  return <StageNotice title={dictionary.add.title} lead={dictionary.add.lead} stage={2} labels={dictionary.stage} />;
}
