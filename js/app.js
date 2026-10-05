// ===== Navigation =====
// Die App hat nur eine HTML-Seite. Welche Ansicht sichtbar ist, steht im
// "Hash" der Adresse, also dem Teil nach dem # (z.B. index.html#plaene).
// Vorteil: Der Zurück-Knopf funktioniert und nach dem Neuladen bleibt man
// in derselben Ansicht.
//
// Unteransichten hängen wir mit "/" an:
//   #start/ppl-push                -> Training der Einheit "Push" (aktiver Plan)
//   #start/ppl-push/<übung-id>     -> eine Übung in diesem Training (mit Timer, Verlauf)
//   #plaene/ppl                    -> der Plan "Push/Pull/Legs"
//   #plaene/ppl/ppl-push           -> dessen Einheit "Push"
//   #plaene/ppl/ppl-push/auswahl   -> Übungen für "Push" aus dem Pool auswählen

// Titel, die in der Kopfzeile angezeigt werden
const VIEW_TITLES = {
  start: "Startseite",
  plaene: "Pläne",
  uebungen: "Übungen",
  einstellungen: "Einstellungen",
};

const DEFAULT_VIEW = "start";

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

// Die Adresse, von der man gerade kam. Seiten, die man von mehreren Stellen
// aus öffnen kann (z.B. "Übung bearbeiten"), führen mit "Zurück" dorthin.
let previousHash = "";
let currentHash = location.hash;

// Wird bei jedem Wechsel der Adresse aufgerufen
function route() {
  previousHash = currentHash;
  currentHash = location.hash;
  noteEditingId = null; // Ein offenes Notizfeld schließt beim Seitenwechsel
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

  if (viewName === "start") {
    renderStart(params[0], params[1]);
  } else if (viewName === "plaene") {
    renderPlaene(params[0], params[1], params[2]);
  } else if (viewName === "uebungen") {
    renderUebungen(params[0]);
  } else if (viewName === "einstellungen") {
    renderSettings();
  }
}

// Setzt den Titel (groß im Inhalt und klein in der Leiste) und optional
// einen Zurück-Link. backLabel ist der Name des Ziels, z.B. "Pläne".
function setHeader(title, backHref, backLabel = "Zurück") {
  const largeTitle = document.getElementById("view-title");
  largeTitle.textContent = title;
  // Lange Titel (z.B. lange Übungsnamen) etwas kleiner darstellen
  largeTitle.classList.toggle("long", title.length > 20);
  document.getElementById("nav-title").textContent = title;
  const backLink = document.getElementById("back-link");
  backLink.hidden = !backHref;
  if (backHref) {
    backLink.href = backHref;
    document.getElementById("back-label").textContent = backLabel;
  }
}

// Beim Scrollen: Ist der große Titel weg, bekommt die Leiste oben einen
// verschwommenen Hintergrund und zeigt den kleinen Titel (wie bei iOS).
window.addEventListener("scroll", () => {
  document.body.classList.toggle("scrolled", window.scrollY > 36);
});

// ===== Hilfsfunktionen =====

// Symbole für das Timer-Widget als kleine SVG-Grafiken. Schriftzeichen wie
// "❚❚" sehen je nach Gerät unterschiedlich (oder als Kästchen) aus.
const ICONS = {
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>`,
  restart: `<svg viewBox="0 0 24 24" aria-hidden="true" class="stroke"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true" class="stroke"><path d="m7 7 10 10M17 7 7 17"/></svg>`,
};

// Graues "ⓧ" zum Entfernen, angelehnt an Apples Symbol "xmark.circle.fill"
const XMARK_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8.5 8.5 7 7m0-7-7 7"/></svg>`;

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

// ===== Ansicht "Start" =====
// Ohne unitId: Startseite mit Statistik-Widgets und den Einheiten des
// aktiven Plans zur Auswahl.
// Mit unitId: das Training dieser Einheit.
// Mit unitId und exerciseId: eine einzelne Übung mit Pausentimer.
function renderStart(unitId, exerciseId) {
  const container = document.getElementById("view-start");
  const plan = Store.getPlan(Store.getActivePlanId());

  // Noch kein Plan aktiviert -> Widgets und Hinweis mit Weg zu den Plänen
  if (!plan) {
    container.innerHTML = `
      ${renderBackupBanner()}
      ${renderWidgets()}
      <h2 class="section-title">Training starten</h2>
      <p class="placeholder">Du hast noch keinen Plan aktiviert. Wähle unter „Pläne“ eine Trainingsart
        aus und tippe auf „Als aktiven Plan wählen“.</p>
      <a class="button-secondary" href="#plaene">Plan auswählen</a>
    `;
    return;
  }

  if (unitId && exerciseId) {
    renderExerciseView(container, plan, unitId, exerciseId);
    return;
  }

  if (unitId) {
    renderWorkout(container, plan, unitId);
    return;
  }

  const nextId = nextUnitId(plan);
  const runningId = Store.getRunningUnitId();

  const cards = plan.units
    .map((unit) => {
      const isNext = unit.id === nextId;
      // Läuft gerade ein Training, ist dieses markiert statt "Heute dran"
      const badge =
        unit.id === runningId
          ? `<span class="badge running">Läuft</span>`
          : isNext && !runningId
            ? `<span class="badge">Heute dran</span>`
            : "";
      return `
        <li>
          <a class="exercise-card unit-card" href="#start/${unit.id}">
            <span class="exercise-info">
              <span class="exercise-name">${escapeHtml(unit.name)} ${badge}</span>
              <span class="exercise-meta">
                ${exerciseCountText(unit.exerciseIds.length)} · ${lastDoneText(Store.getLastWorkoutDate(unit.id))}
              </span>
            </span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        </li>
      `;
    })
    .join("");

  // Oben die wischbaren Widgets, darunter (gut mit dem Daumen erreichbar)
  // die Einheiten zum Starten
  container.innerHTML = `
    ${renderBackupBanner()}
      ${renderWidgets()}
    <h2 class="section-title">Training starten · ${escapeHtml(plan.name)}</h2>
    <ul class="card-list">${cards}</ul>
    <p class="hint"><a href="#plaene/${plan.id}">Plan bearbeiten</a></p>
  `;
}

