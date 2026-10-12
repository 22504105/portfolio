import type { Metadata } from "next";
import { GroupsScreen } from "@/components/screens/GroupsScreen";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/groups">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.groups.title };
}

export default function Page() {
  return <GroupsScreen />;
}
