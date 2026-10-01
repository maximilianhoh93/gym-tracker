// ===== Navigation =====
// Die App hat nur eine HTML-Seite. Welche Ansicht sichtbar ist, steht im
// "Hash" der Adresse, also dem Teil nach dem # (z.B. index.html#plaene).
// Vorteil: Der Zurück-Knopf funktioniert und nach dem Neuladen bleibt man
// in derselben Ansicht.

// Titel, die in der Kopfzeile angezeigt werden
const VIEW_TITLES = {
  training: "Training",
  plaene: "Pläne",
  verlauf: "Verlauf",
  daten: "Daten",
};

const DEFAULT_VIEW = "training";

// Zeigt die gewünschte Ansicht und versteckt alle anderen
function showView(viewName) {
  // Unbekannter Name (z.B. Tippfehler in der Adresse)? Dann Startansicht.
  if (!VIEW_TITLES[viewName]) {
    viewName = DEFAULT_VIEW;
  }

  // Alle Ansichten durchgehen: nur die passende bleibt sichtbar
  document.querySelectorAll(".view").forEach((section) => {
    section.hidden = section.id !== "view-" + viewName;
  });

  // Den passenden Tab unten als aktiv markieren
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });

  document.getElementById("view-title").textContent = VIEW_TITLES[viewName];
}

// Liest die Ansicht aus der Adresse ("#plaene" -> "plaene")
function currentViewFromHash() {
  return location.hash.slice(1) || DEFAULT_VIEW;
}

// Bei jedem Wechsel des Hashs (Tab angetippt, Zurück-Knopf) neu anzeigen
window.addEventListener("hashchange", () => showView(currentViewFromHash()));

// Beim Start einmal die richtige Ansicht anzeigen
showView(currentViewFromHash());
