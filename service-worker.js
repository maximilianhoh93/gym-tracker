// ===== Service Worker: macht die App offline nutzbar =====
// Ein Service Worker ist ein Skript, das der Browser im Hintergrund laufen
// lässt. Es sitzt zwischen der App und dem Internet: Jede Anfrage nach einer
// Datei (HTML, CSS, JavaScript, Bilder) geht zuerst an ihn.
//
// Strategie "sofort aus dem Speicher, im Hintergrund aktualisieren"
// (Fachbegriff: stale-while-revalidate):
// - Liegt eine Datei im Speicher ("Cache"), bekommt die App sie SOFORT.
//   So startet sie auch ohne Internet, z.B. im Studio im Keller.
// - Gleichzeitig wird im Hintergrund die neueste Version aus dem Internet
//   geholt und gespeichert. Beim nächsten Öffnen ist das Update da.
// Deine Trainingsdaten sind davon nicht betroffen: Die liegen im
// localStorage, nicht im Cache.

// Name des Speichers. Ändert man ihn, wird der alte Speicher gelöscht
// (nur nötig, wenn sich der Aufbau grundlegend ändert).
const CACHE_NAME = "gymtracker-v1";

// Alle Dateien, die die App zum Starten braucht
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/storage.js",
  "./js/timer.js",
  "./js/charts.js",
  "./js/progress.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png",
];

// 1. Installation: alle App-Dateien einmal herunterladen und speichern
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  // Neue Version sofort aktiv werden lassen, ohne auf das Schließen zu warten
  self.skipWaiting();
});

// 2. Aktivierung: Speicher mit altem Namen aufräumen
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()) // auch schon offene Seiten übernehmen
  );
});

// 3. Jede Anfrage: sofort aus dem Speicher, im Hintergrund aktualisieren
self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Nur Dateien der App selbst (gleiche Adresse) und nur Lese-Anfragen
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;

  // Die App hat nur eine Seite: Jede Seiten-Anfrage bekommt index.html
  const key = request.mode === "navigate" ? "./index.html" : request;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: true });
      // Im Hintergrund die neueste Version holen und speichern
      const update = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(key, response.clone());
          return response;
        })
        .catch(() => cached); // kein Internet: einfach beim Gespeicherten bleiben
      // Gespeichertes sofort zurückgeben, sonst auf das Internet warten
      return cached || update;
    })
  );
});
