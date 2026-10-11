import { FlaskConical, LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { PeriodPicker } from "@/components/controls/PeriodPicker";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LinkButton } from "@/components/ui/link-button";
import type { Messages } from "@/lib/i18n";
import type { WorkspaceRoot } from "@/lib/routes";
import type { Calendar } from "@/lib/view/state";
import { Breadcrumb } from "./Breadcrumb";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";

type AppShellProps = {
  root: WorkspaceRoot;
  workspaceName: string;
  /** The days the workspace has data for: what the period picker offers. */
  calendar: Calendar;
  messages: Messages;
  /** Who is signed in. Absent in the demo. */
  account?: { email: string };
  children: ReactNode;
};

// The frame around every workspace page: a dark sidebar (a rail of icons on a
// tablet, a drawer on a phone), a top bar that says where you are and which
// period you are looking at, and the page itself.
export function AppShell({ root, workspaceName, calendar, messages, account, children }: AppShellProps) {
  const demo = root === "/demo";
  const { nav, shell } = messages;

  const demoBadge = demo && (
    <p className="border-brand/25 bg-brand-tint text-brand-hover inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 font-medium whitespace-nowrap">
      <FlaskConical aria-hidden="true" className="size-4" />
      {shell.demoWorkspace}
      <span className="text-ink-muted font-normal max-xl:hidden">· {shell.demoNote}</span>
    </p>
  );

  return (
    <div className="md:pl-rail lg:pl-sidebar min-h-dvh print:pl-0">
      <a
        href="#main"
        className="rounded-input bg-brand fixed top-4 left-4 z-[60] -translate-y-24 px-4 py-2.5 font-medium text-white transition-transform focus:translate-y-0"
      >
        {nav.skip}
      </a>

      <aside className="on-nav w-rail bg-nav text-nav-ink lg:w-sidebar fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/[0.06] px-3 pb-4 md:flex lg:px-4 print:hidden">
        <Link href="/" aria-label={nav.home} className="h-topbar flex shrink-0 items-center text-white md:max-lg:justify-center lg:px-2">
          <Logo className="max-lg:hidden" />
          <LogoMark className="size-7 lg:hidden" />
        </Link>
        <NavLinks root={root} labels={nav} collapsible />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="border-line bg-canvas/95 sticky top-0 z-20 border-b backdrop-blur-sm print:hidden">
          <div className="h-topbar mx-auto flex w-full max-w-[1440px] items-center gap-3 px-5 md:px-7 lg:px-9">
            <MobileNav root={root} labels={nav} workspaceName={workspaceName} />
            <Breadcrumb workspaceName={workspaceName} labels={nav} />
            <div className="ml-auto flex items-center gap-2.5">
              <div className="flex items-center gap-2.5 max-lg:hidden">
                <PeriodPicker calendar={calendar} labels={messages.period} />
                {demoBadge}
              </div>
              <ThemeToggle labels={messages.theme} />
              {demo && (
                <LinkButton href="/signup" size="md">
                  {shell.tryYourData}
                </LinkButton>
              )}
              {account && (
                <form action={signOut} className="flex items-center gap-3">
                  <p className="text-ink-muted max-w-52 truncate max-xl:hidden" title={account.email}>
                    {account.email}
                  </p>
                  <button
                    type="submit"
                    className="rounded-input border-input bg-surface hover:bg-surface-2 inline-flex h-10 items-center gap-2 border px-3.5 font-medium transition-colors"
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    {messages.auth.signOut}
                  </button>
                </form>
              )}
            </div>
          </div>
          {/* Below the desktop width the period and the demo label take a row of their own, always in view. */}
          <div className="border-line flex items-center gap-2.5 overflow-x-auto border-t px-5 py-2.5 md:px-7 lg:hidden">
            <PeriodPicker calendar={calendar} labels={messages.period} />
            {demoBadge}
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-7 outline-none md:px-7 lg:px-9 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
