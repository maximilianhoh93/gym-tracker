// ===== Datenspeicher =====
// Alle Zugriffe auf Daten laufen über diese Datei. Der Rest der App fragt
// nur "Store.getPlans()" o.ä. und weiß nicht, WO die Daten liegen.
// So lässt sich die Speicherung später austauschen (z.B. gegen eine Cloud),
// ohne den Rest der App anzufassen.
//
// Im Moment liegen die Daten nur im Arbeitsspeicher, nach dem Neuladen ist
// also alles wieder im Ausgangszustand. Dauerhaftes Speichern folgt in Schritt 7.
//
// Aufbau der Daten:
// - exercises: der Übungs-Pool. Jede Übung gibt es genau einmal, mit
//   Name und Muskelgruppe.
// - plans: die Trainingsarten. Eine Einheit speichert nur die ids der
//   ausgewählten Übungen ("exerciseIds"), in der gewünschten Reihenfolge.
//   So ist "Bankdrücken" in Push und in Oberkörper dieselbe Übung.
// - activePlanId: der Plan, mit dem gerade trainiert wird (oder null)
// - workouts: absolvierte Trainings, z.B. { unitId: "ppl-push", date: "2026-10-05T18:30:00.000Z", ... }.
//   Wird ab Schritt 4 befüllt.
// - currentWorkout: das gerade laufende Training (oder null). Pro Übung
//   die Sätze mit Gewicht (kg) und Wiederholungen:
//   { unitId: "ppl-push", exercises: { "<übung-id>": { sets: [{ weight: 60, reps: 10 }, ...], done: false } } }

// Standard-Pausenzeit für neue Übungen in Sekunden (2 Minuten)
const DEFAULT_REST_SECONDS = 120;

// Standard-Anzahl der Sätze pro Übung
const DEFAULT_SET_COUNT = 2;

// Die Muskelgruppen, nach denen der Pool sortiert ist (in dieser Reihenfolge)
const MUSCLE_GROUPS = [
  { id: "brust", name: "Brust" },
  { id: "ruecken", name: "Rücken" },
  { id: "schultern", name: "Schultern" },
  { id: "bizeps", name: "Bizeps" },
  { id: "trizeps", name: "Trizeps" },
  { id: "beine", name: "Beine" },
  { id: "gesaess", name: "Gesäß" },
  { id: "waden", name: "Waden" },
  { id: "bauch", name: "Bauch" },
  { id: "sonstige", name: "Sonstige" },
];

// Die Trainingsarten, die beim ersten Öffnen vorhanden sind (ohne Übungen)
const DEFAULT_PLANS = [
  {
    id: "ganzkoerper",
    name: "Ganzkörper",
    description: "Jede Einheit trainiert den ganzen Körper. Gut für 2–3 Trainingstage pro Woche.",
    units: [
      { id: "ganzkoerper-a", name: "Ganzkörper A", exerciseIds: [] },
      { id: "ganzkoerper-b", name: "Ganzkörper B", exerciseIds: [] },
    ],
  },
  {
    id: "upper-lower",
    name: "Upper/Lower",
    description: "Wechsel zwischen Ober- und Unterkörper. Gut für 4 Trainingstage pro Woche.",
    units: [
      { id: "upper-lower-upper", name: "Oberkörper", exerciseIds: [] },
      { id: "upper-lower-lower", name: "Unterkörper", exerciseIds: [] },
    ],
  },
  {
    id: "ppl",
    name: "Push/Pull/Legs",
    description: "Drücken, Ziehen, Beine. Gut für 3 oder 6 Trainingstage pro Woche.",
    units: [
      { id: "ppl-push", name: "Push", exerciseIds: [] },
      { id: "ppl-pull", name: "Pull", exerciseIds: [] },
      { id: "ppl-legs", name: "Legs", exerciseIds: [] },
    ],
  },
  {
    id: "bro-split",
    name: "Bro-Split",
    description: "Ein Muskelbereich pro Tag. Gut für 5 Trainingstage pro Woche.",
    units: [
      { id: "bro-split-brust", name: "Brust", exerciseIds: [] },
      { id: "bro-split-ruecken", name: "Rücken", exerciseIds: [] },
      { id: "bro-split-schultern", name: "Schultern", exerciseIds: [] },
      { id: "bro-split-arme", name: "Arme", exerciseIds: [] },
      { id: "bro-split-beine", name: "Beine", exerciseIds: [] },
    ],
  },
];

// Die aktuellen Daten. structuredClone erstellt eine echte Kopie,
// damit die Vorlage oben unverändert bleibt.
let plans = structuredClone(DEFAULT_PLANS);
let exercises = [];
let activePlanId = null;
let workouts = [];
let currentWorkout = null;

