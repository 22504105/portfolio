// CUT&CO service worker.
//
// What it does: keeps the files a page is built from (scripts, styles, fonts,
// photographs) so pages open quickly, and shows an honest "you are offline"
// page when there is no connection.
//
// What it deliberately does not do: keep pages. No page of the site is ever
// served from a cache — not the booking form, not a calendar, not an account.
// A booking page shown from yesterday would offer times that are gone, and a
// cached account page would show one person's bookings to the next person on
// the phone. Offline, every page is the offline page, and nothing pretends to
// have been booked.

const VERSION = "v2";
const ASSETS = `cutco-assets-${VERSION}`;
const SHELL = `cutco-shell-${VERSION}`;
// Plain files, not pages of the application: shown in place of another
// address, an application page would try to load that address and fail.
const OFFLINE = { en: "/offline-en.html", ru: "/offline-ru.html" };

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE.en, OFFLINE.ru, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== ASSETS && name !== SHELL).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Files whose address changes whenever their content does, or that never change.
const isAsset = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/images/");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only reading, only our own site. Form posts, server actions and anything
  // sent elsewhere go straight to the network, untouched.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(url.pathname.startsWith("/ru") ? OFFLINE.ru : OFFLINE.en);
        return offline ?? new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Everything else — data for pages, the image optimiser, the API — is not ours to keep.
});