// Training einer Einheit: oben die offenen Übungen, darunter die erledigten.
// Links bei jeder Übung ein Kreis zum Abhaken, ein Tipp auf den Namen
// öffnet die Übung (Sätze und Timer).
function renderWorkout(container, plan, unitId) {
  const unit = Store.getUnit(plan.id, unitId);
  if (!unit) {
    location.hash = "start";
    return;
  }
  setHeader(unit.name, "#start", "Start");
  // Training dieser Einheit beginnen (oder das laufende weiterführen)
  Store.startWorkout(plan.id, unit.id);

  const exercises = unit.exerciseIds.map((id) => Store.getExercise(id)).filter(Boolean);
  if (exercises.length === 0) {
    container.innerHTML = `
      <p class="placeholder">Diese Einheit hat noch keine Übungen.</p>
      <a class="button-secondary" href="#plaene/${plan.id}/${unit.id}/auswahl">Übungen auswählen</a>
    `;
    return;
  }

  // In drei Gruppen aufteilen; die Reihenfolge des Plans bleibt jeweils erhalten
  const done = exercises.filter((ex) => Store.isExerciseDone(ex.id));
  const skipped = exercises.filter((ex) => Store.isExerciseSkipped(ex.id));
  const open = exercises.filter((ex) => !Store.isExerciseDone(ex.id) && !Store.isExerciseSkipped(ex.id));

  const card = (exercise) => {
    const isDone = Store.isExerciseDone(exercise.id);
    const isSkipped = Store.isExerciseSkipped(exercise.id);
    // Übersprungene: statt des Hakens ein Knopf zum Zurückholen
    const leftControl = isSkipped
      ? `<button class="check-button" data-action="toggle-skip" data-id="${exercise.id}"
           aria-label="Zurückholen"><span class="restore" aria-hidden="true">↺</span></button>`
      : `<button class="check-button" data-action="toggle-done" data-id="${exercise.id}"
           aria-label="${isDone ? "Haken entfernen" : "Abhaken"}" aria-pressed="${isDone}">
           <span class="check" aria-hidden="true">${isDone ? "✓" : ""}</span>
         </button>`;
    // view-transition-name: ein eindeutiger Name pro Kästchen. Damit kann
    // der Browser jedes Kästchen beim Umsortieren an seinen neuen Platz
    // "gleiten" lassen (siehe renderAnimated).
    return `
      <li class="exercise-card workout-card ${isDone ? "done" : ""} ${isSkipped ? "skipped" : ""}"
        style="view-transition-name: ex-${exercise.id}">
        ${leftControl}
        <a class="card-main" href="#start/${unit.id}/${exercise.id}">
          <span class="exercise-name">${escapeHtml(exercise.name)}</span>
          <span class="exercise-meta">${setsSummary(exercise)}</span>
        </a>
        <span class="chevron" aria-hidden="true">›</span>
      </li>
    `;
  };

  const doneSection =
    done.length > 0
      ? `<h2 class="section-title">Erledigt</h2>
         <ul class="card-list">${done.map(card).join("")}</ul>`
      : "";

  const skippedSection =
    skipped.length > 0
      ? `<h2 class="section-title">Übersprungen</h2>
         <ul class="card-list">${skipped.map(card).join("")}</ul>`
      : "";

  // Sind alle Übungen erledigt (oder übersprungen), wird "Training beenden"
  // zum Hauptknopf
  const allDone = open.length === 0;

  // Übersprungene zählen nicht mit: "2 von 3 erledigt"
  const total = exercises.length - skipped.length;

  // "Training beenden" steht oben, damit man es nach der letzten Übung
  // nicht erst suchen muss. Sind alle erledigt, wird der Knopf grün.
  container.innerHTML = `
    <div class="workout-top">
      <p class="intro">${escapeHtml(plan.name)} · ${done.length} von ${total} erledigt</p>
      <button class="finish-button ${allDone ? "ready" : ""}" data-action="finish-workout">Training beenden</button>
    </div>
    ${allDone
      ? `<p class="all-done">Alle Übungen erledigt. Stark!</p>`
      : `<ul class="card-list">${open.map(card).join("")}</ul>`}
    ${doneSection}
    ${skippedSection}
  `;
}

// Kurze Zusammenfassung unter dem Übungsnamen:
// - übersprungen:                 "Heute übersprungen"
// - heute schon Wdh. eingetragen: "Brust · 62,5 kg × 10 · 8"
// - sonst, falls vorhanden:       "Zuletzt: 62,5 kg × 10 · 8"
// - sonst:                        "Brust · 2 Sätze"
function setsSummary(exercise) {
  if (Store.isExerciseSkipped(exercise.id)) return "Heute übersprungen";
  const group = escapeHtml(muscleGroupName(exercise.muscleGroupId));
  const sets = workingSets(Store.getSets(exercise.id));
  if (sets.some((set) => set.reps !== null)) {
    return `${group} · ${formatSetsShort(sets)}`;
  }
  const last = Store.getLastPerformance(exercise.id);
  if (last) return `Zuletzt: ${formatSetsShort(last.sets)}`;
  return `${group} · ${sets.length} Sätze`;
}

// Sätze kurz als Text: "62,5 kg × 10 · 8". Ändert sich das Gewicht
// innerhalb der Übung, steht es bei jedem Satz: "60 kg × 10 · 55 kg × 8"
// Kurzfassung für Listen und "Letztes Mal": bleibt einzeilig.
// Gleiches Gewicht und bis zu 4 Sätze: "62,5 kg × 10 · 8"
// sonst: "6 Sätze · 95–102,5 kg" bzw. "6 Sätze · 54 Wdh." ohne Gewicht
function formatSetsShort(sets) {
  const weights = sets.map((set) => set.weight).filter((w) => w !== null);
  const sameWeight = sets.every((set) => set.weight === sets[0].weight);
  if (sameWeight && sets.length <= 4) return formatSets(sets);
  const count = `${sets.length} ${sets.length === 1 ? "Satz" : "Sätze"}`;
  if (weights.length === 0) {
    const total = sets.reduce((sum, set) => sum + (set.reps || 0), 0);
    return `${count} · ${total} Wdh.`;
  }
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  return `${count} · ${min === max ? formatNumber(max) : formatNumber(min) + "–" + formatNumber(max)} kg`;
}

function formatSets(sets) {
  const reps = (set) => (set.reps !== null ? set.reps : "–");
  const sameWeight = sets.every((set) => set.weight === sets[0].weight);
  if (sameWeight) {
    const weight = sets[0].weight !== null ? `${formatNumber(sets[0].weight)} kg × ` : "";
    return weight + sets.map(reps).join(" · ");
  }
  return sets
    .map((set) => (set.weight !== null ? `${formatNumber(set.weight)} kg × ${reps(set)}` : reps(set)))
    .join(" · ");
}

// Zeichnet die Ansicht neu, und zwar mit Animation, wenn der Browser
// "View Transitions" kann (Safari ab iOS 18): Er fotografiert den alten
// Zustand, zeichnet neu und lässt dann jedes Kästchen mit
// view-transition-name von der alten an die neue Stelle gleiten.
function renderAnimated() {
  if (document.startViewTransition) {
    document.startViewTransition(() => renderCurrentView());
  } else {
    renderCurrentView(); // Ältere Browser: ohne Animation
  }
}

