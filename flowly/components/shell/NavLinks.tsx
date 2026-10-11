"use client";

import { ChartLine, FileText, LayoutDashboard, Receipt, Settings, Upload, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Messages } from "@/lib/i18n";
import { PRIMARY_SECTIONS, sectionHref, type Section, type WorkspaceRoot } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ICONS: Record<Section, LucideIcon> = {
  overview: LayoutDashboard,
  analytics: ChartLine,
  customers: Users,
  transactions: Receipt,
  imports: Upload,
  reports: FileText,
  settings: Settings,
};

type NavLinksProps = {
  root: WorkspaceRoot;
  labels: Messages["nav"];
  /** On a tablet the sidebar is a rail of icons; the names stay for screen readers and as tooltips. */
  collapsible?: boolean;
  onNavigate?: () => void;
};

export function NavLinks({ root, labels, collapsible = false, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  const item = (section: Section) => {
    const href = sectionHref(root, section);
    const active = pathname === href || pathname.startsWith(`${href}/`);
    const Icon = ICONS[section];
    return (
      <li key={section}>
        <Link
          href={href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          title={collapsible ? labels[section] : undefined}
          className={cn(
            "relative flex h-11 items-center gap-3 rounded-[10px] px-3 text-[0.9375rem] font-medium transition-colors duration-200",
            collapsible && "md:max-lg:justify-center md:max-lg:px-0",
            active ? "bg-nav-raised text-white" : "text-nav-ink-muted hover:text-nav-ink hover:bg-white/5",
          )}
        >
          {/* The active page is marked by a bar and by weight, not by colour alone. */}
          {active && <span aria-hidden="true" className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-[#9d92ff]" />}
          <Icon aria-hidden="true" className={cn("size-[18px] shrink-0", active && "text-[#b9b0ff]")} />
          <span className={cn(collapsible && "md:max-lg:sr-only")}>{labels[section]}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label={labels.label} className="flex min-h-0 flex-1 flex-col justify-between gap-6 overflow-y-auto">
      <ul className="flex flex-col gap-1">{PRIMARY_SECTIONS.map(item)}</ul>
      <ul className="flex flex-col gap-1 border-t border-white/10 pt-3">{item("settings")}</ul>
    </nav>
  );
}
