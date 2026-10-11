import type { Metadata } from "next";
import { SimplePage } from "@/components/landing/SimplePage";
import { LinkButton } from "@/components/ui/link-button";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: "Reset password" };

// Accounts are built in Phase 3. Until then this page says so and points to the demo.
export default function Page() {
  const { auth } = getMessages();
  return (
    <SimplePage title={auth.resetTitle}>
      <p>{auth.notYet}</p>
      <LinkButton href="/demo" className="mt-7">
        {auth.toDemo}
      </LinkButton>
    </SimplePage>
  );
}
