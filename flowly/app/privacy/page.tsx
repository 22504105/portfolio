import type { Metadata } from "next";
import { SimplePage } from "@/components/landing/SimplePage";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  const { privacy } = getMessages();
  return (
    <SimplePage title={privacy.title}>
      <p>{privacy.body}</p>
    </SimplePage>
  );
}
