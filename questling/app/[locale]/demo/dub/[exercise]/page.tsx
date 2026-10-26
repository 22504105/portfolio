import { DubScreen } from "@/components/dub/dub-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.dub.title);

export default async function Page({ params }: PageProps<"/[locale]/demo/dub/[exercise]">) {
  const { exercise } = await params;
  return <DubScreen exercise={exercise} />;
}
