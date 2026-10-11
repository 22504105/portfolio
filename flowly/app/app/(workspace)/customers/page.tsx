import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomersPage } from "@/components/pages/CustomersPage";
import { EmptyWorkspace } from "@/components/workspace/EmptyWorkspace";
import { appWorkspace } from "@/lib/data/workspace";
import { getMessages } from "@/lib/i18n";
import { CUSTOMER_SORTS } from "@/lib/view/lists";
import { loadPage } from "@/lib/workspace";

export const metadata: Metadata = { title: "Customers" };

export default async function Page({ searchParams }: PageProps<"/app/customers">) {
  const context = await appWorkspace();
  if (!context) redirect("/app/welcome");
  const messages = getMessages();
  if (context.dataset.orders.length === 0) return <EmptyWorkspace title={messages.nav.customers} messages={messages} />;
  return <CustomersPage page={loadPage(context, "customers", await searchParams, CUSTOMER_SORTS, "spend")} messages={messages} />;
}
