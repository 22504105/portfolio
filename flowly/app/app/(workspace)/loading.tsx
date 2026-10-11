import { Skeleton } from "@/components/ui/skeleton";
import { getMessages } from "@/lib/i18n";

// Shown while a workspace page is being prepared. Its blocks have the shape of
// what is coming: a title, four figures, a chart and a list.
export default function Loading() {
  return (
    <div role="status" aria-label={getMessages().loading}>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-5 w-80 max-w-full" />
      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:gap-6 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="rounded-card h-36" />
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:mt-6 lg:grid-cols-12 lg:gap-6">
        <Skeleton className="rounded-card h-96 lg:col-span-8" />
        <Skeleton className="rounded-card h-96 lg:col-span-4" />
      </div>
    </div>
  );
}
