import { redirect } from "next/navigation";

// The signed-in workspace is built in Phase 3. Until it exists, its addresses
// lead to the sign-in page instead of a dead end.
export default function WorkspacePlaceholder() {
  redirect("/login");
}
