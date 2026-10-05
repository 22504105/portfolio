"use client";

import { useEffect, useState } from "react";
import { navigation } from "@/data/navigation";

// The underline grows on hover and stays under the section being read.
const NAV_LINK =
  "type-label relative block py-3 after:absolute after:inset-x-0 after:bottom-1 after:h-px " +
  "after:origin-left after:scale-x-0 after:bg-ink after:transition-transform " +
  "after:duration-(--duration-base) after:ease-quiet hover:after:scale-x-100 " +
  "aria-[current]:after:scale-x-100";

/** The section crossing the middle of the viewport, as a hash, if there is one. */
function useCurrentSection() {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const hash = `#${entry.target.id}`;
          if (entry.isIntersecting) setCurrent(hash);
          else setCurrent((previous) => (previous === hash ? null : previous));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    document.querySelectorAll("main > section[id]").forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return current;
}

// Sections without an entry here (the introduction, the amenities) mark nothing.
export function PrimaryNav() {
  const current = useCurrentSection();

  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center gap-8 xl:gap-10">
        {navigation.map((item) => (
          <li key={item.href}>
            {/* A plain anchor, so the browser also moves the keyboard's starting point to the section. */}
            <a
              href={item.href}
              aria-current={current === item.href ? "location" : undefined}
              className={NAV_LINK}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
