import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ContainerProps = {
  children: ReactNode;
  as?: ElementType;
  size?: "default" | "narrow";
  className?: string;
};

export function Container({
  children,
  as: Component = "div",
  size = "default",
  className,
}: ContainerProps) {
  return (
    <Component
      className={cn(
        "mx-auto w-full px-gutter",
        size === "narrow" ? "max-w-narrow" : "max-w-site",
        className,
      )}
    >
      {children}
    </Component>
  );
}
