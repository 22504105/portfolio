import { fill, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type StageNoticeProps = {
  title: string;
  lead: string;
  /** The stage that builds this screen. */
  stage: number;
  labels: Dictionary["stage"];
};

const CURRENT_STAGE = 3;

/**
 * A screen whose content is not written yet. It says so plainly, and shows
 * the plan, with where the work is now. It is replaced by the real screen in
 * the stage that builds it.
 */
export function StageNotice({ title, lead, stage, labels }: StageNoticeProps) {
  return (
    <>
      <h1 className="type-title">{title}</h1>
      <p className="type-lead text-ink-muted mt-2">{lead}</p>

      <section aria-labelledby="stage-title" className="card mt-6 p-5 sm:p-6">
        <h2 id="stage-title" className="type-heading">
          {fill(labels.title, { stage })}
        </h2>
        <p className="type-small text-ink-muted mt-2">{labels.body}</p>

        <h3 className="type-label text-ink-muted mt-6">{labels.plan}</h3>
        <ol className="mt-3 flex flex-col gap-2.5">
          {labels.stages.map((text, index) => {
            const number = index + 1;
            const done = number < CURRENT_STAGE;
            const now = number === CURRENT_STAGE;
            return (
              <li key={text} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "type-small mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums",
                    done || now ? "bg-primary text-on-primary" : "border-field text-ink-muted border",
                    number === stage && !now && "border-primary text-ink border-2",
                  )}
                >
                  {number}
                </span>
                <span className={cn("type-small", number === stage ? "text-ink font-semibold" : "text-ink-muted")}>
                  {text}
                  {now && (
                    <span className="bg-accent text-on-accent ml-2 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold">
                      {labels.current}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
