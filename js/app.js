// ===== Navigation =====
// Die App hat nur eine HTML-Seite. Welche Ansicht sichtbar ist, steht im
// "Hash" der Adresse, also dem Teil nach dem # (z.B. index.html#plaene).
// Vorteil: Der Zurück-Knopf funktioniert und nach dem Neuladen bleibt man
// in derselben Ansicht.
//
// Unteransichten hängen wir mit "/" an: "#plaene/ppl" zeigt den Plan
// mit der id "ppl".

// Titel, die in der Kopfzeile angezeigt werden
const VIEW_TITLES = {
  training: "Training",
  plaene: "Pläne",
  verlauf: "Verlauf",
  daten: "Daten",
};

const DEFAULT_VIEW = "training";

// Liest die Ansicht aus der Adresse: "#plaene/ppl" -> ["plaene", "ppl"]
function parseHash() {
  const [viewName, param] = location.hash.slice(1).split("/");
  return { viewName: viewName || DEFAULT_VIEW, param };
}

// Zeigt die Ansicht passend zur aktuellen Adresse
function route() {
  let { viewName, param } = parseHash();

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

  // Standard-Kopfzeile; einzelne Ansichten können sie überschreiben
  setHeader(VIEW_TITLES[viewName]);

  // Ansichten mit dynamischem Inhalt neu zeichnen
  if (viewName === "plaene") {
    renderPlaene(param);
  }

  // Nach jedem Wechsel nach oben scrollen
  window.scrollTo(0, 0);
}

// Setzt den Titel und optional einen Zurück-Link in der Kopfzeile
function setHeader(title, backHref) {
  document.getElementById("view-title").textContent = title;
  const backLink = document.getElementById("back-link");
  backLink.hidden = !backHref;
  if (backHref) {
    backLink.href = backHref;
  }
}

// ===== Hilfsfunktion =====
// Wandelt Sonderzeichen wie < und > in "harmlose" Schreibweisen um, bevor
// Text in HTML eingesetzt wird. Sonst könnte ein Übungsname wie "<b>Test"
// das Layout zerstören. Wichtig, sobald Nutzer/innen eigene Texte eingeben.
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== Ansicht "Pläne" =====
function renderPlaene(planId) {
  const container = document.getElementById("view-plaene");

  // Kein Plan gewählt -> Übersicht aller Trainingsarten
  if (!planId) {
    container.innerHTML = renderPlanList(Store.getPlans());
    return;
  }

  // Plan gewählt -> Detailansicht mit seinen Einheiten
  const plan = Store.getPlan(planId);
  if (!plan) {
    // Plan existiert nicht (z.B. alte Adresse) -> zurück zur Übersicht
    location.hash = "plaene";
    return;
  }
  setHeader(plan.name, "#plaene");
  container.innerHTML = renderPlanDetail(plan);
}

// Übersicht: eine Karte pro Trainingsart
function renderPlanList(plans) {
  // map() macht aus jedem Plan ein Stück HTML, join("") klebt alles zusammen
  const cards = plans
    .map(
      (plan) => `
        <a class="card card-link" href="#plaene/${plan.id}">
          <h2 class="card-title">${escapeHtml(plan.name)}</h2>
          <p class="card-text">${escapeHtml(plan.description)}</p>
          <div class="chips">
            ${plan.units.map((unit) => `<span class="chip">${escapeHtml(unit.name)}</span>`).join("")}
          </div>
        </a>
      `
    )
    .join("");

  return `
    <p class="intro">Wähle eine Trainingsart, um ihre Einheiten zu sehen.</p>
    ${cards}
  `;
}

// Detailansicht: Beschreibung und Liste der Einheiten eines Plans
function renderPlanDetail(plan) {
  const rows = plan.units
    .map(
      (unit) => `
        <li class="list-row">
          <span class="list-title">${escapeHtml(unit.name)}</span>
          <span class="list-meta">${exerciseCountText(unit.exercises.length)}</span>
        </li>
      `
    )
    .join("");

  return `
    <p class="intro">${escapeHtml(plan.description)}</p>
    <h2 class="section-title">Einheiten</h2>
    <ul class="list">${rows}</ul>
  `;
}

// "Keine Übungen", "1 Übung", "3 Übungen"
function exerciseCountText(count) {
  if (count === 0) return "Noch keine Übungen";
  if (count === 1) return "1 Übung";
  return count + " Übungen";
}

// ===== Start =====
// Bei jedem Wechsel des Hashs (Tab angetippt, Zurück-Knopf) neu anzeigen
window.addEventListener("hashchange", route);

// Beim Start einmal die richtige Ansicht anzeigen
route();
