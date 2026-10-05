// ===== Navigation =====
// Die App hat nur eine HTML-Seite. Welche Ansicht sichtbar ist, steht im
// "Hash" der Adresse, also dem Teil nach dem # (z.B. index.html#plaene).
// Vorteil: Der Zurück-Knopf funktioniert und nach dem Neuladen bleibt man
// in derselben Ansicht.
//
// Unteransichten hängen wir mit "/" an: "#plaene/ppl" zeigt den Plan
// mit der id "ppl", "#plaene/ppl/ppl-push" dessen Einheit "Push".

// Titel, die in der Kopfzeile angezeigt werden
const VIEW_TITLES = {
  training: "Training",
  plaene: "Pläne",
  verlauf: "Verlauf",
  daten: "Daten",
};

const DEFAULT_VIEW = "training";

// Liest die Ansicht aus der Adresse:
// "#plaene/ppl/ppl-push" -> viewName "plaene", params ["ppl", "ppl-push"]
function parseHash() {
  const [viewName, ...params] = location.hash.slice(1).split("/");
  return { viewName: viewName || DEFAULT_VIEW, params };
}

// Zeigt die Ansicht passend zur aktuellen Adresse
function route() {
  let { viewName, params } = parseHash();

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
    renderPlaene(params[0], params[1]);
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
// Drei Ebenen: Übersicht aller Pläne -> ein Plan -> eine Einheit
function renderPlaene(planId, unitId) {
  const container = document.getElementById("view-plaene");

  // Kein Plan gewählt -> Übersicht aller Trainingsarten
  if (!planId) {
    container.innerHTML = renderPlanList(Store.getPlans());
    return;
  }

  const plan = Store.getPlan(planId);
  if (!plan) {
    // Plan existiert nicht (z.B. alte Adresse) -> zurück zur Übersicht
    location.hash = "plaene";
    return;
  }

  // Nur Plan gewählt -> Detailansicht mit seinen Einheiten
  if (!unitId) {
    setHeader(plan.name, "#plaene");
    container.innerHTML = renderPlanDetail(plan);
    return;
  }

  // Einheit gewählt -> ihre Übungen anzeigen und bearbeiten
  const unit = Store.getUnit(planId, unitId);
  if (!unit) {
    location.hash = "plaene/" + planId;
    return;
  }
  setHeader(unit.name, "#plaene/" + planId);
  container.innerHTML = renderUnitDetail(plan, unit);
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
  // Jede Zeile ist ein Link zur Einheit
  const rows = plan.units
    .map(
      (unit) => `
        <li>
          <a class="list-row list-link" href="#plaene/${plan.id}/${unit.id}">
            <span class="list-title">${escapeHtml(unit.name)}</span>
            <span class="list-meta">${exerciseCountText(unit.exercises.length)} ›</span>
          </a>
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

// Einheit: Liste der Übungen plus Formular zum Hinzufügen.
// Die Knöpfe bekommen "data-"-Attribute. Darüber erkennt der
// Klick-Behandler weiter unten, welcher Knopf für welche Übung gedrückt wurde.
function renderUnitDetail(plan, unit) {
  const count = unit.exercises.length;

  const rows = unit.exercises
    .map(
      (exercise, index) => `
        <li class="list-row">
          <span class="list-title">${escapeHtml(exercise.name)}</span>
          <span class="row-actions">
            <button class="icon-button" data-action="move-up" data-id="${exercise.id}"
              aria-label="Nach oben" ${index === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-button" data-action="move-down" data-id="${exercise.id}"
              aria-label="Nach unten" ${index === count - 1 ? "disabled" : ""}>↓</button>
            <button class="icon-button danger" data-action="delete" data-id="${exercise.id}"
              aria-label="Löschen">✕</button>
          </span>
        </li>
      `
    )
    .join("");

  // Bei leerer Liste einen Hinweis statt einer leeren Box zeigen
  const list =
    count === 0
      ? `<p class="placeholder">Noch keine Übungen. Füge unten die erste hinzu.</p>`
      : `<ul class="list">${rows}</ul>`;

  // Das Formular merkt sich in data-plan / data-unit, wohin die Übung gehört
  return `
    <p class="intro">${escapeHtml(plan.name)} · ${exerciseCountText(count)}</p>
    ${list}
    <form id="add-exercise-form" class="add-form" data-plan="${plan.id}" data-unit="${unit.id}">
      <input type="text" name="name" class="text-input" placeholder="z.B. Bankdrücken"
        autocomplete="off" required maxlength="60" aria-label="Name der Übung">
      <button type="submit" class="button-primary">Hinzufügen</button>
    </form>
  `;
}

// "Keine Übungen", "1 Übung", "3 Übungen"
function exerciseCountText(count) {
  if (count === 0) return "Noch keine Übungen";
  if (count === 1) return "1 Übung";
  return count + " Übungen";
}

// ===== Reaktionen auf Eingaben in der Pläne-Ansicht =====
// Der Inhalt wird bei jeder Änderung neu gezeichnet, Knöpfe und Formular
// sind danach also neue Elemente. Deshalb hängen wir die Behandler nicht an
// die einzelnen Knöpfe, sondern EINMAL an den umgebenden Container.
// Ein Klick "blubbert" vom Knopf nach oben bis zum Container
// ("Event Delegation"), und dort schauen wir nach, was angetippt wurde.

const plaeneView = document.getElementById("view-plaene");

// Formular "Übung hinzufügen" abgeschickt (Knopf oder Enter-Taste)
plaeneView.addEventListener("submit", (event) => {
  event.preventDefault(); // Verhindert, dass der Browser die Seite neu lädt

  const form = event.target;
  const name = form.elements.name.value.trim(); // trim(): Leerzeichen am Rand weg
  if (!name) return;

  Store.addExercise(form.dataset.plan, form.dataset.unit, name);
  rerenderPlaene();

  // Das Eingabefeld wieder aktivieren, damit man direkt die nächste Übung
  // eintippen kann
  document.querySelector("#add-exercise-form input").focus();
});

// Knöpfe ↑ ↓ ✕ bei einer Übung
plaeneView.addEventListener("click", (event) => {
  // closest() sucht vom angetippten Element aufwärts den nächsten Knopf
  // mit data-action (falls man z.B. genau auf das Symbol tippt)
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const [planId, unitId] = parseHash().params;
  const exerciseId = button.dataset.id;

  if (button.dataset.action === "move-up") {
    Store.moveExercise(planId, unitId, exerciseId, -1);
  } else if (button.dataset.action === "move-down") {
    Store.moveExercise(planId, unitId, exerciseId, +1);
  } else if (button.dataset.action === "delete") {
    const exercise = Store.getUnit(planId, unitId).exercises.find((ex) => ex.id === exerciseId);
    // confirm() zeigt den Standard-Dialog des iPhones mit "OK" / "Abbrechen"
    if (!confirm(`„${exercise.name}“ aus dieser Einheit löschen?`)) return;
    Store.removeExercise(planId, unitId, exerciseId);
  }

  rerenderPlaene();
});

// Zeichnet die Pläne-Ansicht neu, ohne nach oben zu scrollen
function rerenderPlaene() {
  const [planId, unitId] = parseHash().params;
  renderPlaene(planId, unitId);
}

// ===== Start =====
// Bei jedem Wechsel des Hashs (Tab angetippt, Zurück-Knopf) neu anzeigen
window.addEventListener("hashchange", route);

// Beim Start einmal die richtige Ansicht anzeigen
route();