const Store = {
  // ----- Muskelgruppen -----

  getMuscleGroups() {
    return structuredClone(MUSCLE_GROUPS);
  },

  // ----- Übungs-Pool -----

  // Alle Übungen, alphabetisch sortiert (localeCompare beachtet Umlaute)
  getExercises() {
    return structuredClone(exercises).sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  getExercise(exerciseId) {
    const exercise = exercises.find((ex) => ex.id === exerciseId);
    return exercise ? structuredClone(exercise) : undefined;
  },

  // Neue Übung in den Pool aufnehmen.
  // Gibt die neue Übung zurück, oder null, falls es den Namen schon gibt.
  addExercise(name, muscleGroupId) {
    const exists = exercises.some((ex) => ex.name.toLowerCase() === name.toLowerCase());
    if (exists) return null;
    const exercise = {
      id: createId(),
      name: name,
      muscleGroupId: muscleGroupId,
      restSeconds: DEFAULT_REST_SECONDS, // Pausenzeit, die sich die Übung merkt
    };
    exercises.push(exercise);
    return structuredClone(exercise);
  },

  // Die Pausenzeit, die sich eine Übung gemerkt hat (in Sekunden)
  getRestSeconds(exerciseId) {
    const exercise = exercises.find((ex) => ex.id === exerciseId);
    return exercise && exercise.restSeconds ? exercise.restSeconds : DEFAULT_REST_SECONDS;
  },

  setRestSeconds(exerciseId, seconds) {
    const exercise = exercises.find((ex) => ex.id === exerciseId);
    if (exercise) exercise.restSeconds = seconds;
  },

  // Übung aus dem Pool löschen, und damit auch aus allen Einheiten
  deleteExercise(exerciseId) {
    // filter() behält nur die Einträge, deren id NICHT die gesuchte ist
    exercises = exercises.filter((ex) => ex.id !== exerciseId);
    plans.forEach((plan) => {
      plan.units.forEach((unit) => {
        unit.exerciseIds = unit.exerciseIds.filter((id) => id !== exerciseId);
      });
    });
  },

  // In wie vielen Einheiten eine Übung vorkommt (für die Rückfrage beim Löschen)
  countUnitsUsingExercise(exerciseId) {
    let count = 0;
    plans.forEach((plan) => {
      plan.units.forEach((unit) => {
        if (unit.exerciseIds.includes(exerciseId)) count++;
      });
    });
    return count;
  },

  // ----- Pläne und Einheiten -----

  // Alle Pläne. Wir geben eine Kopie heraus, damit die App die Daten
  // nicht versehentlich "an der Speicherung vorbei" verändert.
  getPlans() {
    return structuredClone(plans);
  },

  // Ein einzelner Plan anhand seiner id (oder undefined, falls es ihn nicht gibt)
  getPlan(planId) {
    const plan = plans.find((p) => p.id === planId);
    return plan ? structuredClone(plan) : undefined;
  },

  // ----- Aktiver Plan -----

  getActivePlanId() {
    return activePlanId;
  },

  setActivePlan(planId) {
    activePlanId = planId;
  },

  // Neue Reihenfolge der Einheiten eines Plans übernehmen (nach Drag and Drop)
  setUnitOrder(planId, orderedUnitIds) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    // Zu jeder id die passende Einheit suchen; unbekannte ids fallen weg
    const reordered = orderedUnitIds
      .map((id) => plan.units.find((u) => u.id === id))
      .filter(Boolean);
    // Nur übernehmen, wenn keine Einheit verloren gegangen ist
    if (reordered.length === plan.units.length) {
      plan.units = reordered;
    }
  },

  // ----- Trainings -----

  // Datum des letzten Trainings einer Einheit (als Date) oder null
  getLastWorkoutDate(unitId) {
    const dates = workouts.filter((w) => w.unitId === unitId).map((w) => new Date(w.date));
    if (dates.length === 0) return null;
    // Math.max liefert die größte Zahl, also den spätesten Zeitpunkt
    return new Date(Math.max(...dates));
  },

  // ----- Laufendes Training -----

  // Training für eine Einheit beginnen. Läuft schon eins für dieselbe
  // Einheit, passiert nichts (die eingetragenen Sätze bleiben erhalten).
  startWorkout(planId, unitId) {
    if (currentWorkout && currentWorkout.unitId === unitId) return;
    currentWorkout = {
      id: createId(),
      planId: planId,
      unitId: unitId,
      startedAt: new Date().toISOString(), // Zeitpunkt als Text, z.B. "2026-10-05T18:30:00.000Z"
      exercises: {},
    };
  },

  // Die Sätze einer Übung im laufenden Training
  getSets(exerciseId) {
    const entry = workoutEntry(exerciseId);
    return entry ? structuredClone(entry.sets) : [];
  },

  // Einen Wert eines Satzes ändern. field ist "weight" oder "reps",
  // value eine Zahl oder null (leer).
  updateSet(exerciseId, index, field, value) {
    const entry = workoutEntry(exerciseId);
    if (!entry || !entry.sets[index]) return;
    entry.sets[index][field] = value;
  },

  // Satz hinzufügen. Er übernimmt Gewicht und Wiederholungen vom letzten Satz.
  addSet(exerciseId) {
    const entry = workoutEntry(exerciseId);
    if (!entry) return;
    const last = entry.sets[entry.sets.length - 1];
    // { ...last } erstellt eine Kopie des letzten Satzes
    entry.sets.push(last ? { ...last } : { weight: null, reps: null });
    rememberSetCount(exerciseId, entry.sets.length);
  },

  // Ist die Übung im laufenden Training abgehakt?
  isExerciseDone(exerciseId) {
    return Boolean(currentWorkout && currentWorkout.exercises[exerciseId] && currentWorkout.exercises[exerciseId].done);
  },

  // Haken setzen bzw. wieder entfernen
  toggleExerciseDone(exerciseId) {
    const entry = workoutEntry(exerciseId);
    if (entry) entry.done = !entry.done;
  },

  // Training beenden: Es wandert in die Liste der absolvierten Trainings.
  // Gespeichert werden nur Übungen, die abgehakt sind oder ausgefüllte
  // Sätze haben, jeweils mit der verwendeten Pausenzeit.
  finishWorkout() {
    if (!currentWorkout) return;
    const finished = {
      id: currentWorkout.id,
      planId: currentWorkout.planId,
      unitId: currentWorkout.unitId,
      startedAt: currentWorkout.startedAt,
      date: new Date().toISOString(), // Zeitpunkt des Beendens
      exercises: [],
    };
    // Object.entries macht aus { id: eintrag, ... } eine Liste von [id, eintrag]
    Object.entries(currentWorkout.exercises).forEach(([exerciseId, entry]) => {
      const sets = entry.sets.filter((set) => set.weight !== null || set.reps !== null);
      if (sets.length === 0 && !entry.done) return; // Übung nicht gemacht
      finished.exercises.push({
        exerciseId: exerciseId,
        sets: sets,
        done: Boolean(entry.done),
        restSeconds: Store.getRestSeconds(exerciseId),
      });
    });
    workouts.push(finished);
    currentWorkout = null;
  },

  // Letzten Satz entfernen (mindestens einer bleibt)
  removeSet(exerciseId) {
    const entry = workoutEntry(exerciseId);
    if (!entry || entry.sets.length <= 1) return;
    entry.sets.pop(); // pop() entfernt das letzte Element
    rememberSetCount(exerciseId, entry.sets.length);
  },

  // ----- Einheiten -----

  // Eine einzelne Einheit eines Plans (oder undefined)
  getUnit(planId, unitId) {
    const unit = findUnit(planId, unitId);
    return unit ? structuredClone(unit) : undefined;
  },

  // Übung aus dem Pool zur Einheit hinzufügen (ans Ende)
  addExerciseToUnit(planId, unitId, exerciseId) {
    const unit = findUnit(planId, unitId);
    if (!unit || unit.exerciseIds.includes(exerciseId)) return;
    unit.exerciseIds.push(exerciseId);
  },

  // Übung aus der Einheit entfernen (im Pool bleibt sie erhalten)
  removeExerciseFromUnit(planId, unitId, exerciseId) {
    const unit = findUnit(planId, unitId);
    if (!unit) return;
    unit.exerciseIds = unit.exerciseIds.filter((id) => id !== exerciseId);
  },

  // Neue Reihenfolge der Übungen einer Einheit übernehmen (nach Drag and Drop)
  setUnitExerciseOrder(planId, unitId, orderedIds) {
    const unit = findUnit(planId, unitId);
    if (!unit) return;
    // Sicherheitshalber nur ids übernehmen, die wirklich zur Einheit gehören
    unit.exerciseIds = orderedIds.filter((id) => unit.exerciseIds.includes(id));
  },
};

