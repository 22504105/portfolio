"use client";

import * as m from "motion/react-m";
import { createContext, useContext, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { CloseButton } from "@/components/ui/CloseButton";
import { Dialog, DIALOG_TRANSITION } from "@/components/ui/Dialog";
import { useViewingRequest } from "./ViewingRequest";

type Details = {
  open: (residenceId: string) => void;
  /** Closes the details and hands the residence on to the contact form. */
  requestViewing: () => void;
};

const DetailsContext = createContext<Details | null>(null);

function useDetails(): Details {
  const value = useContext(DetailsContext);
  if (!value) throw new Error("Residence components must be used inside ResidenceDetails");
  return value;
}

type ResidenceDetailsProps = {
  /** The residence cards. */
  children: ReactNode;
  /** The detail view of each residence by id, rendered on the server. */
  panels: Record<string, ReactNode>;
  /** Id of the heading inside every panel; it names the dialog. */
  titleId: string;
  /** Shown beside the close control. */
  label: string;
};

// A drawer over the right two-thirds of the page from `lg`, a full-screen sheet
// below. It only knows ids: what a residence is stays on the server.
export function ResidenceDetails({ children, panels, titleId, label }: ResidenceDetailsProps) {
  // The chosen residence outlives `open`, so its panel is still there to animate out.
  const [residenceId, setResidenceId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const viewingWanted = useRef(false);
  const { request } = useViewingRequest();

  const [details] = useState<Details>(() => ({
    open: (id) => {
      setResidenceId(id);
      setOpen(true);
    },
    requestViewing: () => {
      viewingWanted.current = true;
      setOpen(false);
    },
  }));

  return (
    <DetailsContext value={details}>
      {children}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        onExited={() => {
          // Only now is the page behind no longer inert, so the form can take focus.
          if (viewingWanted.current && residenceId) request(residenceId);
          viewingWanted.current = false;
        }}
        tone="base"
        labelledBy={titleId}
        scrim
      >
        <m.div
          className="absolute inset-y-0 right-0 w-full overflow-y-auto overscroll-contain bg-bg lg:w-2/3"
          initial={{ x: "100%" }}
          animate={{ x: 0, transition: DIALOG_TRANSITION.open }}
          exit={{ x: "100%", transition: DIALOG_TRANSITION.close }}
        >
          <div className="sticky top-0 z-10 flex h-header items-center justify-between border-b border-line bg-bg px-gutter lg:px-12">
            <p className="type-eyebrow text-ink-muted">{label}</p>
            <CloseButton onClick={() => setOpen(false)} />
          </div>
          {residenceId && panels[residenceId]}
        </m.div>
      </Dialog>
    </DetailsContext>
  );
}

type ResidenceCardProps = {
  children: ReactNode;
  residenceId: string;
  className?: string;
};

// The whole card opens the details. The card's "View Residence" button is the
// control for keyboard and assistive technology — its click arrives here too —
// and takes focus on any click, so focus returns to it when the details close.
export function ResidenceCard({ children, residenceId, className }: ResidenceCardProps) {
  const { open } = useDetails();

  const onClick = (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.querySelector("button")?.focus({ preventScroll: true });
    open(residenceId);
  };

  return (
    <article className={className} onClick={onClick}>
      {children}
    </article>
  );
}

export function ViewingButton({ children }: { children: ReactNode }) {
  const { requestViewing } = useDetails();

  return (
    <Button size="lg" className="max-sm:w-full" onClick={requestViewing}>
      {children}
    </Button>
  );
}
