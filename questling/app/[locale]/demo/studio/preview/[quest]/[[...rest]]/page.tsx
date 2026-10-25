import { PreviewScreen } from "@/components/studio/preview-screen";
import { studioMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = studioMetadata("demo", (t) => t.builder.previewTitle);

// Any path under the preview (the player's own links: map, journal...) stays in the sandbox.
export default async function Page({ params }: { params: Promise<{ quest: string }> }) {
  const { quest } = await params;
  return <PreviewScreen questId={quest} />;
}
