// Everything under /demo runs on made-up data held in the page, writes nothing,
// and says so on screen. Visual QA hides the badge (data-demo-badge) so the
// screens can be compared with the approved designs.
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div
        data-demo-badge
        role="note"
        className="border-secondary/40 bg-secondary-container/90 font-label-sm text-secondary-fixed pointer-events-none fixed top-[calc(env(safe-area-inset-top,0px)+4px)] left-1/2 z-[60] -translate-x-1/2 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase"
      >
        Демо
      </div>
    </>
  );
}
