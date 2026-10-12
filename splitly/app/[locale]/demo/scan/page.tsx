import type { Metadata } from "next";
import { StageNotice } from "@/components/shell/StageNotice";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/scan">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.scan.title };
}

export default async function Page({ params }: PageProps<"/[locale]/demo/scan">) {
  const { dictionary } = await pageLocale(params);
  return <StageNotice title={dictionary.scan.title} lead={dictionary.scan.lead} stage={3} labels={dictionary.stage} />;
}
