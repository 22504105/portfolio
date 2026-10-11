import { notFound } from "next/navigation";
import type { AdminSource } from "@/lib/admin/types";
import { AdminShell } from "./AdminShell";
import { BookingDetailView } from "./BookingDetailView";
import { BookingsView } from "./BookingsView";
import { CalendarView } from "./CalendarView";
import { BarbersView, ServicesView } from "./CatalogViews";
import { NewBookingView } from "./NewBookingView";
import { OverviewView } from "./OverviewView";
import { Notice, SECTIONS, type AdminContext, type Section } from "./parts";
import { AnalyticsView, ClientsView, SettingsView } from "./ReportViews";

type AdminAppProps = {
  source: AdminSource;
  base: "/admin" | "/demo/admin";
  locale: "en" | "ru";
  /** The part of the address after the base: [], ["bookings"], ["bookings", "<id>"]... */
  segments: string[];
  searchParams: Record<string, string | string[] | undefined>;
};

// One set of pages for the real admin and for the public demo. Which of the
// two it is depends only on the source handed in: the demo's source has no
// database behind it and is read-only, so the same page shows no forms there.
export async function AdminApp({ source, base, locale, segments, searchParams }: AdminAppProps) {
  const [first = "overview", second, ...rest] = segments;
  const section = SECTIONS.find((candidate) => candidate === first) as Section | undefined;
  // Only bookings have pages below them.
  if (!section || rest.length > 0 || (second && section !== "bookings")) notFound();
  // Creating a booking is not part of the demo.
  if (second === "new" && source.readOnly) notFound();

  const query = Object.fromEntries(Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const queryAll = Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [key, value === undefined ? [] : Array.isArray(value) ? value : [value]]),
  );
  const context: AdminContext = { source, base, locale, query };

  return (
    <AdminShell base={base} section={section}>
      <Notice value={query.notice} />
      {section === "overview" && <OverviewView {...context} />}
      {section === "calendar" && <CalendarView {...context} />}
      {section === "bookings" && !second && <BookingsView {...context} />}
      {section === "bookings" && second === "new" && <NewBookingView {...context} queryAll={queryAll} />}
      {section === "bookings" && second && second !== "new" && <BookingDetailView {...context} id={second} />}
      {section === "services" && <ServicesView {...context} />}
      {section === "barbers" && <BarbersView {...context} />}
      {section === "clients" && <ClientsView {...context} />}
      {section === "analytics" && <AnalyticsView {...context} />}
      {section === "settings" && <SettingsView {...context} />}
    </AdminShell>
  );
}
