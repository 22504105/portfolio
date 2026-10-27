import Link from "next/link";

// The site lives under /en/ and /ru/. A static page cannot redirect on the server, so this one
// picks the language from the browser and keeps plain links for everyone else.
const pick = `location.replace((navigator.language || "").toLowerCase().startsWith("ru") ? "/ru/" : "/en/")`;

export default function Root() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <script dangerouslySetInnerHTML={{ __html: pick }} />
      <div className="text-center">
        <p className="font-display text-2xl font-bold">Evgeniy · Full-Stack Web Developer</p>
        <p className="mt-6 flex justify-center gap-4">
          <Link className="rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent" href="/en/">
            English
          </Link>
          <Link className="rounded-full border border-line px-5 py-2.5 font-medium" href="/ru/">
            Русский
          </Link>
        </p>
      </div>
    </main>
  );
}
