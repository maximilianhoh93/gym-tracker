// ===== Navigation =====
// Die App hat nur eine HTML-Seite. Welche Ansicht sichtbar ist, steht im
// "Hash" der Adresse, also dem Teil nach dem # (z.B. index.html#plaene).
// Vorteil: Der Zurück-Knopf funktioniert und nach dem Neuladen bleibt man
// in derselben Ansicht.
//
// Unteransichten hängen wir mit "/" an:
//   #plaene/ppl                    -> der Plan "Push/Pull/Legs"
//   #plaene/ppl/ppl-push           -> dessen Einheit "Push"
//   #plaene/ppl/ppl-push/auswahl   -> Übungen für "Push" aus dem Pool auswählen

// Titel, die in der Kopfzeile angezeigt werden
const VIEW_TITLES = {
  training: "Training",
  plaene: "Pläne",
  uebungen: "Übungen",
  verlauf: "Verlauf",
  daten: "Daten",
};

const DEFAULT_VIEW = "training";

// Zuletzt gewählte Muskelgruppe im Formular "Neue Übung". So muss man sie
// nicht jedes Mal neu wählen, wenn man mehrere Brust-Übungen anlegt.
let lastMuscleGroupId = "";

// Liest die Ansicht aus der Adresse:
// "#plaene/ppl/ppl-push" -> viewName "plaene", params ["ppl", "ppl-push"]
function parseHash() {
  let [viewName, ...params] = location.hash.slice(1).split("/");
  // Unbekannter Name (z.B. Tippfehler in der Adresse)? Dann Startansicht.
  if (!VIEW_TITLES[viewName]) {
    viewName = DEFAULT_VIEW;
  }
  return { viewName, params };
}

// Wird bei jedem Wechsel der Adresse aufgerufen
function route() {
  const { viewName } = parseHash();

  // Alle Ansichten durchgehen: nur die passende bleibt sichtbar
  document.querySelectorAll(".view").forEach((section) => {
    section.hidden = section.id !== "view-" + viewName;
  });

  // Den passenden Tab unten als aktiv markieren
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });

  renderCurrentView();

  // Nach jedem Wechsel nach oben scrollen
  window.scrollTo(0, 0);
}

