import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";

type AuthPageProps = {
  eyebrow: string;
  title: string;
  lead?: string;
  children: ReactNode;
  /** Links under the form: the way to the other auth pages. */
  footer?: ReactNode;
};

/** The frame shared by the sign-in, sign-up and password pages. */
export function AuthPage({ eyebrow, title, lead, children, footer }: AuthPageProps) {
  return (
    <Container className="py-section">
      <p className="type-eyebrow text-muted">{eyebrow}</p>
      <h1 className="type-h1 mt-5 max-w-[16ch]">{title}</h1>
      {lead && <p className="type-lead mt-6 max-w-xl text-muted">{lead}</p>}
      <div className="mt-12">{children}</div>
      {footer && <div className="type-body mt-12 flex max-w-md flex-col gap-3 border-t border-line pt-6 text-muted">{footer}</div>}
    </Container>
  );
}

/** Shown where accounts need Supabase Auth and it is not configured. */
export function AccountsUnavailable({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <AuthPage eyebrow={eyebrow} title={title} lead={body}>
      {null}
    </AuthPage>
  );
}