// Eine Übung im Training: oben die Sätze, darunter der Pausentimer
function renderExerciseView(container, plan, unitId, exerciseId) {
  const unit = Store.getUnit(plan.id, unitId);
  const exercise = Store.getExercise(exerciseId);
  if (!unit || !exercise) {
    location.hash = "start/" + unitId;
    return;
  }
  setHeader(exercise.name, "#start/" + unit.id, unit.name);
  // Falls man direkt über einen Link hier gelandet ist
  Store.startWorkout(plan.id, unit.id);

  // Position in der Einheit, für "Übung 2 von 5" und den Weiter-Knopf
  const index = unit.exerciseIds.indexOf(exercise.id);
  const nextExercise = Store.getExercise(unit.exerciseIds[index + 1]);

  const nextLink = nextExercise
    ? `<a class="nav-row" href="#start/${unit.id}/${nextExercise.id}">
         <span class="nav-row-label">Nächste Übung</span>
         <span class="nav-row-value">${escapeHtml(nextExercise.name)}</span>
         <span class="chevron" aria-hidden="true">›</span>
       </a>`
    : `<a class="nav-row" href="#start/${unit.id}">
         <span class="nav-row-label">Zurück zur Übersicht</span>
         <span class="chevron" aria-hidden="true">›</span>
       </a>`;

  const intro = `
    <p class="intro">
      ${escapeHtml(muscleGroupName(exercise.muscleGroupId))} · Übung ${index + 1} von ${unit.exerciseIds.length}
      ${Store.isExerciseDone(exercise.id) ? `<span class="badge done-badge">✓ Erledigt</span>` : ""}
    </p>`;

  // Übersprungen: keine Sätze zeigen, nur den Weg zurück
  if (Store.isExerciseSkipped(exercise.id)) {
    container.innerHTML = `
      ${intro}
      <div class="skipped-note">
        <p>Diese Übung ist für heute übersprungen. Es wird nichts für sie gespeichert.</p>
        <button class="pill-button" data-action="toggle-skip" data-id="${exercise.id}">↺ Zurückholen</button>
      </div>
      ${nextLink}
    `;
    return;
  }

  const sets = Store.getSets(exercise.id);
  const last = Store.getLastPerformance(exercise.id);

  // Wiederholungen vom letzten Mal als grauer Hinweis im leeren Feld
  // ("placeholder"). Sie sind damit sichtbar, aber NICHT eingetragen.
  const lastReps = (i) => {
    if (!last) return "0";
    const lastSet = last.sets[Math.min(i, last.sets.length - 1)];
    return lastSet.reps !== null ? lastSet.reps : "0";
  };

  // Hatte die Übung letztes Mal kein Gewicht (z.B. Dips), zeigt das leere
  // Gewichtsfeld "–" statt "0", damit niemand "0 kg" eintragen will
  const weightHint = last && last.sets.every((set) => set.weight === null) ? "–" : "0";

  // Datum kurz auf Deutsch, z.B. "05.10."
  const lastLine = last
    ? `<p class="last-time">Letztes Mal (${new Date(last.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}):
         <strong>${formatSetsShort(last.sets)}</strong></p>`
    : "";

  // Eine Zeile pro Satz. Die Eingabefelder merken sich in data-index und
  // data-field, welcher Satz und welcher Wert gemeint ist.
  // inputmode sagt dem iPhone, welche Tastatur es zeigen soll:
  // "decimal" = Zahlen mit Komma (für 62,5 kg), "numeric" = nur Ziffern.
  // Der Aufwärmsatz heißt "W", die Arbeitssätze sind 1, 2, 3 ...
  const hasWarmup = sets.some((set) => set.warmup);
  let workingNumber = 0;
  const rows = sets
    .map((set, i) => {
      const label = set.warmup ? "W" : String(++workingNumber);
      const name = set.warmup ? "Aufwärmsatz" : `Satz ${label}`;
      const repsHint = set.warmup
        ? last && last.warmup && last.warmup.reps !== null ? last.warmup.reps : "–"
        : lastReps(workingNumber - 1);
      return `
        <div class="set-row ${set.warmup ? "warmup" : ""}">
          <span class="set-number">${label}</span>
          <input class="set-input" type="text" inputmode="decimal" placeholder="${weightHint}"
            value="${formatNumber(set.weight)}" data-index="${i}" data-field="weight"
            aria-label="Gewicht ${name} in kg">
          <input class="set-input" type="text" inputmode="numeric" placeholder="${repsHint}"
            value="${formatNumber(set.reps)}" data-index="${i}" data-field="reps"
            aria-label="Wiederholungen ${name}">
        </div>
      `;
    })
    .join("");
  const workingCount = workingNumber;

  // Die Timer-Zeile merkt sich in data-exercise, zu welcher Übung sie gehört
  container.innerHTML = `
    ${intro}
    <div id="note-area">${renderNoteArea(exercise.id)}</div>
    ${lastLine}
    <div class="sets-card">
      <div class="set-row set-header">
        <span>Satz</span>
        <span>kg</span>
        <span>Wdh.</span>
      </div>
      ${rows}
      <button class="warmup-toggle" data-action="${hasWarmup ? "remove-warmup" : "add-warmup"}">
        ${hasWarmup ? "Aufwärmsatz entfernen" : "+ Aufwärmsatz"}
      </button>
    </div>
    <div class="set-buttons">
      <button class="pill-button" data-action="remove-set" ${workingCount <= 1 ? "disabled" : ""}>− Satz</button>
      <button class="pill-button" data-action="add-set">+ Satz</button>
    </div>
    <div id="timer-card" class="timer-row" data-exercise="${exercise.id}" data-unit="${unit.id}">
      ${renderTimerCard(exercise.id)}
    </div>
    ${nextLink}
    <div id="history" data-exercise="${exercise.id}">
      ${renderExerciseHistory(exercise.id, historyMetric)}
    </div>
    ${Store.isExerciseDone(exercise.id)
      ? ""
      : `<button class="text-button" data-action="toggle-skip" data-id="${exercise.id}">Heute überspringen</button>`}
  `;
}

// ----- Notiz auf der Übungsseite -----
// Kompakt: eine Zeile mit der ersten Zeile der Notiz (oder "Notiz
// hinzufügen"). Ein Tipp öffnet ein Textfeld zum Bearbeiten.

// Stift-Symbol für die Notiz-Zeile
const PENCIL_ICON = `<svg class="row-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>`;

// Bei welcher Übung das Notiz-Feld gerade offen ist (sonst null)
let noteEditingId = null;

function renderNoteArea(exerciseId) {
  const note = Store.getExerciseSettings(exerciseId).note;
  if (noteEditingId === exerciseId) {
    return `
      <div class="edit-form note-box" data-exercise="${exerciseId}">
        <textarea class="note-input" rows="3" maxlength="500" data-edit-field="note"
          placeholder="z.B. Sitz auf Stufe 4, enger Griff">${escapeHtml(note)}</textarea>
        <button class="text-button" data-action="note-done">Fertig</button>
      </div>`;
  }
  // Nur die erste Zeile zeigen; der Rest erscheint beim Bearbeiten
  const firstLine = note.split("\n")[0];
  return `
    <button class="note-row ${note ? "has-note" : ""}" data-action="note-edit" data-id="${exerciseId}">
      ${PENCIL_ICON}
      <span class="note-text">${note ? escapeHtml(firstLine) : "Notiz hinzufügen"}</span>
    </button>`;
}

// Nur den Notiz-Bereich neu zeichnen (die Sätze bleiben, wie sie sind)
function refreshNoteArea() {
  const area = document.getElementById("note-area");
  const exerciseId = parseHash().params[1];
  if (area) area.innerHTML = renderNoteArea(exerciseId);
}

