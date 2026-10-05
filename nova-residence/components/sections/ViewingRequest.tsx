"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

type Listener = (residenceId: string) => void;

type ViewingRequest = {
  /** Asks for a viewing of a residence; the contact form takes it from there. */
  request: Listener;
  /** Registers the form. Returns the function that removes it again. */
  listen: (listener: Listener) => () => void;
};

const ViewingRequestContext = createContext<ViewingRequest | null>(null);

// Carries "request a viewing of this residence" from the residence details to
// the contact form, two sections apart, without either knowing the other.
export function ViewingRequestProvider({ children }: { children: ReactNode }) {
  const listener = useRef<Listener | null>(null);
  const [value] = useState<ViewingRequest>(() => ({
    request: (residenceId) => listener.current?.(residenceId),
    listen: (next) => {
      listener.current = next;
      return () => {
        listener.current = null;
      };
    },
  }));

  return <ViewingRequestContext value={value}>{children}</ViewingRequestContext>;
}

export function useViewingRequest(): ViewingRequest {
  const value = useContext(ViewingRequestContext);
  if (!value) throw new Error("useViewingRequest must be used inside ViewingRequestProvider");
  return value;
}
