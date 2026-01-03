/* sw.js — Network-first for HTML (avoids "stuck" old index.html) */
// Al cargar la app: activamos la clase para disparar el brillo diagonal 1 vez.
window.addEventListener("DOMContentLoaded", () => {
  const logo = document.querySelector(".logo");
  if (!logo) return;

  // dispara animación
  logo.classList.add("is-opening");

  // opcional: limpiar la clase al terminar (queda todo quieto)
  setTimeout(() => {
    logo.classList.remove("is-opening");
  }, 1400);
});

const CACHE_NAME = "manacor-pwa-v3"; // si vuelves a cambiar, sube a v4, v5, etc.

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest"
];

// Instalación: intenta precachear lo básico
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

// Activación: limpia cachés viejas
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// Fetch:
// - HTML: Network-first (si hay red, usa lo último SIEMPRE)
// - Otros: Stale-while-revalidate
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo manejar mismo origen (tu GitHub Pages)
  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get("accept") || "";
  const isHTML =
    accept.includes("text/html") ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith(".html");

  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    // guarda copia
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // fallback a index.html si falla navegación
    const fallback = await cache.match("./index.html");
    return fallback || new Response("Offline", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((fresh) => {
    cache.put(request, fresh.clone());
    return fresh;
  }).catch(() => null);

  return cached || (await fetchPromise) || new Response("", { status: 504 });
}

