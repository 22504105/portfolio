import { cn } from "@/lib/utils";

// A face for every person, drawn here from their name: the same name always
// gets the same face. The concept shows portrait photos; Splitly stores no
// photos of anyone, so these are drawings, and they are decoration only: the
// name is always written next to them.

const SKIN = ["#F2C9A5", "#E8B48C", "#D9A074", "#C68A5E", "#A86F48", "#F6D7BC"];
const HAIR = ["#2B211C", "#4A3225", "#6B4A2F", "#8A5A2B", "#B5752F", "#1F1A17", "#7A3E22"];
const SHIRT = ["#173D35", "#2F6B58", "#D9825B", "#4F6FA8", "#B9A14A", "#8A5FA8", "#C4574F"];
const BACK = ["#E3F3E8", "#F4E6D4", "#E4EAF6", "#F6E1DE", "#EFE9F7", "#E8F1D8"];

/** A small, stable number from a text: enough to choose from a few options, nothing more. */
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

type AvatarProps = { name: string; /** What the face is chosen by; the name if not given. */ seed?: string; className?: string };

export function Avatar({ name, seed, className }: AvatarProps) {
  const key = seed ?? name;
  const pick = (what: string, options: readonly string[]) => options[hash(`${what}:${key}`) % options.length];
  const skin = pick("skin", SKIN);
  const hair = pick("hair", HAIR);
  const shirt = pick("shirt", SHIRT);
  const back = pick("back", BACK);
  const style = hash(`style:${key}`) % 6;

  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-10 shrink-0 rounded-full", className)}>
      <rect width="40" height="40" fill={back} />
      {/* Long hair goes behind the shoulders. */}
      {style === 1 && <path d="M8.5 19c0-8 5-12.5 11.5-12.5S31.500 11 31.500 19v11h-23z" fill={hair} />}
      {style === 3 && <circle cx="29.5" cy="8.5" r="4.200" fill={hair} />}
      <path d="M6 40c0-7.500 6-11.500 14-11.500S34 32.500 34 40z" fill={shirt} />
      <rect x="17" y="24" width="6" height="6.500" rx="2.500" fill={skin} />
      <circle cx="20" cy="18" r="8.200" fill={skin} />
      {style === 0 && (
        <path d="M11.500 17.500c-.6-6 3-10 8.500-10s9.100 4 8.500 10c-1.800-3.600-4.300-5-8.500-5s-6.700 1.400-8.500 5z" fill={hair} />
      )}
      {style === 1 && (
        <path
          d="M11.600 18.500c-.4-6.200 3.200-10.300 8.400-10.300s8.800 4.100 8.400 10.300c-2-4.400-5.200-6.200-8.400-6.200s-6.400 1.800-8.400 6.200z"
          fill={hair}
        />
      )}
      {style === 2 && (
        <path
          d="M11.300 16.500c0-5.500 3.700-9.300 8.700-9.300 5.300 0 8.900 3.600 8.700 9.300-1.500-2.400-3-3.500-4.700-3.800-2.300 1.900-7.400 2-12.700 3.800z"
          fill={hair}
        />
      )}
      {style === 3 && (
        <path
          d="M11.400 18c-.5-6.300 3.300-10.400 8.600-10.400s9.100 4.100 8.600 10.400c-1.600-3.900-4.600-5.600-8.600-5.600s-7 1.700-8.600 5.600z"
          fill={hair}
        />
      )}
      {style === 4 && (
        <path
          d="M11.800 15.500c.2-5 3.600-8.300 8.200-8.300s8 3.300 8.200 8.300c-2.200-2.600-4.800-3.400-8.200-3.400s-6 .8-8.200 3.400z"
          fill={hair}
        />
      )}
      {style === 5 && (
        <>
          <path
            d="M11.500 16c0-5.600 3.800-9 8.500-9s8.500 3.400 8.500 9c-1.300-2.900-3.300-4.300-5.400-4.300-3.300 0-6.900.7-11.600 4.300z"
            fill={hair}
          />
          <path d="M14.300 23.300c1.500 3.100 9.900 3.100 11.400 0-.5 4.200-10.900 4.200-11.400 0z" fill={hair} opacity="0.9" />
        </>
      )}
      <circle cx="16.800" cy="18.600" r="1" fill="#2B211C" />
      <circle cx="23.200" cy="18.600" r="1" fill="#2B211C" />
      <path d="M17 22.200c1.800 1.500 4.200 1.500 6 0" fill="none" stroke="#2B211C" strokeWidth="1" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}

type StackProps = {
  people: readonly { id: string; name: string }[];
  /** How many faces to draw before "+N". */ max?: number;
  className?: string;
  ring?: string;
};

/** A few faces overlapping, then how many more there are. */
export function AvatarStack({ people, max = 3, className, ring = "ring-surface" }: StackProps) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <span className={cn("flex items-center", className)}>
      {shown.map((person, index) => (
        <Avatar key={person.id} name={person.name} seed={person.id} className={cn("size-9 ring-2", ring, index > 0 && "-ml-2")} />
      ))}
      {more > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "bg-surface-2 text-ink -ml-2 flex size-9 items-center justify-center rounded-full text-[0.75rem] font-semibold ring-2",
            ring,
          )}
        >
          +{more}
        </span>
      )}
    </span>
  );
}
