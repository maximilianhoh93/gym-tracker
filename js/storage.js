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
    const exercise = { id: createId(), name: name, muscleGroupId: muscleGroupId };
    exercises.push(exercise);
    return structuredClone(exercise);
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

// Erzeugt eine eindeutige id für neue Einträge, z.B. "lx3k9a-4f2b".
// Aus der aktuellen Zeit plus einer Zufallszahl, damit zwei ids nie gleich sind.
function createId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}
