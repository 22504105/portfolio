import type { Metadata } from "next";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/profile">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.profile.title };
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/app/profile">) {
  return <ProfileScreen {...await pageLocale(params)} />;
}