// Welche Kennzahl der Verlauf zeigt: "weight" (Gewicht) oder "volume".
// Bleibt beim Wechsel zwischen Übungen erhalten.
let historyMetric = "weight";

// Zahl für ein Eingabefeld: null -> "", 62.5 -> "62,5" (deutsches Komma)
function formatNumber(value) {
  return value === null || value === undefined ? "" : String(value).replace(".", ",");
}

// Eingabe in eine Zahl umwandeln: "62,5" -> 62.5, "" -> null.
// parseFloat liest eine Kommazahl, versteht aber nur den Punkt.
function parseNumber(text) {
  const number = parseFloat(text.trim().replace(",", "."));
  // isNaN = "is Not a Number": Eingabe war keine Zahl (z.B. leer)
  return isNaN(number) ? null : number;
}

// ===== Pausentimer: Anzeige =====
// Die Logik steckt in js/timer.js (RestTimer). Hier wird nur angezeigt:
// 1. Auf der Übungsseite eine schmale Zeile: Pausenzeit einstellen und starten.
// 2. Solange der Timer aktiv ist, sitzt oben links ein kleiner schwarzer
//    Kreis mit einem orangen Ring, der wie eine Ladeanzeige abläuft.
//    Antippen klappt ihn zu einer Ansicht mit Zeit und Knöpfen auf.
//    (Im Code heißt dieses Widget "island", also "Insel".)
//    Oben links, damit die echte Dynamic Island des iPhones frei bleibt.

// Fortschrittsring im Kreis. Umfang = 2 · π · Radius.
// Eine Linie mit Strichlänge = Umfang, die um einen Teil davon
// "verschoben" wird, erscheint nur teilweise (stroke-dashoffset).
const MINI_RING_RADIUS = 9;
const MINI_RING_CIRCUMFERENCE = 2 * Math.PI * MINI_RING_RADIUS;

// Ist das Widget gerade aufgeklappt?
let islandExpanded = false;

// ----- Schmale Timer-Zeile auf der Übungsseite -----

function renderTimerCard(exerciseId) {
  const restSeconds = Store.getRestSeconds(exerciseId);
  return `
    <span class="timer-row-title">Pause</span>
    <button class="step-button" data-action="timer-adjust" data-delta="-15" aria-label="15 Sekunden weniger">−</button>
    <span class="rest-value">${formatDuration(restSeconds * 1000)}</span>
    <button class="step-button" data-action="timer-adjust" data-delta="15" aria-label="15 Sekunden mehr">+</button>
    <button class="timer-start-button" data-action="timer-start">Start</button>
  `;
}

// Zeichnet die Timer-Karte neu (nur die Karte, nicht die ganze Seite)
function refreshTimerCard() {
  const card = document.getElementById("timer-card");
  if (card) card.innerHTML = renderTimerCard(card.dataset.exercise);
}

// Knöpfe der Timer-Karte
function handleTimerAction(button) {
  const card = document.getElementById("timer-card");
  const exerciseId = card.dataset.exercise;
  const action = button.dataset.action;

  if (action === "timer-start") {
    const exercise = Store.getExercise(exerciseId);
    islandExpanded = false;
    // Läuft schon ein Timer, wird er durch den neuen ersetzt
    RestTimer.start(Store.getRestSeconds(exerciseId), {
      unitId: card.dataset.unit,
      exerciseId: exerciseId,
      exerciseName: exercise.name,
    });
  } else if (action === "timer-adjust") {
    // Zwischen 15 Sekunden und 10 Minuten bleiben
    const seconds = Store.getRestSeconds(exerciseId) + Number(button.dataset.delta);
    Store.setRestSeconds(exerciseId, Math.min(600, Math.max(15, seconds)));
  }
  refreshTimerCard();
}

// ----- Die Insel oben -----

// Zeichnet die Insel passend zum Zustand des Timers.
// Sie enthält immer beide Varianten (kompakt und aufgeklappt);
// per CSS ist jeweils nur eine sichtbar.
function renderIsland() {
  const island = document.getElementById("island");
  const status = RestTimer.status;

  if (status === "idle") {
    island.hidden = true;
    islandExpanded = false;
    document.body.classList.remove("has-island");
    return;
  }

  // Beim ersten Erscheinen die "Aufpopp"-Animation abspielen
  if (island.hidden) {
    island.hidden = false;
    island.classList.remove("pop");
    void island.offsetWidth; // Trick: zwingt den Browser, die Animation neu zu starten
    island.classList.add("pop");
  }
  // Damit macht das CSS oben links Platz (der Zurück-Link rückt nach rechts)
  document.body.classList.add("has-island");

  island.classList.toggle("expanded", islandExpanded);
  island.classList.toggle("done", status === "done");
  island.classList.toggle("paused", status === "paused");

  const { unitId, exerciseId, exerciseName } = RestTimer.context;
  const time = formatDuration(RestTimer.getRemainingMs());

  // Rechter Knopf im aufgeklappten Zustand, je nach Zustand
  const mainButton = {
    running: `<button class="island-button orange" data-island="pause" aria-label="Anhalten">${ICONS.pause}</button>`,
    paused: `<button class="island-button orange" data-island="resume" aria-label="Fortsetzen">${ICONS.play}</button>`,
    done: `<button class="island-button green" data-island="restart" aria-label="Nochmal">${ICONS.restart}</button>`,
  }[status];

  island.innerHTML = `
    <button class="island-compact" data-island="expand" aria-label="Timer öffnen">
      <svg class="mini-ring" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="mini-track" cx="12" cy="12" r="${MINI_RING_RADIUS}"></circle>
        <circle class="mini-progress" cx="12" cy="12" r="${MINI_RING_RADIUS}"
          stroke-dasharray="${MINI_RING_CIRCUMFERENCE}"
          stroke-dashoffset="${MINI_RING_CIRCUMFERENCE * (1 - RestTimer.getProgress())}"></circle>
      </svg>
    </button>

    <div class="island-expanded">
      <a class="island-info" href="#start/${unitId}/${exerciseId}" data-island="goto">
        <span class="island-caption">${escapeHtml(exerciseName)}</span>
        <span class="island-big">${status === "done" ? "Pause vorbei" : `<span class="island-time">${time}</span>`}</span>
      </a>
      <div class="island-buttons">
        <button class="island-button gray" data-island="reset" aria-label="${status === "done" ? "Fertig" : "Abbrechen"}">${ICONS.close}</button>
        ${mainButton}
      </div>
    </div>
  `;
}

// Aktualisiert nur Ziffern und Ring. Wird mehrmals pro Sekunde aufgerufen,
// daher bewusst sparsam: kein Neuzeichnen der ganzen Insel.
function updateIslandTime() {
  const time = formatDuration(RestTimer.getRemainingMs());
  document.querySelectorAll("#island .island-time").forEach((el) => (el.textContent = time));
  const ring = document.querySelector("#island .mini-progress");
  if (ring) {
    ring.setAttribute("stroke-dashoffset", MINI_RING_CIRCUMFERENCE * (1 - RestTimer.getProgress()));
  }
}

