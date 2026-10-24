import { redirect } from "next/navigation";

// Until onboarding (01_welcome) lands in Gate 2, the site opens on the demo.
export default async function LocalePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  redirect(`/${locale}/demo/home`);
}
