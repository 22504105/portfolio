import type { ReactNode, Ref } from "react";
import type { Catalog } from "@/lib/catalog";
import type { WizardAction, WizardState } from "@/lib/booking/wizard";

/** What every step of the wizard is given. */
export type StepProps = {
  catalog: Catalog;
  state: WizardState;
  dispatch: (action: WizardAction) => void;
  /** True once the customer has tried to continue: the step then says what is missing. */
  attempted: boolean;
};

/**
 * A row to choose: the label of a visually hidden checkbox or radio button
 * that comes just before it. Keyboard and screen readers get the native
 * control; the row shows its state.
 */
export const CHOICE_ROW =
  "flex min-h-16 cursor-pointer items-center gap-4 border-b border-line py-4 transition-colors duration-(--duration-fast) " +
  "hover:text-signal peer-checked:text-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal";

/** The box at the start of a choice row; filled when the row is chosen. */
export function ChoiceMark({ round = false }: { round?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-6 shrink-0 place-items-center border border-fg ${round ? "rounded-full" : ""}`}
    >
      <span className={`size-3 scale-0 bg-signal transition-transform duration-(--duration-fast) group-has-[:checked]:scale-100 ${round ? "rounded-full" : ""}`} />
    </span>
  );
}

type StepHeadingProps = {
  title: string;
  lead: string;
  /** The wizard moves focus here when the step opens. */
  headingRef: Ref<HTMLHeadingElement>;
};

export function StepHeading({ title, lead, headingRef }: StepHeadingProps) {
  return (
    <>
      <h2 ref={headingRef} tabIndex={-1} className="type-h1 scroll-mt-28 outline-none">
        {title}
      </h2>
      <p className="type-lead mt-4 max-w-xl text-muted">{lead}</p>
    </>
  );
}

/** What is missing from a step, said once the customer has tried to continue. */
export function StepHint({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="type-body mt-6 flex items-baseline gap-3 font-medium">
      <span aria-hidden="true" className="size-2 shrink-0 bg-signal" />
      {children}
    </p>
  );
}
