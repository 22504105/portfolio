import type { Metadata } from "next";
import { GroupScreen } from "@/components/screens/GroupScreen";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/groups/[group]">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.groups.title };
}

export default function Page() {
  return <GroupScreen />;
}
