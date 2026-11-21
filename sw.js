// ShiftMate (phone version) service worker.
// 1. Keeps the app's files on the phone so it opens instantly and works offline.
// 2. Serves "calendar.ics?d=..." as a real calendar file, so tapping
//    "Add to Calendar" makes the iPhone show its "Add All" calendar screen.
const CACHE = "shiftmate-phone-v2";
const SHELL = ["./", "index.html", "app.js", "core.js", "styles.css", "phone.css", "theme.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function fromB64u(s) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/calendar.ics")) {
    let body;
    try { body = fromB64u(url.searchParams.get("d") || ""); } catch (_) { body = ""; }
    if (!body.startsWith("BEGIN:VCALENDAR")) {
      e.respondWith(new Response("Calendar data is missing.", { status: 400 }));
      return;
    }
    e.respondWith(new Response(body, { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="shiftmate.ics"',
      "Cache-Control": "no-store",
    } }));
    return;
  }

  // App files: try the network first (so updates arrive), fall back to the saved copy offline.
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res.ok) (await caches.open(CACHE)).put(e.request, res.clone());
      return res;
    } catch (_) {
      return (await caches.match(e.request, { ignoreSearch: true })) ||
        (e.request.mode === "navigate" ? caches.match("index.html") : Response.error());
    }
  })());
});
