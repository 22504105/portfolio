import type { Metadata } from "next";
import { ImportsPage } from "@/components/pages/ImportsPage";
import { getMessages } from "@/lib/i18n";
import { demoWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Imports" };

export default function Page() {
  return <ImportsPage context={demoWorkspace()} messages={getMessages()} />;
}
