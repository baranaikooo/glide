const CACHE = "glide-light-v44";
const ASSETS = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/engine/training-core.js",
  "/engine/phrase-check.js",
  "/engine/phrase-audio-worklet.js",
  "/engine/word-bank.js",
  "/engine/lesson-plan.js",
  "/engine/lesson-session.js",
  "/engine/questions-and-voices.js",
  "/engine/dsp-core.js",
  "/engine/gamification-engine.js",
  "/engine/daf-assistant.js",
  "/engine/interface.js",
  "/engine/supabase-auth.js",
  "/engine/lifecycle.js",
  "/engine/updates.js",
  "/engine/practice.js",
  "/engine/conversation.js",
  "/engine/selects.js",
  "/audio/scenarios/glide-cafe-opening-v2.mp3",
  "/audio/scenarios/glide-shop-opening-v2.mp3",
  "/audio/scenarios/glide-shop-card-v2.mp3",
  "/audio/scenarios/glide-shop-cash-v2.mp3",
  "/audio/scenarios/glide-shop-clarify-v2.mp3",
  "/audio/scenarios/glide-shop-close-v2.mp3",
  "/audio/scenarios/glide-ambulancia-leda.mp3",
  "/audio/scenarios/glide-ambulancia-despina.mp3",
  "/audio/scenarios/glide-shop-opening.mp3",
  "/audio/scenarios/glide-own-opening.mp3",
  "/audio/scenarios/glide-cafe-branch-clarify.mp3",
  "/audio/scenarios/glide-cafe-branch-coffee.mp3",
  "/audio/scenarios/glide-cafe-branch-table.mp3",
  "/audio/scenarios/glide-cafe-branch-takeaway.mp3",
  "/audio/scenarios/glide-cafe-close-table.mp3",
  "/audio/scenarios/glide-cafe-close-takeaway.mp3",
  "/audio/scenarios/glide-cafe-close.mp3",
  "/audio/scenarios/glide-doctor-branch-book.mp3",
  "/audio/scenarios/glide-doctor-branch-change.mp3",
  "/audio/scenarios/glide-doctor-branch-clarify.mp3",
  "/audio/scenarios/glide-doctor-close.mp3",
  "/audio/scenarios/glide-own-branch-clarify.mp3",
  "/audio/scenarios/glide-own-branch-details.mp3",
  "/audio/scenarios/glide-own-branch-other.mp3",
  "/audio/scenarios/glide-own-close.mp3",
  "/audio/scenarios/glide-shop-branch-clarify.mp3",
  "/audio/scenarios/glide-shop-branch-return.mp3",
  "/audio/scenarios/glide-shop-branch-search.mp3",
  "/audio/scenarios/glide-shop-close.mp3",
  "/audio/scenarios/pokladna_4.mp3",
  "/audio/scenarios/kurier_2.mp3",
  "/audio/scenarios/lekar_4.mp3",
  "/audio/scenarios/servis_2.mp3",
  "/audio/scenarios/glide-cafe-ambience.mp3",
  "/audio/scenarios/glide-cafe-branch-clarify-alt.mp3",
  "/audio/scenarios/glide-cafe-branch-coffee-alt.mp3",
  "/audio/scenarios/glide-cafe-branch-table-alt.mp3",
  "/audio/scenarios/glide-cafe-branch-takeaway-alt.mp3",
  "/audio/scenarios/glide-cafe-close-alt.mp3",
  "/audio/scenarios/glide-cafe-close-table-alt.mp3",
  "/audio/scenarios/glide-cafe-close-takeaway-alt.mp3",
  "/audio/scenarios/glide-cafe-followup-alt.mp3",
  "/audio/scenarios/glide-cafe-followup.mp3",
  "/audio/scenarios/glide-cafe-opening-v2-alt.mp3",
  "/audio/scenarios/glide-doctor-branch-book-alt.mp3",
  "/audio/scenarios/glide-doctor-branch-change-alt.mp3",
  "/audio/scenarios/glide-doctor-branch-clarify-alt.mp3",
  "/audio/scenarios/glide-doctor-close-alt.mp3",
  "/audio/scenarios/glide-doctor-followup-alt.mp3",
  "/audio/scenarios/glide-doctor-followup.mp3",
  "/audio/scenarios/glide-own-branch-clarify-alt.mp3",
  "/audio/scenarios/glide-own-branch-details-alt.mp3",
  "/audio/scenarios/glide-own-branch-other-alt.mp3",
  "/audio/scenarios/glide-own-close-alt.mp3",
  "/audio/scenarios/glide-own-followup-alt.mp3",
  "/audio/scenarios/glide-own-followup.mp3",
  "/audio/scenarios/glide-own-opening-alt.mp3",
  "/audio/scenarios/glide-own-opening-base.mp3",
  "/audio/scenarios/glide-room-ambience.mp3",
  "/audio/scenarios/glide-shop-card-v2-alt.mp3",
  "/audio/scenarios/glide-shop-cash-v2-alt.mp3",
  "/audio/scenarios/glide-shop-clarify-v2-alt.mp3",
  "/audio/scenarios/glide-shop-close-v2-alt.mp3",
  "/audio/scenarios/glide-shop-followup-alt.mp3",
  "/audio/scenarios/glide-shop-followup.mp3",
  "/audio/scenarios/glide-shop-opening-v2-alt.mp3",
  "/audio/scenarios/glide-cafe-surprise.mp3",
  "/audio/scenarios/glide-cafe-surprise-alt.mp3",
  "/audio/scenarios/glide-doctor-surprise.mp3",
  "/audio/scenarios/glide-doctor-surprise-alt.mp3",
  "/audio/scenarios/glide-shop-surprise.mp3",
  "/audio/scenarios/glide-shop-surprise-alt.mp3",
  "/audio/scenarios/glide-own-surprise.mp3",
  "/audio/scenarios/glide-own-surprise-alt.mp3",
  "/audio/voice-manifest.json",
  "/audio/coach/boss_1.mp3",
  "/audio/coach/boss_2.mp3",
  "/audio/scenarios/pokladna_1.mp3",
  "/audio/scenarios/pokladna_payment.mp3",
  "/audio/scenarios/pokladna_payment_jaro.mp3",
  "/audio/courier.mp3",
  "/audio/cashier.mp3",
  "/audio/doctor.mp3",
  "/audio/automechanik.mp3",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ASSETS);
      const shell = await cache.match("/");
      const html = await shell.text();
      // Include Vite's hashed JS/CSS so offline works after the first production visit.
      const bundles = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(
        (match) => match[1],
      );
      await cache.addAll(bundles);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("glide-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_BUNDLES" || !Array.isArray(event.data.assets)) return;
  const assets = event.data.assets.filter((value) => {
    try {
      const url = new URL(value);
      return url.origin === self.location.origin && url.pathname.startsWith("/assets/");
    } catch (_) {
      return false;
    }
  });
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(assets)));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Do not cache API requests, OAuth responses, or development-server traffic.
  if (!ASSETS.includes(url.pathname) && !url.pathname.startsWith("/assets/")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(async () => (await caches.match(event.request)) || Response.error()),
  );
});