// Antippen in der Insel. Die Insel liegt außerhalb von <main>, daher
// bekommt sie einen eigenen Behandler.
document.getElementById("island").addEventListener("click", (event) => {
  // Den Tipp nicht weiter nach oben melden. Sonst hielte der Behandler
  // "Tippen außerhalb" (unten) ihn für einen Tipp daneben, weil der
  // angetippte Knopf nach dem Neuzeichnen nicht mehr existiert.
  event.stopPropagation();

  const target = event.target.closest("[data-island]");
  if (!target) return;
  const action = target.dataset.island;

  if (action === "expand") {
    islandExpanded = true;
  } else if (action === "goto") {
    // Der Link führt zur Übung; die Insel klappt dabei zu
    islandExpanded = false;
  } else if (action === "pause") {
    RestTimer.pause();
  } else if (action === "resume") {
    RestTimer.resume();
  } else if (action === "restart") {
    islandExpanded = false;
    RestTimer.start(RestTimer.durationMs / 1000, RestTimer.context);
  } else if (action === "reset") {
    RestTimer.reset();
  }
  renderIsland();
});

// Tippen irgendwo außerhalb der aufgeklappten Insel klappt sie wieder zu
// (außer wenn die Pause vorbei ist: Das soll man bewusst bestätigen)
document.addEventListener("click", (event) => {
  if (!islandExpanded || RestTimer.status === "done") return;
  if (event.target.closest("#island")) return;
  islandExpanded = false;
  renderIsland();
});

// Der Timer meldet sich bei jedem Takt und bei jeder Statusänderung
RestTimer.onTick = updateIslandTime;
RestTimer.onChange = () => {
  // Ist die Pause vorbei, klappt die Insel von selbst auf
  if (RestTimer.status === "done") islandExpanded = true;
  renderIsland();
};

// Welche Einheit ist als nächste dran? Die nach der zuletzt trainierten
// (in der Reihenfolge des Plans). Nach der letzten geht es wieder von vorn los.
// Wurde noch nie trainiert, ist es die erste.
function nextUnitId(plan) {
  let lastIndex = -1;
  let lastDate = null;
  plan.units.forEach((unit, index) => {
    const date = Store.getLastWorkoutDate(unit.id);
    if (date && (!lastDate || date > lastDate)) {
      lastDate = date;
      lastIndex = index;
    }
  });
  // % (Modulo) ergibt den Rest der Division: Nach der letzten Einheit -> 0
  return plan.units[(lastIndex + 1) % plan.units.length].id;
}

// "Noch nie trainiert", "Zuletzt heute", "Zuletzt gestern", "Zuletzt vor 3 Tagen"
function lastDoneText(date) {
  if (!date) return "Noch nie trainiert";
  // Kalendertage vergleichen, nicht Stunden: gestern 23 Uhr ist "gestern"
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((today - day) / (24 * 60 * 60 * 1000));
  if (days === 0) return "Zuletzt heute";
  if (days === 1) return "Zuletzt gestern";
  return `Zuletzt vor ${days} Tagen`;
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
    setHeader(plan.name, "#plaene", "Pläne");
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
    setHeader("Übungen auswählen", unitHref, unit.name);
    container.innerHTML = renderExercisePicker(plan, unit);
    return;
  }

  // Einheit -> ihre Übungen anzeigen und sortieren
  setHeader(unit.name, "#plaene/" + planId, plan.name);
  container.innerHTML = renderUnitDetail(plan, unit);
}

// Übersicht: eine Karte pro Trainingsart
function renderPlanList(plans) {
  const activePlanId = Store.getActivePlanId();

  // map() macht aus jedem Plan ein Stück HTML, join("") klebt alles zusammen
  const cards = plans
    .map(
      (plan) => `
        <a class="card card-link" href="#plaene/${plan.id}">
          <h2 class="card-title">
            ${escapeHtml(plan.name)}
            ${plan.id === activePlanId ? `<span class="badge">Aktiv</span>` : ""}
          </h2>
          <p class="card-text">${escapeHtml(plan.description)}</p>
          <div class="chips">
            ${plan.units.map((unit) => `<span class="chip">${escapeHtml(unit.name)}</span>`).join("")}
          </div>
        </a>
      `
    )
    .join("");

  return `
    <p class="intro">Wähle eine Trainingsart, um ihre Einheiten zu sehen und sie zu aktivieren.</p>
    ${cards}
  `;
}

// Detailansicht: Aktivieren-Knopf und die Einheiten des Plans.
// Die Einheiten sind sortierbar; ihre Reihenfolge bestimmt auch, welche
// Einheit auf der Trainingsseite als nächste "dran" ist.
function renderPlanDetail(plan) {
  const isActive = plan.id === Store.getActivePlanId();

  // Jedes Kästchen: links ein Link zur Einheit, rechts der Griff zum Ziehen
  const cards = plan.units
    .map(
      (unit) => `
        <li class="exercise-card" data-id="${unit.id}">
          <a class="card-main" href="#plaene/${plan.id}/${unit.id}">
            <span class="exercise-name">${escapeHtml(unit.name)}</span>
            <span class="exercise-meta">${exerciseCountText(unit.exerciseIds.length)}</span>
          </a>
          <span class="drag-handle" aria-label="Zum Verschieben ziehen">≡</span>
        </li>
      `
    )
    .join("");

  const activeControl = isActive
    ? `<p class="active-note">✓ Das ist dein aktiver Plan.</p>`
    : `<button class="button-primary button-wide" data-action="activate-plan" data-plan="${plan.id}">
         Als aktiven Plan wählen
       </button>`;

  // data-sort sagt dem Drag-and-Drop-Code, WAS hier sortiert wird
  return `
    <p class="intro">${escapeHtml(plan.description)}</p>
    ${activeControl}
    <h2 class="section-title">Einheiten</h2>
    <ul class="card-list sortable" data-sort="plan-units">${cards}</ul>
    <p class="hint">Zum Sortieren eine Einheit am ≡ ziehen.</p>
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
            aria-label="Aus der Einheit entfernen">${XMARK_ICON}</button>
          <span class="drag-handle" aria-label="Zum Verschieben ziehen">≡</span>
        </li>
      `
    )
    .join("");

  // Bei leerer Liste einen Hinweis statt einer leeren Fläche zeigen
  const list =
    exercises.length === 0
      ? `<p class="placeholder">Noch keine Übungen ausgewählt.</p>`
      : `<ul class="card-list sortable" data-sort="unit-exercises">${cards}</ul>`;

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
                    <span class="checkmark" aria-hidden="true">${selected ? "✓" : ""}</span>
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
function renderUebungen(exerciseId) {
  const container = document.getElementById("view-uebungen");
  if (exerciseId) {
    renderExerciseEdit(container, exerciseId);
    return;
  }
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
                  <a class="card-main" href="#uebungen/${exercise.id}">
                    <span class="exercise-name">${escapeHtml(exercise.name)}</span>
                    <span class="exercise-meta">${usageText}</span>
                  </a>
                  <button class="icon-button danger" data-action="delete-exercise" data-id="${exercise.id}"
                    aria-label="Übung löschen">${XMARK_ICON}</button>
                </li>
              `;
            })
            .join("")}
        </ul>
      `
    )
    .join("");

  container.innerHTML = `
    <p class="intro">Lege jede Übung hier einmal an. In deinen Plänen wählst du sie dann pro Einheit aus.
      Tippe auf eine Übung, um sie zu bearbeiten.</p>
    ${renderExerciseForm()}
    ${groups.length === 0 ? `<p class="placeholder">Noch keine Übungen im Pool.</p>` : sections}
  `;
}

