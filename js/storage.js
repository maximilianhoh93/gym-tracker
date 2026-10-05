// ===== Datenspeicher =====
// Alle Zugriffe auf Daten laufen über diese Datei. Der Rest der App fragt
// nur "Store.getPlans()" o.ä. und weiß nicht, WO die Daten liegen.
// So lässt sich die Speicherung später austauschen (z.B. gegen eine Cloud),
// ohne den Rest der App anzufassen.
//
// Im Moment liegen die Daten nur im Arbeitsspeicher, nach dem Neuladen ist
// also alles wieder im Ausgangszustand. Dauerhaftes Speichern folgt in Schritt 7.

// Die Trainingsarten, die beim ersten Öffnen vorhanden sind.
// Aufbau: Ein Plan hat eine eindeutige "id", einen Namen, eine kurze
// Beschreibung und eine Liste von Einheiten. Jede Einheit hat später
// ihre eigene Liste von Übungen (anfangs leer).
const DEFAULT_PLANS = [
  {
    id: "ganzkoerper",
    name: "Ganzkörper",
    description: "Jede Einheit trainiert den ganzen Körper. Gut für 2–3 Trainingstage pro Woche.",
    units: [
      { id: "ganzkoerper-a", name: "Ganzkörper A", exercises: [] },
      { id: "ganzkoerper-b", name: "Ganzkörper B", exercises: [] },
    ],
  },
  {
    id: "upper-lower",
    name: "Upper/Lower",
    description: "Wechsel zwischen Ober- und Unterkörper. Gut für 4 Trainingstage pro Woche.",
    units: [
      { id: "upper-lower-upper", name: "Oberkörper", exercises: [] },
      { id: "upper-lower-lower", name: "Unterkörper", exercises: [] },
    ],
  },
  {
    id: "ppl",
    name: "Push/Pull/Legs",
    description: "Drücken, Ziehen, Beine. Gut für 3 oder 6 Trainingstage pro Woche.",
    units: [
      { id: "ppl-push", name: "Push", exercises: [] },
      { id: "ppl-pull", name: "Pull", exercises: [] },
      { id: "ppl-legs", name: "Legs", exercises: [] },
    ],
  },
  {
    id: "bro-split",
    name: "Bro-Split",
    description: "Ein Muskelbereich pro Tag. Gut für 5 Trainingstage pro Woche.",
    units: [
      { id: "bro-split-brust", name: "Brust", exercises: [] },
      { id: "bro-split-ruecken", name: "Rücken", exercises: [] },
      { id: "bro-split-schultern", name: "Schultern", exercises: [] },
      { id: "bro-split-arme", name: "Arme", exercises: [] },
      { id: "bro-split-beine", name: "Beine", exercises: [] },
    ],
  },
];

// Die aktuellen Daten. structuredClone erstellt eine echte Kopie,
// damit die Vorlage oben unverändert bleibt.
let plans = structuredClone(DEFAULT_PLANS);

const Store = {
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

  // Eine einzelne Einheit eines Plans (oder undefined)
  getUnit(planId, unitId) {
    const unit = findUnit(planId, unitId);
    return unit ? structuredClone(unit) : undefined;
  },

  // Neue Übung ans Ende der Einheit anhängen
  addExercise(planId, unitId, name) {
    const unit = findUnit(planId, unitId);
    if (!unit) return;
    unit.exercises.push({ id: createId(), name: name });
  },

  // Übung aus der Einheit entfernen
  removeExercise(planId, unitId, exerciseId) {
    const unit = findUnit(planId, unitId);
    if (!unit) return;
    // filter() behält nur die Übungen, deren id NICHT die gesuchte ist
    unit.exercises = unit.exercises.filter((ex) => ex.id !== exerciseId);
  },

  // Übung eine Position nach oben (-1) oder unten (+1) verschieben
  moveExercise(planId, unitId, exerciseId, direction) {
    const unit = findUnit(planId, unitId);
    if (!unit) return;
    const list = unit.exercises;
    const from = list.findIndex((ex) => ex.id === exerciseId);
    const to = from + direction;
    // Nicht über den Anfang oder das Ende der Liste hinaus schieben
    if (from === -1 || to < 0 || to >= list.length) return;
    // Die beiden Übungen tauschen die Plätze
    [list[from], list[to]] = [list[to], list[from]];
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
