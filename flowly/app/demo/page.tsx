import { redirect } from "next/navigation";

/** The demo's front door: straight to the overview, no account and no questions. */
export default function DemoEntry() {
  redirect("/demo/overview");
}
