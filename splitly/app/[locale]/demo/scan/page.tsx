import type { Metadata } from "next";
import { Suspense } from "react";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/scan">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.scan.title };
}

// The scanner works in the browser: the camera, the reading of the photo, the address that says which group.
export default function Page() {
  return (
    <Suspense>
      <ScanScreen />
    </Suspense>
  );
}