// Zeichnet den Inhalt der aktuellen Ansicht (neu). Wird auch nach jeder
// Änderung aufgerufen, dann aber ohne nach oben zu scrollen.
function renderCurrentView() {
  const { viewName, params } = parseHash();

  // Standard-Kopfzeile; einzelne Ansichten können sie überschreiben
  setHeader(VIEW_TITLES[viewName]);

  if (viewName === "plaene") {
    renderPlaene(params[0], params[1], params[2]);
  } else if (viewName === "uebungen") {
    renderUebungen();
  }
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

// ===== Hilfsfunktionen =====

// Wandelt Sonderzeichen wie < und > in "harmlose" Schreibweisen um, bevor
// Text in HTML eingesetzt wird. Sonst könnte ein Übungsname wie "<b>Test"
// das Layout zerstören. Wichtig, sobald Nutzer/innen eigene Texte eingeben.
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// "Keine Übungen", "1 Übung", "3 Übungen"
function exerciseCountText(count) {
  if (count === 0) return "Noch keine Übungen";
  if (count === 1) return "1 Übung";
  return count + " Übungen";
}

// Anzeigename einer Muskelgruppe, z.B. "brust" -> "Brust"
function muscleGroupName(muscleGroupId) {
  const group = Store.getMuscleGroups().find((g) => g.id === muscleGroupId);
  return group ? group.name : "";
}

// Sortiert Übungen in Gruppen nach Muskelgruppe.
// Ergebnis: [{ group: {id, name}, exercises: [...] }, ...]
// Muskelgruppen ohne Übungen werden weggelassen.
function groupByMuscle(exercises) {
  return Store.getMuscleGroups()
    .map((group) => ({
      group: group,
      exercises: exercises.filter((ex) => ex.muscleGroupId === group.id),
    }))
    .filter((entry) => entry.exercises.length > 0);
}

// Formular "Neue Übung anlegen". Wird im Pool und in der Auswahl benutzt.
// planId/unitId sind nur in der Auswahl gesetzt: Dann wird die neue Übung
// gleich auch zur Einheit hinzugefügt.
function renderExerciseForm(planId = "", unitId = "") {
  const options = Store.getMuscleGroups()
    .map(
      (g) =>
        `<option value="${g.id}" ${g.id === lastMuscleGroupId ? "selected" : ""}>${escapeHtml(g.name)}</option>`
    )
    .join("");

  return `
    <form class="exercise-form" data-plan="${planId}" data-unit="${unitId}">
      <input type="text" name="name" class="text-input" placeholder="Name, z.B. Bankdrücken"
        autocomplete="off" required maxlength="60" aria-label="Name der Übung">
      <div class="form-row">
        <select name="muscleGroup" class="select-input" required aria-label="Muskelgruppe">
          <option value="" disabled ${lastMuscleGroupId ? "" : "selected"}>Muskelgruppe…</option>
          ${options}
        </select>
        <button type="submit" class="button-primary">Anlegen</button>
      </div>
    </form>
  `;
}

// ===== Ansicht "Pläne" =====
// Ebenen: Übersicht aller Pläne -> ein Plan -> eine Einheit -> Auswahl
function renderPlaene(planId, unitId, subView) {
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

  const unit = Store.getUnit(planId, unitId);
  if (!unit) {
    location.hash = "plaene/" + planId;
    return;
  }
  const unitHref = `#plaene/${plan.id}/${unit.id}`;

  // Auswahl aus dem Pool
  if (subView === "auswahl") {
    setHeader("Übungen auswählen", unitHref);
    container.innerHTML = renderExercisePicker(plan, unit);
    return;
  }

  // Einheit -> ihre Übungen anzeigen und sortieren
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
            <span class="list-meta">${exerciseCountText(unit.exerciseIds.length)} ›</span>
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

// Einheit: die ausgewählten Übungen als Kästchen, sortierbar per Drag and Drop.
// Die Knöpfe bekommen "data-"-Attribute. Darüber erkennt der
// Klick-Behandler weiter unten, welcher Knopf für welche Übung gedrückt wurde.
function renderUnitDetail(plan, unit) {
  // Aus den gespeicherten ids die vollständigen Übungen holen
  const exercises = unit.exerciseIds.map((id) => Store.getExercise(id)).filter(Boolean);

  const cards = exercises
    .map(
      (exercise) => `
        <li class="exercise-card" data-id="${exercise.id}">
          <span class="exercise-info">
            <span class="exercise-name">${escapeHtml(exercise.name)}</span>
            <span class="exercise-meta">${escapeHtml(muscleGroupName(exercise.muscleGroupId))}</span>
          </span>
          <button class="icon-button danger" data-action="remove-from-unit" data-id="${exercise.id}"
            aria-label="Aus der Einheit entfernen">✕</button>
          <span class="drag-handle" aria-label="Zum Verschieben ziehen">≡</span>
        </li>
      `
    )
    .join("");

  // Bei leerer Liste einen Hinweis statt einer leeren Fläche zeigen
  const list =
    exercises.length === 0
      ? `<p class="placeholder">Noch keine Übungen ausgewählt.</p>`
      : `<ul class="card-list sortable">${cards}</ul>`;

  const hint =
    exercises.length > 1 ? `<p class="hint">Zum Sortieren eine Übung am ≡ ziehen.</p>` : "";

  return `
    <p class="intro">${escapeHtml(plan.name)} · ${exerciseCountText(exercises.length)}</p>
    ${list}
    ${hint}
    <a class="button-secondary" href="#plaene/${plan.id}/${unit.id}/auswahl">+ Übungen auswählen</a>
  `;
}

// Auswahl: alle Übungen aus dem Pool, gruppiert nach Muskelgruppe.
// Antippen fügt die Übung zur Einheit hinzu oder entfernt sie wieder.
function renderExercisePicker(plan, unit) {
  const groups = groupByMuscle(Store.getExercises());

  const sections = groups
    .map(
      ({ group, exercises }) => `
        <h2 class="section-title">${escapeHtml(group.name)}</h2>
        <ul class="card-list">
          ${exercises
            .map((exercise) => {
              const selected = unit.exerciseIds.includes(exercise.id);
              return `
                <li>
                  <button class="exercise-card pick-card ${selected ? "selected" : ""}"
                    data-action="toggle-in-unit" data-id="${exercise.id}" aria-pressed="${selected}">
                    <span class="exercise-name">${escapeHtml(exercise.name)}</span>
                    <span class="check" aria-hidden="true">${selected ? "✓" : ""}</span>
                  </button>
                </li>
              `;
            })
            .join("")}
        </ul>
      `
    )
    .join("");

  const poolContent =
    groups.length === 0
      ? `<p class="placeholder">Dein Übungs-Pool ist noch leer. Lege unten die erste Übung an.</p>`
      : sections;

  return `
    <p class="intro">Tippe Übungen an, um sie zu „${escapeHtml(unit.name)}“ hinzuzufügen oder zu entfernen.</p>
    ${poolContent}
    <h2 class="section-title">Neue Übung anlegen</h2>
    ${renderExerciseForm(plan.id, unit.id)}
    <a class="button-secondary" href="#plaene/${plan.id}/${unit.id}">Fertig</a>
  `;
}

// ===== Ansicht "Übungen" (der Pool) =====
function renderUebungen() {
  const container = document.getElementById("view-uebungen");
  const groups = groupByMuscle(Store.getExercises());

  const sections = groups
    .map(
      ({ group, exercises }) => `
        <h2 class="section-title">${escapeHtml(group.name)}</h2>
        <ul class="card-list">
          ${exercises
            .map((exercise) => {
              const usage = Store.countUnitsUsingExercise(exercise.id);
              const usageText =
                usage === 0 ? "In keiner Einheit" : usage === 1 ? "In 1 Einheit" : `In ${usage} Einheiten`;
              return `
                <li class="exercise-card">
                  <span class="exercise-info">
                    <span class="exercise-name">${escapeHtml(exercise.name)}</span>
                    <span class="exercise-meta">${usageText}</span>
                  </span>
                  <button class="icon-button danger" data-action="delete-exercise" data-id="${exercise.id}"
                    aria-label="Übung löschen">✕</button>
                </li>
              `;
            })
            .join("")}
        </ul>
      `
    )
    .join("");

  container.innerHTML = `
    <p class="intro">Lege jede Übung hier einmal an. In deinen Plänen wählst du sie dann pro Einheit aus.</p>
    ${renderExerciseForm()}
    ${groups.length === 0 ? `<p class="placeholder">Noch keine Übungen im Pool.</p>` : sections}
  `;
}

// ===== Reaktionen auf Eingaben =====
// Der Inhalt wird bei jeder Änderung neu gezeichnet, Knöpfe und Formulare
// sind danach also neue Elemente. Deshalb hängen wir die Behandler nicht an
// die einzelnen Knöpfe, sondern EINMAL an den Hauptbereich <main>.
// Ein Klick "blubbert" vom Knopf nach oben bis dorthin ("Event Delegation"),
// und dort schauen wir nach, was angetippt wurde.

const appMain = document.querySelector(".app-main");

// Formular "Neue Übung anlegen" abgeschickt (Knopf oder Enter-Taste)
appMain.addEventListener("submit", (event) => {
  event.preventDefault(); // Verhindert, dass der Browser die Seite neu lädt

  const form = event.target;
  const name = form.elements.name.value.trim(); // trim(): Leerzeichen am Rand weg
  const muscleGroupId = form.elements.muscleGroup.value;
  if (!name || !muscleGroupId) return;

  const exercise = Store.addExercise(name, muscleGroupId);
  if (!exercise) {
    alert(`„${name}“ gibt es schon in deinem Übungs-Pool.`);
    return;
  }
  lastMuscleGroupId = muscleGroupId;

  // In der Auswahl: neue Übung gleich zur Einheit hinzufügen
  if (form.dataset.unit) {
    Store.addExerciseToUnit(form.dataset.plan, form.dataset.unit, exercise.id);
  }

  renderCurrentView();
  // Das Namensfeld wieder aktivieren, damit man direkt weitertippen kann
  document.querySelector(".view:not([hidden]) .exercise-form input").focus();
});

// Knöpfe mit data-action
appMain.addEventListener("click", (event) => {
  // closest() sucht vom angetippten Element aufwärts den nächsten Knopf
  // mit data-action (falls man z.B. genau auf das Symbol tippt)
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const [planId, unitId] = parseHash().params;
  const exerciseId = button.dataset.id;
  const action = button.dataset.action;

  if (action === "toggle-in-unit") {
    const unit = Store.getUnit(planId, unitId);
    if (unit.exerciseIds.includes(exerciseId)) {
      Store.removeExerciseFromUnit(planId, unitId, exerciseId);
    } else {
      Store.addExerciseToUnit(planId, unitId, exerciseId);
    }
  } else if (action === "remove-from-unit") {
    // Ohne Rückfrage: Die Übung bleibt im Pool und ist schnell wieder ausgewählt
    Store.removeExerciseFromUnit(planId, unitId, exerciseId);
  } else if (action === "delete-exercise") {
    const exercise = Store.getExercise(exerciseId);
    const usage = Store.countUnitsUsingExercise(exerciseId);
    const extra = usage > 0 ? ` Sie wird auch aus ${usage === 1 ? "1 Einheit" : usage + " Einheiten"} entfernt.` : "";
    // confirm() zeigt den Standard-Dialog des iPhones mit "OK" / "Abbrechen"
    if (!confirm(`„${exercise.name}“ aus dem Pool löschen?${extra}`)) return;
    Store.deleteExercise(exerciseId);
  }

  renderCurrentView();
});

// ===== Drag and Drop zum Sortieren =====
// Wir benutzen "Pointer Events": Die funktionieren gleich für Finger,
// Maus und Stift. Ablauf:
// 1. pointerdown: Finger auf den Griff ≡ -> Ziehen beginnt
// 2. pointermove: Kästchen folgt dem Finger. Kommt es über die Mitte des
//    Nachbarn, tauschen die beiden die Plätze.
// 3. pointerup:   Finger losgelassen -> neue Reihenfolge speichern

let drag = null; // Infos zum laufenden Ziehen, sonst null

appMain.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest(".drag-handle");
  if (!handle) return;
  event.preventDefault(); // Kein Markieren von Text, kein Scrollen

  const item = handle.closest(".exercise-card");
  const itemRect = item.getBoundingClientRect();
  drag = {
    item: item,
    list: item.parentElement,
    // Wo genau im Kästchen der Finger liegt, damit es nicht "springt"
    grabOffset: event.clientY - itemRect.top,
  };
  item.classList.add("dragging");
  // Alle weiteren Bewegungen dieses Fingers an den Griff schicken, auch
  // wenn der Finger das Kästchen verlässt
  handle.setPointerCapture(event.pointerId);
});

