import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TransactionsPage } from "@/components/pages/TransactionsPage";
import { EmptyWorkspace } from "@/components/workspace/EmptyWorkspace";
import { appWorkspace } from "@/lib/data/workspace";
import { getMessages } from "@/lib/i18n";
import { TRANSACTION_SORTS } from "@/lib/view/lists";
import { loadPage } from "@/lib/workspace";

export const metadata: Metadata = { title: "Transactions" };

export default async function Page({ searchParams }: PageProps<"/app/transactions">) {
  const context = await appWorkspace();
  if (!context) redirect("/app/welcome");
  const messages = getMessages();
  if (context.dataset.orders.length === 0) return <EmptyWorkspace title={messages.nav.transactions} messages={messages} />;
  return <TransactionsPage page={loadPage(context, "transactions", await searchParams, TRANSACTION_SORTS, "date")} messages={messages} />;
}