// ===== Seite "Übung bearbeiten" (#uebungen/<id>) =====
// Alles, was zu einer Übung gehört, an einem Ort. Die Felder speichern
// sofort beim Ändern; einen "Speichern"-Knopf braucht es nicht (wie bei iOS).
// Die Felder tragen data-edit-field mit dem Namen des Werts, den sie ändern.
function renderExerciseEdit(container, exerciseId) {
  const exercise = Store.getExercise(exerciseId);
  if (!exercise) {
    location.hash = "uebungen";
    return;
  }
  const settings = Store.getExerciseSettings(exerciseId);

  // Zurück dorthin, woher man kam (z.B. ins Training), sonst zum Pool
  const fromWorkout = previousHash.startsWith("#start/");
  setHeader(exercise.name, fromWorkout ? previousHash : "#uebungen", fromWorkout ? "Training" : "Übungen");

  const options = Store.getMuscleGroups()
    .map((g) => `<option value="${g.id}" ${g.id === exercise.muscleGroupId ? "selected" : ""}>${escapeHtml(g.name)}</option>`)
    .join("");

  container.innerHTML = `
    <div class="edit-form" data-exercise="${exercise.id}">
      <h2 class="section-title">Allgemein</h2>
      <ul class="card-list">
        <li class="field-row">
          <label class="field-label" for="edit-name">Name</label>
          <input id="edit-name" class="field-input" type="text" value="${escapeHtml(exercise.name)}"
            maxlength="60" autocomplete="off" data-edit-field="name">
        </li>
        <li class="field-row">
          <label class="field-label" for="edit-group">Muskelgruppe</label>
          <select id="edit-group" class="field-input field-select" data-edit-field="muscleGroupId">${options}</select>
        </li>
      </ul>

      <h2 class="section-title">Training</h2>
      <ul class="card-list">
        <li class="field-row">
          <span class="field-label">Aufwärmsatz</span>
          <span class="field-spacer"></span>
          <button class="switch ${settings.warmup ? "on" : ""}" role="switch" aria-checked="${settings.warmup}"
            data-action="toggle-exercise-warmup" aria-label="Aufwärmsatz"></button>
        </li>
      </ul>
      <p class="settings-hint">Mit Aufwärmsatz beginnt jedes Training dieser Übung mit einem Satz „W“ bei etwa halbem Gewicht. Er zählt nicht für Volumen, Verlauf und Rekorde.</p>

      <h2 class="section-title">Notiz</h2>
      <textarea class="note-input" rows="3" maxlength="500" data-edit-field="note"
        placeholder="z.B. Sitz auf Stufe 4, enger Griff">${escapeHtml(settings.note)}</textarea>
      <p class="settings-hint">Die Notiz steht bei jedem Training dieser Übung über den Sätzen.</p>
    </div>
  `;
}

// Änderungen auf der Seite "Übung bearbeiten" speichern.
// "input" feuert bei jedem Tastendruck (für die Notiz), "change" erst beim
// Verlassen des Felds bzw. bei der Auswahl (für Name und Muskelgruppe).
function handleExerciseEdit(event) {
  const field = event.target.closest("[data-edit-field]");
  if (!field) return;
  const exerciseId = field.closest(".edit-form").dataset.exercise;
  const key = field.dataset.editField;

  if (key === "note" && event.type === "input") {
    Store.updateExercise(exerciseId, { note: field.value });
  } else if (key === "muscleGroupId" && event.type === "change") {
    Store.updateExercise(exerciseId, { muscleGroupId: field.value });
  } else if (key === "name" && event.type === "change") {
    const name = field.value.trim();
    const oldName = Store.getExercise(exerciseId).name;
    if (!name) {
      field.value = oldName; // Leerer Name ist nicht erlaubt: zurücksetzen
    } else if (!Store.updateExercise(exerciseId, { name: name })) {
      alert(`„${name}“ gibt es schon in deinem Übungs-Pool.`);
      field.value = oldName;
    } else {
      setHeader(name, document.getElementById("back-link").getAttribute("href"),
        document.getElementById("back-label").textContent);
    }
  }
}

// ===== Ansicht "Einstellungen" =====
// Wochenziel, Urlaubsmodus, Streak und eine aufklappbare Monatsübersicht
function renderSettings() {
  const container = document.getElementById("view-einstellungen");
  const goal = Store.getWeeklyGoal();
  const days = trainingDayKeys();
  const weeks = weekStatuses(days);
  const info = streakInfo(weeks);
  const vacation = Store.isVacationActive();

  // Wochenziel mit − und + einstellen (1 bis 7 Tage)
  const goalCard = `
    <h2 class="section-title">Wochenziel</h2>
    <div class="settings-row">
      <span class="settings-label">Tage pro Woche</span>
      <button class="step-button" data-action="goal-step" data-delta="-1"
        ${goal === null || goal <= 1 ? "disabled" : ""} aria-label="Ein Tag weniger">−</button>
      <span class="goal-value ${goal === null ? "unset" : ""}">${goal === null ? "Keins" : goal}</span>
      <button class="step-button" data-action="goal-step" data-delta="1"
        ${goal !== null && goal >= 7 ? "disabled" : ""} aria-label="Ein Tag mehr">+</button>
    </div>
    <p class="settings-hint">Eine Änderung gilt ab dieser Woche. Vergangene Wochen behalten ihre Farbe.</p>
  `;

  // Urlaubsmodus als Schalter im iOS-Stil. role="switch" sagt Hilfsmitteln
  // wie VoiceOver, dass es ein Ein/Aus-Schalter ist.
  const since = Store.getVacationStart();
  const vacationCard = `
    <h2 class="section-title">Urlaub</h2>
    <div class="settings-row">
      <span class="settings-label">
        Urlaubsmodus
        ${vacation ? `<span class="settings-sub">an seit ${shortDate(since + "T12:00")}</span>` : ""}
      </span>
      <button class="switch ${vacation ? "on" : ""}" role="switch" aria-checked="${vacation}"
        data-action="toggle-vacation" aria-label="Urlaubsmodus"></button>
    </div>
    <p class="settings-hint">Solange der Urlaubsmodus an ist, geht deine Streak nicht verloren, auch wenn du dein Wochenziel nicht schaffst.</p>
  `;

  const stats = `
    <h2 class="section-title">Streak</h2>
    <div class="stat-row streak-stats">
      <div class="stat"><span class="stat-value">${info.current}</span><span class="stat-label">Aktuell (Wochen)</span></div>
      <div class="stat"><span class="stat-value">${info.longest}</span><span class="stat-label">Längste (Wochen)</span></div>
    </div>
  `;

  // Alle Monate vom ersten Training bis heute, neuester zuerst.
  // <details> ist ein eingebautes HTML-Element zum Auf- und Zuklappen:
  // <summary> ist die immer sichtbare Zeile, der Rest erscheint beim Antippen.
  let months = "";
  if (days.size > 0) {
    const first = new Date([...days].sort()[0] + "T12:00");
    const cursor = new Date();
    cursor.setDate(1);
    while (cursor >= new Date(first.getFullYear(), first.getMonth(), 1)) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const summary = monthSummary(year, month, days, weeks);
      const name = cursor.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      const goalText = summary.decided > 0 ? ` · Ziel ${summary.gold}/${summary.decided} Wochen` : "";
      months += `
        <details class="month-item">
          <summary>
            <span class="month-name">${name}</span>
            <span class="month-stats">${summary.trainingDays} ${summary.trainingDays === 1 ? "Tag" : "Tage"}${goalText}</span>
          </summary>
          <div class="month-body">
            <div class="weekday-row"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div>
            ${renderCalendar(year, month, days, weeks, "large")}
          </div>
        </details>`;
      cursor.setMonth(cursor.getMonth() - 1);
    }
  }

  // Legende: Was bedeuten die Farben?
  const legend = `
    <div class="legend">
      <span><i class="legend-swatch gold"></i>Ziel erreicht</span>
      <span><i class="legend-swatch ice"></i>Verpasst</span>
      <span><i class="legend-swatch vacation"></i>Urlaub</span>
      <span><i class="legend-swatch trained"></i>Trainingstag</span>
    </div>`;

  container.innerHTML = `
    ${goalCard}
    ${vacationCard}
    ${stats}
    <h2 class="section-title">Monatsübersicht</h2>
    ${days.size === 0
      ? `<p class="placeholder">Noch keine Trainings. Nach deinem ersten Training erscheint hier dein Kalender.</p>`
      : `${legend}<div class="month-list">${months}</div>`}
    ${renderBackupSection()}
  `;
}

