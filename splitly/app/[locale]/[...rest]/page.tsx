import { notFound } from "next/navigation";

/** Any address under a language that is not a page: the language's own "nothing here". */
export default function CatchAll() {
  notFound();
}
