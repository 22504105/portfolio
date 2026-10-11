import type { Metadata } from "next";
import { BuildingPage } from "@/components/pages/BuildingPage";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <BuildingPage root="/app" section="reports" messages={getMessages()} />;
}
