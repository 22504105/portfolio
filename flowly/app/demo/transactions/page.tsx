import type { Metadata } from "next";
import { TransactionsPage } from "@/components/pages/TransactionsPage";
import { getMessages } from "@/lib/i18n";
import { TRANSACTION_SORTS } from "@/lib/view/lists";
import { demoWorkspace, loadPage } from "@/lib/workspace";

export const metadata: Metadata = { title: "Transactions" };

export default async function Page({ searchParams }: PageProps<"/demo/transactions">) {
  const page = loadPage(demoWorkspace(), "transactions", await searchParams, TRANSACTION_SORTS, "date");
  return <TransactionsPage page={page} messages={getMessages()} />;
}
