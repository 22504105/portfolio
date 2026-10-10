import { notFound } from "next/navigation";

// Any unknown path under a language ends here, so the "not found" page is
// shown in that language and inside the site layout.
export default function CatchAllPage() {
  notFound();
}
