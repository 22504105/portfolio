import type { Metadata } from "next";
import { CustomersPage } from "@/components/pages/CustomersPage";
import { getMessages } from "@/lib/i18n";
import { CUSTOMER_SORTS } from "@/lib/view/lists";
import { demoWorkspace, loadPage } from "@/lib/workspace";

export const metadata: Metadata = { title: "Customers" };

export default async function Page({ searchParams }: PageProps<"/demo/customers">) {
  const page = loadPage(demoWorkspace(), "customers", await searchParams, CUSTOMER_SORTS, "spend");
  return <CustomersPage page={page} messages={getMessages()} />;
}