// ===== Sicherung =====
// Die Daten selbst liefert storage.js (exportData, importData). Hier geht
// es um die Bedienung: Datei teilen bzw. herunterladen, Datei auswählen.

const BACKUP_FILE_NAME = "gym-tracker-backup.json";

// Wolke mit Pfeil nach oben, als Symbol für die Sicherung
const BACKUP_ICON = `<svg class="backup-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .6-8A6 6 0 0 0 6.5 9a4.8 4.8 0 0 0 .5 9.5z"/><path d="M12 16v-6m-2.5 2.5L12 10l2.5 2.5"/></svg>`;

// "heute", "gestern", "vor 3 Tagen" für die letzte Sicherung
function backupAgoText(isoText) {
  if (!isoText) return "Noch nie";
  const text = lastDoneText(new Date(isoText)); // z.B. "Zuletzt vor 3 Tagen"
  return text.replace("Zuletzt ", "");
}

// Hinweis oben auf der Startseite, wenn eine Sicherung fällig ist
function renderBackupBanner() {
  const status = Store.getBackupStatus();
  if (!status.due) return "";
  const detail =
    status.unsavedCount === 1
      ? "1 Training ist noch nicht gesichert."
      : `${status.unsavedCount} Trainings sind noch nicht gesichert.`;
  return `
    <div class="backup-banner">
      ${BACKUP_ICON}
      <div class="backup-banner-text">
        <strong>Zeit für eine Sicherung</strong>
        <span>${detail}</span>
      </div>
      <div class="backup-banner-actions">
        <button class="text-button" data-action="backup-snooze">Später</button>
        <button class="pill-button" data-action="backup-export">Sichern</button>
      </div>
    </div>
  `;
}

// Abschnitt "Sicherung" in den Einstellungen
function renderBackupSection() {
  const status = Store.getBackupStatus();
  const sub =
    status.unsavedCount === 0
      ? "Alles gesichert"
      : `${status.unsavedCount} ${status.unsavedCount === 1 ? "Training" : "Trainings"} noch nicht gesichert`;
  return `
    <h2 class="section-title">Sicherung</h2>
    <div class="settings-row">
      <span class="settings-label">
        Letzte Sicherung
        <span class="settings-sub">${sub}</span>
      </span>
      <span class="settings-value">${backupAgoText(status.lastBackupAt)}</span>
    </div>
    <div class="set-buttons">
      <button class="pill-button" data-action="backup-export">Sichern</button>
      <button class="pill-button" data-action="backup-import">Importieren</button>
    </div>
    <p class="settings-hint">
      Tippe auf „Sichern“, wähle „In Dateien sichern“ und dann einen Ordner in iCloud Drive.
      Nimm immer denselben Ordner, dann ersetzt die neue Sicherung die alte.
    </p>
  `;
}

// Sicherung erstellen. Auf dem iPhone öffnet sich das Teilen-Menü
// ("In Dateien sichern"), sonst wird die Datei heruntergeladen.
// "async" heißt: Die Funktion kann auf etwas warten (hier: bis man im
// Teilen-Menü fertig ist), ohne die App zu blockieren.
async function exportBackup() {
  const text = Store.exportData();
  let file = new File([text], BACKUP_FILE_NAME, { type: "application/json" });
  // Manche Browser teilen keine .json-Dateien; dann als einfacher Text
  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    file = new File([text], BACKUP_FILE_NAME, { type: "text/plain" });
  }

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Gym-Tracker Sicherung" });
      Store.markBackupDone();
    } catch (error) {
      // "AbortError" = im Teilen-Menü abgebrochen. Das ist kein Fehler.
      if (error.name !== "AbortError") {
        alert("Die Sicherung konnte nicht geteilt werden: " + error.message);
      }
    }
  } else {
    // Herunterladen: unsichtbaren Link auf die Datei anlegen und anklicken
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = BACKUP_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // Speicher wieder freigeben
    Store.markBackupDone();
  }
  renderCurrentView();
}

