import { redirect } from "next/navigation";

// The demo opens on its welcome screen, which leads on to the hero choice or home.
export default async function Page({ params }: PageProps<"/[locale]/demo">) {
  const { locale } = await params;
  redirect(`/${locale}/demo/welcome`);
}
