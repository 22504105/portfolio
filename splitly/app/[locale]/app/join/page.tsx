import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinScreen } from "@/components/screens/JoinScreen";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/join">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.join.title };
}

// Where an invitation link lands. The invitation itself is in the address and is read in the browser.
export default function Page() {
  return (
    <Suspense>
      <JoinScreen />
    </Suspense>
  );
}
