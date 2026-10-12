import type { Metadata } from "next";
import { Suspense } from "react";
import { AddScreen } from "@/components/screens/AddScreen";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/add">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.add.title };
}

// The screen reads the address (which group, which expense) in the browser, so it is rendered there.
export default function Page() {
  return (
    <Suspense>
      <AddScreen />
    </Suspense>
  );
}
