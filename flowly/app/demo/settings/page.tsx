import type { Metadata } from "next";
import { BuildingPage } from "@/components/pages/BuildingPage";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <BuildingPage root="/demo" section="settings" messages={getMessages()} />;
}
