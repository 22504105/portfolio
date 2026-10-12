import type { Metadata } from "next";
import { StageNotice } from "@/components/shell/StageNotice";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/groups">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.groups.title };
}

export default async function Page({ params }: PageProps<"/[locale]/demo/groups">) {
  const { dictionary } = await pageLocale(params);
  return <StageNotice title={dictionary.groups.title} lead={dictionary.groups.lead} stage={2} labels={dictionary.stage} />;
}
