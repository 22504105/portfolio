import { redirect } from "next/navigation";

// Until onboarding (01_welcome) lands in Gate 2, the site opens on the demo.
export default function RootPage() {
  redirect("/demo/home");
}