document.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const { item, list } = drag;

  // Nachbarn tauschen, solange der Finger über ihre Mitte hinaus ist.
  // Wichtig: Wir verschieben immer den NACHBARN, nie das gezogene Kästchen
  // selbst. So bleibt der Griff im Dokument und behält den Finger.
  let moved = true;
  while (moved) {
    moved = false;
    const next = item.nextElementSibling;
    const prev = item.previousElementSibling;
    if (next && event.clientY > middleOf(next)) {
      list.insertBefore(next, item); // Nachbar unten nach oben holen
      moved = true;
    } else if (prev && event.clientY < middleOf(prev)) {
      list.insertBefore(prev, item.nextElementSibling); // Nachbar oben nach unten
      moved = true;
    }
  }

  // Das Kästchen optisch unter den Finger schieben (ohne die echte Position
  // in der Liste zu verändern). offsetTop = Position innerhalb der Liste.
  const listTop = list.getBoundingClientRect().top;
  const shift = event.clientY - listTop - item.offsetTop - drag.grabOffset;
  item.style.transform = `translateY(${shift}px)`;
});

// Finger losgelassen (pointerup) oder vom System abgebrochen (pointercancel)
function endDrag() {
  if (!drag) return;
  // Die neue Reihenfolge aus den Kästchen ablesen und speichern
  const orderedIds = [...drag.list.children].map((li) => li.dataset.id);
  const [planId, unitId] = parseHash().params;
  Store.setUnitExerciseOrder(planId, unitId, orderedIds);
  drag = null;
  renderCurrentView();
}
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);

// Senkrechte Mitte eines Elements auf dem Bildschirm
function middleOf(element) {
  const rect = element.getBoundingClientRect();
  return rect.top + rect.height / 2;
}

// ===== Start =====
// Bei jedem Wechsel des Hashs (Tab angetippt, Zurück-Knopf) neu anzeigen
window.addEventListener("hashchange", route);

// Beim Start einmal die richtige Ansicht anzeigen
route();
