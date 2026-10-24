import { ShopScreen } from "@/components/student/shop-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("app", (t) => t.shop.title);

export default async function Page({ searchParams }: PageProps<"/[locale]/app/shop">) {
  const { item } = await searchParams;
  return <ShopScreen focus={typeof item === "string" ? item : undefined} />;
}
