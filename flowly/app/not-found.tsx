import { SimplePage } from "@/components/landing/SimplePage";
import { LinkButton } from "@/components/ui/link-button";
import { getMessages } from "@/lib/i18n";

export default function NotFound() {
  const { notFound } = getMessages();
  return (
    <SimplePage title={notFound.title}>
      <p>{notFound.body}</p>
      <LinkButton href="/" className="mt-7">
        {notFound.home}
      </LinkButton>
    </SimplePage>
  );
}