// Sicherung einspielen, sobald eine Datei ausgewählt wurde
document.getElementById("import-input").addEventListener("change", async (event) => {
  const input = event.target;
  const file = input.files[0];
  input.value = ""; // Zurücksetzen, damit dieselbe Datei erneut wählbar ist
  if (!file) return;

  const text = await file.text(); // Inhalt der Datei als Text lesen
  try {
    const info = Store.inspectBackup(text);
    const when = new Date(info.exportedAt).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const question =
      `Sicherung vom ${when} einspielen?\n\n` +
      `Sie enthält ${info.workoutCount} Trainings und ${info.exerciseCount} Übungen.\n` +
      `Deine aktuellen Daten in der App werden dabei ersetzt.`;
    if (!confirm(question)) return;
    Store.importData(text);
    RestTimer.reset();
    alert("Die Sicherung wurde eingespielt.");
    location.hash = "start";
    renderCurrentView();
  } catch (error) {
    alert(error.message);
  }
});

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

  // Timer-Knöpfe haben ihren eigenen Behandler (siehe oben)
  if (action.startsWith("timer-")) {
    handleTimerAction(button);
    return;
  }

  // Aufwärmsatz für diese Übung grundsätzlich an/aus (Seite "Übung bearbeiten")
  if (action === "toggle-exercise-warmup") {
    const id = parseHash().params[0];
    Store.updateExercise(id, { warmup: !Store.getExerciseSettings(id).warmup });
    renderCurrentView();
    return;
  }

  // Notiz auf der Übungsseite öffnen bzw. schließen
  if (action === "note-edit") {
    noteEditingId = exerciseId;
    refreshNoteArea();
    document.querySelector("#note-area textarea").focus();
    return;
  }
  if (action === "note-done") {
    noteEditingId = null;
    refreshNoteArea();
    return;
  }

  // Sicherung
  if (action === "backup-export") {
    exportBackup();
    return;
  }
  if (action === "backup-import") {
    document.getElementById("import-input").click(); // Dateiauswahl öffnen
    return;
  }
  if (action === "backup-snooze") {
    Store.snoozeBackupReminder();
    renderCurrentView();
    return;
  }

  // Urlaubsmodus ein- bzw. ausschalten
  if (action === "toggle-vacation") {
    Store.setVacationActive(!Store.isVacationActive());
    renderCurrentView();
    return;
  }

  // Wochenziel festlegen (Widget) bzw. mit − / + ändern (Einstellungen)
  if (action === "set-goal") {
    Store.setWeeklyGoal(Number(button.dataset.goal));
    renderCurrentView();
    return;
  }
  if (action === "goal-step") {
    const current = Store.getWeeklyGoal();
    // Noch kein Ziel: Der erste Druck setzt 3, danach geht es in Schritten
    const next = current === null ? 3 : current + Number(button.dataset.delta);
    Store.setWeeklyGoal(Math.min(7, Math.max(1, next)));
    renderCurrentView();
    return;
  }

  // Umschalter im Verlauf: nur den Verlaufsbereich neu zeichnen
  if (action === "history-metric") {
    historyMetric = button.dataset.metric;
    const history = document.getElementById("history");
    history.innerHTML = renderExerciseHistory(history.dataset.exercise, historyMetric);
    return;
  }

  // Übung abhaken bzw. Haken entfernen
  if (action === "toggle-done") {
    Store.toggleExerciseDone(exerciseId);
    renderAnimated();
    return;
  }

  // Übung für heute überspringen bzw. zurückholen
  if (action === "toggle-skip") {
    Store.toggleExerciseSkipped(exerciseId);
    renderAnimated();
    return;
  }

  // Training beenden und speichern
  if (action === "finish-workout") {
    const unitIdNow = parseHash().params[0];
    const unit = Store.getUnit(Store.getActivePlanId(), unitIdNow);
    const openCount = unit.exerciseIds.filter(
      (id) => !Store.isExerciseDone(id) && !Store.isExerciseSkipped(id)
    ).length;
    if (openCount > 0) {
      const text = openCount === 1 ? "Noch 1 Übung ist offen." : `Noch ${openCount} Übungen sind offen.`;
      if (!confirm(`${text} Training trotzdem beenden?`)) return;
    }
    Store.finishWorkout();
    RestTimer.reset(); // Ein laufender Pausentimer gehört zum beendeten Training
    location.hash = "start";
    return;
  }

  // Sätze hinzufügen/entfernen. Auf der Übungsseite steht die id der
  // Übung an zweiter Stelle der Adresse: #start/<einheit>/<übung>
  if (action === "add-warmup" || action === "remove-warmup") {
    const currentExerciseId = parseHash().params[1];
    if (action === "add-warmup") Store.addWarmup(currentExerciseId);
    else Store.removeWarmup(currentExerciseId);
    renderCurrentView();
    return;
  }

  if (action === "add-set" || action === "remove-set") {
    const currentExerciseId = parseHash().params[1];
    if (action === "add-set") {
      Store.addSet(currentExerciseId);
    } else {
      Store.removeSet(currentExerciseId);
    }
    renderCurrentView();
    return;
  }

  if (action === "activate-plan") {
    Store.setActivePlan(button.dataset.plan);
  } else if (action === "toggle-in-unit") {
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

// Eingabe in ein Satz-Feld (Gewicht oder Wiederholungen).
// "input" feuert bei jedem getippten Zeichen. Wir speichern sofort, zeichnen
// aber NICHT neu, sonst würde das Feld beim Tippen den Fokus verlieren.
appMain.addEventListener("input", (event) => {
  const input = event.target;
  if (!input.matches(".set-input")) return;

  const exerciseId = parseHash().params[1];
  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  const newValue = parseNumber(input.value);
  const oldValue = Store.getSets(exerciseId)[index][field];

  Store.updateSet(exerciseId, index, field, newValue);

  // Gewicht ist meist in allen Sätzen gleich: Den neuen Wert in die
  // FOLGENDEN Arbeitssätze übernehmen, sofern dort noch nichts oder derselbe
  // alte Wert stand. Bewusst geänderte Gewichte bleiben unangetastet.
  // Der Aufwärmsatz wird nie übernommen und gibt nichts weiter.
  if (field !== "weight") return;
  const sets = Store.getSets(exerciseId);
  if (sets[index].warmup) return;
  sets.forEach((set, i) => {
    if (i <= index || set.warmup) return;
    if (set.weight === null || set.weight === oldValue) {
      Store.updateSet(exerciseId, i, "weight", newValue);
      const other = document.querySelector(`.set-input[data-index="${i}"][data-field="weight"]`);
      if (other) other.value = formatNumber(newValue);
    }
  });

  // Ändert sich das Gewicht des ERSTEN Arbeitssatzes, zieht der Aufwärmsatz
  // mit, solange er noch auf dem alten Vorschlag (oder leer) steht
  const warmupIndex = sets.findIndex((set) => set.warmup);
  const firstWorkingIndex = sets.findIndex((set) => !set.warmup);
  if (warmupIndex !== -1 && index === firstWorkingIndex) {
    const warmup = sets[warmupIndex];
    if (warmup.weight === null || warmup.weight === warmupWeightFor(oldValue)) {
      const suggestion = warmupWeightFor(newValue);
      Store.updateSet(exerciseId, warmupIndex, "weight", suggestion);
      const warmupInput = document.querySelector(`.set-input[data-index="${warmupIndex}"][data-field="weight"]`);
      if (warmupInput) warmupInput.value = formatNumber(suggestion);
    }
  }
});

// Felder der Seite "Übung bearbeiten" und das Notizfeld im Training
appMain.addEventListener("input", handleExerciseEdit);
appMain.addEventListener("change", handleExerciseEdit);

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

  // Das Listenelement, zu dem der Griff gehört
  const item = handle.closest(".sortable > li");
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
  // Die neue Reihenfolge aus den Kästchen ablesen und speichern.
  // data-sort an der Liste sagt, ob Übungen oder Einheiten sortiert wurden.
  const orderedIds = [...drag.list.children].map((li) => li.dataset.id);
  const [planId, unitId] = parseHash().params;
  if (drag.list.dataset.sort === "unit-exercises") {
    Store.setUnitExerciseOrder(planId, unitId, orderedIds);
  } else if (drag.list.dataset.sort === "plan-units") {
    Store.setUnitOrder(planId, orderedIds);
  }
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
