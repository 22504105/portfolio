import { InventoryScreen } from "@/components/student/inventory-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.inventory.title);

export default function Page() {
  return <InventoryScreen />;
}