// ===== Interne Hilfsfunktionen (nur innerhalb dieser Datei benutzt) =====

// Sucht die Einheit im echten Datenbestand (keine Kopie), damit wir sie
// verändern können
function findUnit(planId, unitId) {
  const plan = plans.find((p) => p.id === planId);
  return plan ? plan.units.find((u) => u.id === unitId) : undefined;
}

// Eintrag einer Übung im laufenden Training. Gibt es noch keinen, wird er
// mit der gemerkten Satzanzahl (Standard: 2) und leeren Sätzen angelegt.
function workoutEntry(exerciseId) {
  if (!currentWorkout) return null;
  if (!currentWorkout.exercises[exerciseId]) {
    const exercise = exercises.find((ex) => ex.id === exerciseId);
    const count = exercise && exercise.setCount ? exercise.setCount : DEFAULT_SET_COUNT;
    // Array.from({ length: 2 }, ...) erzeugt eine Liste mit 2 Einträgen
    const sets = Array.from({ length: count }, () => ({ weight: null, reps: null }));
    currentWorkout.exercises[exerciseId] = { sets: sets, done: false };
  }
  return currentWorkout.exercises[exerciseId];
}

// Die Übung merkt sich, wie viele Sätze man zuletzt gemacht hat
function rememberSetCount(exerciseId, count) {
  const exercise = exercises.find((ex) => ex.id === exerciseId);
  if (exercise) exercise.setCount = count;
}

// Erzeugt eine eindeutige id für neue Einträge, z.B. "lx3k9a-4f2b".
// Aus der aktuellen Zeit plus einer Zufallszahl, damit zwei ids nie gleich sind.
function createId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}
