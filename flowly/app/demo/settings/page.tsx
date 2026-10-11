import type { Metadata } from "next";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { getMessages } from "@/lib/i18n";
import { demoWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <SettingsPage context={demoWorkspace()} messages={getMessages()} />;
}
