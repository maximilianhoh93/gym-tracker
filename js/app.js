// ===== Navigation =====
// Die App hat nur eine HTML-Seite. Welche Ansicht sichtbar ist, steht im
// "Hash" der Adresse, also dem Teil nach dem # (z.B. index.html#plaene).
// Vorteil: Der Zurück-Knopf funktioniert und nach dem Neuladen bleibt man
// in derselben Ansicht.
//
// Unteransichten hängen wir mit "/" an:
//   #training/ppl-push             -> Training der Einheit "Push" (aktiver Plan)
//   #training/ppl-push/<übung-id>  -> eine Übung in diesem Training (mit Timer)
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
  updateTimerBar();

  // Nach jedem Wechsel nach oben scrollen
  window.scrollTo(0, 0);
}

// Zeichnet den Inhalt der aktuellen Ansicht (neu). Wird auch nach jeder
// Änderung aufgerufen, dann aber ohne nach oben zu scrollen.
function renderCurrentView() {
  const { viewName, params } = parseHash();

  // Standard-Kopfzeile; einzelne Ansichten können sie überschreiben
  setHeader(VIEW_TITLES[viewName]);

  if (viewName === "training") {
    renderTraining(params[0], params[1]);
  } else if (viewName === "plaene") {
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

// ===== Ansicht "Training" =====
// Ohne unitId: Einheiten des aktiven Plans zur Auswahl.
// Mit unitId: das Training dieser Einheit.
// Mit unitId und exerciseId: eine einzelne Übung mit Pausentimer.
function renderTraining(unitId, exerciseId) {
  const container = document.getElementById("view-training");
  const plan = Store.getPlan(Store.getActivePlanId());

  // Noch kein Plan aktiviert -> Hinweis mit Weg zu den Plänen
  if (!plan) {
    container.innerHTML = `
      <p class="intro">Du hast noch keinen Plan aktiviert. Wähle unter „Pläne“ eine Trainingsart
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

  const cards = plan.units
    .map((unit) => {
      const isNext = unit.id === nextId;
      return `
        <li>
          <a class="exercise-card unit-card ${isNext ? "next" : ""}" href="#training/${unit.id}">
            <span class="exercise-info">
              <span class="exercise-name">${escapeHtml(unit.name)}</span>
              <span class="exercise-meta">
                ${exerciseCountText(unit.exerciseIds.length)} · ${lastDoneText(Store.getLastWorkoutDate(unit.id))}
              </span>
            </span>
            ${isNext ? `<span class="badge">Heute dran</span>` : ""}
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        </li>
      `;
    })
    .join("");

  container.innerHTML = `
    <p class="intro">
      ${escapeHtml(plan.name)} · <a href="#plaene/${plan.id}">Plan bearbeiten</a>
    </p>
    <h2 class="section-title">Welche Einheit trainierst du heute?</h2>
    <ul class="card-list">${cards}</ul>
  `;
}

// Training einer Einheit: Liste der Übungen. Ein Tipp öffnet die Übung.
function renderWorkout(container, plan, unitId) {
  const unit = Store.getUnit(plan.id, unitId);
  if (!unit) {
    location.hash = "training";
    return;
  }
  setHeader(unit.name, "#training");

  const exercises = unit.exerciseIds.map((id) => Store.getExercise(id)).filter(Boolean);
  const cards = exercises
    .map(
      (exercise) => `
        <li>
          <a class="exercise-card unit-card" href="#training/${unit.id}/${exercise.id}">
            <span class="exercise-info">
              <span class="exercise-name">${escapeHtml(exercise.name)}</span>
              <span class="exercise-meta">${escapeHtml(muscleGroupName(exercise.muscleGroupId))}</span>
            </span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        </li>
      `
    )
    .join("");

  container.innerHTML = `
    <p class="intro">${escapeHtml(plan.name)} · ${exerciseCountText(exercises.length)}</p>
    ${exercises.length === 0
      ? `<p class="placeholder">Diese Einheit hat noch keine Übungen.</p>
         <a class="button-secondary" href="#plaene/${plan.id}/${unit.id}/auswahl">Übungen auswählen</a>`
      : `<ul class="card-list">${cards}</ul>`}
  `;
}

// Eine Übung im Training: Pausentimer, später auch die Sätze
function renderExerciseView(container, plan, unitId, exerciseId) {
  const unit = Store.getUnit(plan.id, unitId);
  const exercise = Store.getExercise(exerciseId);
  if (!unit || !exercise) {
    location.hash = "training/" + unitId;
    return;
  }
  setHeader(exercise.name, "#training/" + unit.id);

  // Position in der Einheit, für "Übung 2 von 5" und den Weiter-Knopf
  const index = unit.exerciseIds.indexOf(exercise.id);
  const nextExercise = Store.getExercise(unit.exerciseIds[index + 1]);

  const nextLink = nextExercise
    ? `<a class="button-secondary" href="#training/${unit.id}/${nextExercise.id}">
         Nächste Übung: ${escapeHtml(nextExercise.name)} ›</a>`
    : `<a class="button-secondary" href="#training/${unit.id}">Zurück zur Übersicht</a>`;

  // Die Timer-Karte merkt sich in data-exercise, zu welcher Übung sie gehört
  container.innerHTML = `
    <p class="intro">
      ${escapeHtml(muscleGroupName(exercise.muscleGroupId))} · Übung ${index + 1} von ${unit.exerciseIds.length}
    </p>
    <div id="timer-card" class="timer-card" data-exercise="${exercise.id}" data-unit="${unit.id}">
      ${renderTimerCard(exercise.id)}
    </div>
    <h2 class="section-title">Sätze</h2>
    <p class="placeholder">Sätze mit Gewicht und Wiederholungen erfassen kommt im nächsten Schritt.</p>
    ${nextLink}
  `;
}

// ===== Pausentimer: Anzeige =====
// Die Logik steckt in js/timer.js (RestTimer). Hier wird nur angezeigt.

// Umfang des Rings: 2 · π · Radius. Damit zeichnen wir den Fortschritt:
// Eine Linie mit Strichlänge = Umfang, die um einen Teil davon
// "verschoben" wird, erscheint nur teilweise (stroke-dashoffset).
const RING_RADIUS = 88;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Schnellwahl-Dauern in Sekunden
const TIMER_PRESETS = [60, 90, 120, 180];

// Gehört der laufende Timer zu dieser Übung?
function timerBelongsTo(exerciseId) {
  return RestTimer.status !== "idle" && RestTimer.context && RestTimer.context.exerciseId === exerciseId;
}

// Inhalt der Timer-Karte, abhängig vom Zustand des Timers
function renderTimerCard(exerciseId) {
  const restSeconds = Store.getRestSeconds(exerciseId);
  // Läuft der Timer gerade für eine ANDERE Übung, zeigt diese Karte ihren
  // eigenen Bereit-Zustand. Ein Start hier ersetzt dann den anderen Timer.
  const status = timerBelongsTo(exerciseId) ? RestTimer.status : "idle";

  const timeText = status === "idle" ? formatDuration(restSeconds * 1000) : formatDuration(RestTimer.getRemainingMs());
  const progress = status === "idle" ? 1 : RestTimer.getProgress();
  const labels = { idle: "Pause", running: "Pause läuft", paused: "Angehalten", done: "Pause vorbei" };

  // Linker Knopf: "Abbrechen" (bei "done": "Fertig")
  const leftButton =
    status === "done"
      ? `<button class="round-button gray" data-action="timer-reset">Fertig</button>`
      : `<button class="round-button gray" data-action="timer-reset" ${status === "idle" ? "disabled" : ""}>Abbrechen</button>`;

  // Rechter Knopf: je nach Zustand Start / Pause / Fortsetzen / Nochmal
  const rightButtons = {
    idle: `<button class="round-button green" data-action="timer-start">Start</button>`,
    running: `<button class="round-button orange" data-action="timer-pause">Pause</button>`,
    paused: `<button class="round-button green" data-action="timer-resume">Weiter</button>`,
    done: `<button class="round-button green" data-action="timer-start">Nochmal</button>`,
  };

  // Dauer verstellen geht nur, solange der Timer nicht läuft
  const adjust =
    status === "idle"
      ? `
        <div class="timer-adjust">
          <button class="step-button" data-action="timer-adjust" data-delta="-15" aria-label="15 Sekunden weniger">−15 s</button>
          ${TIMER_PRESETS.map(
            (seconds) => `
              <button class="preset ${seconds === restSeconds ? "selected" : ""}"
                data-action="timer-preset" data-seconds="${seconds}">${formatDuration(seconds * 1000)}</button>`
          ).join("")}
          <button class="step-button" data-action="timer-adjust" data-delta="15" aria-label="15 Sekunden mehr">+15 s</button>
        </div>`
      : "";

  return `
    <div class="timer-ring ${status}">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle class="ring-track" cx="100" cy="100" r="${RING_RADIUS}"></circle>
        <circle class="ring-progress" id="timer-progress" cx="100" cy="100" r="${RING_RADIUS}"
          stroke-dasharray="${RING_CIRCUMFERENCE}"
          stroke-dashoffset="${RING_CIRCUMFERENCE * (1 - progress)}"></circle>
      </svg>
      <div class="timer-center">
        <span class="timer-time" id="timer-time">${timeText}</span>
        <span class="timer-label">${labels[status]}</span>
      </div>
    </div>
    ${adjust}
    <div class="timer-buttons">
      ${leftButton}
      ${rightButtons[status]}
    </div>
  `;
}

// Zeichnet die Timer-Karte neu (nur die Karte, nicht die ganze Seite)
function refreshTimerCard() {
  const card = document.getElementById("timer-card");
  if (card) card.innerHTML = renderTimerCard(card.dataset.exercise);
}

// Aktualisiert nur Ziffern und Ring. Wird mehrmals pro Sekunde aufgerufen,
// daher bewusst sparsam: kein Neuzeichnen der ganzen Karte.
function updateTimerDigits() {
  const card = document.getElementById("timer-card");
  if (!card || !timerBelongsTo(card.dataset.exercise)) return;
  document.getElementById("timer-time").textContent = formatDuration(RestTimer.getRemainingMs());
  document
    .getElementById("timer-progress")
    .setAttribute("stroke-dashoffset", RING_CIRCUMFERENCE * (1 - RestTimer.getProgress()));
}

// Die kleine Leiste unten: sichtbar, wenn ein Timer aktiv ist, man aber
// gerade nicht auf der Seite seiner Übung ist
function updateTimerBar() {
  const bar = document.getElementById("timer-bar");
  const card = document.getElementById("timer-card");
  const onTimerPage =
    card && !card.closest("[hidden]") && timerBelongsTo(card.dataset.exercise);
  const show = RestTimer.status !== "idle" && !onTimerPage;

  bar.hidden = !show;
  document.body.classList.toggle("has-timer-bar", show);
  if (!show) return;

  const { unitId, exerciseId, exerciseName } = RestTimer.context;
  bar.href = `#training/${unitId}/${exerciseId}`;
  bar.classList.toggle("done", RestTimer.status === "done");
  document.getElementById("timer-bar-text").textContent =
    RestTimer.status === "done" ? `Pause vorbei · ${exerciseName}` : `Pause · ${exerciseName}`;
  document.getElementById("timer-bar-time").textContent = formatDuration(RestTimer.getRemainingMs());
}

// Knöpfe der Timer-Karte
function handleTimerAction(button) {
  const card = document.getElementById("timer-card");
  const exerciseId = card.dataset.exercise;
  const action = button.dataset.action;

  if (action === "timer-start") {
    const exercise = Store.getExercise(exerciseId);
    RestTimer.start(Store.getRestSeconds(exerciseId), {
      unitId: card.dataset.unit,
      exerciseId: exerciseId,
      exerciseName: exercise.name,
    });
  } else if (action === "timer-pause") {
    RestTimer.pause();
  } else if (action === "timer-resume") {
    RestTimer.resume();
  } else if (action === "timer-reset") {
    RestTimer.reset();
  } else if (action === "timer-preset") {
    Store.setRestSeconds(exerciseId, Number(button.dataset.seconds));
  } else if (action === "timer-adjust") {
    // Zwischen 15 Sekunden und 10 Minuten bleiben
    const seconds = Store.getRestSeconds(exerciseId) + Number(button.dataset.delta);
    Store.setRestSeconds(exerciseId, Math.min(600, Math.max(15, seconds)));
  }
  // Start/Pause/... lösen über onChange ohnehin ein Neuzeichnen aus;
  // für das Verstellen der Dauer zeichnen wir hier selbst neu
  refreshTimerCard();
}

// Der Timer meldet sich bei jedem Takt und bei jeder Statusänderung
RestTimer.onTick = () => {
  updateTimerDigits();
  updateTimerBar();
};
RestTimer.onChange = () => {
  refreshTimerCard();
  updateTimerBar();
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
  const activePlanId = Store.getActivePlanId();

  // map() macht aus jedem Plan ein Stück HTML, join("") klebt alles zusammen
  const cards = plans
    .map(
      (plan) => `
        <a class="card card-link ${plan.id === activePlanId ? "active-plan" : ""}" href="#plaene/${plan.id}">
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
            <span class="exercise-meta">${exerciseCountText(unit.exerciseIds.length)} ›</span>
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

  // Timer-Knöpfe haben ihren eigenen Behandler (siehe oben)
  if (action.startsWith("timer-")) {
    handleTimerAction(button);
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
