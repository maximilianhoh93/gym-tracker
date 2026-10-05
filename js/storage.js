// ===== Datenspeicher =====
// Alle Zugriffe auf Daten laufen über diese Datei. Der Rest der App fragt
// nur "Store.getPlans()" o.ä. und weiß nicht, WO die Daten liegen.
// So lässt sich die Speicherung später austauschen (z.B. gegen eine Cloud),
// ohne den Rest der App anzufassen.
//
// Gespeichert wird im "localStorage" des Browsers: ein kleiner, dauerhafter
// Speicher auf dem Gerät, in dem man Text unter einem Namen ablegen kann.
// Wir wandeln alle Daten in einen langen Text um (JSON) und legen ihn
// unter dem Namen "gym-tracker-data" ab:
// - Beim Start der App: Text lesen und zurück in Daten verwandeln (load)
// - Nach jeder Änderung: alles neu als Text ablegen (save)
// localStorage reicht für viele Jahre Trainingsdaten (etwa 5 MB Platz,
// ein Jahr Training sind ca. 300 KB) und ist viel einfacher als die
// Alternative IndexedDB, eine richtige Datenbank im Browser.
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
//   { unitId: "ppl-push", exercises: { "<übung-id>": { sets: [{ weight: 60, reps: 10 }, ...], done: false, skipped: false } } }

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
// Einstellungen. weeklyGoals: Wochenziel mit Startwoche, damit eine
// Änderung nur ab dann gilt und alte Wochen ihre Farbe behalten.
// z.B. [{ from: "0000-01-01", goal: 3 }, { from: "2026-10-05", goal: 4 }]
// vacations: Urlaubszeiten. "to" ist null, solange der Urlaub noch läuft.
// z.B. [{ from: "2026-08-03", to: "2026-08-16" }, { from: "2026-10-05", to: null }]
// lastBackupAt: wann zuletzt eine Sicherung erstellt wurde (oder fehlt).
// backupSnoozedUntil: bis wann die Erinnerung "Später" pausiert (oder fehlt).
let settings = { weeklyGoals: [], vacations: [] };

// ===== Dauerhaft speichern und laden =====

// Unter diesem Namen liegen die Daten im localStorage
const STORAGE_KEY = "gym-tracker-data";

// Version des Datenformats. Ändern wir später den Aufbau der Daten (z.B.
// für die Cloud), erhöhen wir diese Zahl. Die App erkennt dann alte Daten
// und kann sie umwandeln, statt sie falsch zu lesen.
const DATA_VERSION = 3; // 2: Wochenziel, 3: Urlaubsmodus

// Alle Daten in einem Objekt zusammenstellen (für Speichern und Export)
function snapshot() {
  return {
    version: DATA_VERSION,
    savedAt: new Date().toISOString(),
    plans: plans,
    exercises: exercises,
    activePlanId: activePlanId,
    workouts: workouts,
    currentWorkout: currentWorkout,
    settings: settings,
  };
}

// Gelesene Daten übernehmen (für Laden und Import)
function applyData(data) {
  plans = data.plans;
  exercises = data.exercises;
  activePlanId = data.activePlanId;
  workouts = data.workouts;
  currentWorkout = data.currentWorkout;
  settings = data.settings;
}

// Alle Daten als Text ablegen. Wird nach jeder Änderung aufgerufen.
function save() {
  const data = snapshot();
  // try/catch fängt Fehler ab, damit die App nicht abstürzt, z.B. wenn
  // der Speicher voll ist oder der Browser das Speichern verbietet
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Speichern fehlgeschlagen:", error);
    if (!save.warned) {
      save.warned = true; // Nur einmal warnen, nicht bei jedem Tastendruck
      alert("Deine Daten konnten nicht gespeichert werden. Bitte erstelle unter „Einstellungen“ eine Sicherung.");
    }
  }
}

// Gespeicherte Daten beim Start einlesen. Gibt es keine, bleiben die
// Ausgangswerte von oben (Vorlagen, leerer Pool).
function load() {
  let text = null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error("Lesen fehlgeschlagen:", error);
    return;
  }
  if (!text) return; // Erster Start: noch nichts gespeichert

  try {
    applyData(migrate(JSON.parse(text)));
  } catch (error) {
    // Daten sind beschädigt oder unlesbar. Nicht löschen, sondern unter
    // einem zweiten Namen beiseitelegen, damit man sie notfalls retten kann.
    console.error("Gespeicherte Daten unlesbar:", error);
    try {
      localStorage.setItem(STORAGE_KEY + "-defekt-" + Date.now(), text);
    } catch (e) {
      // Wenn auch das nicht geht, können wir nichts weiter tun
    }
    alert("Deine gespeicherten Daten konnten nicht gelesen werden. Die App startet leer. Du kannst unter „Einstellungen“ eine Sicherung importieren.");
  }
}

// Liest eine Sicherungsdatei und bringt sie auf den aktuellen Stand.
// Wirft einen verständlichen Fehler, wenn es keine passende Datei ist.
function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Die Datei ist keine gültige Sicherung.");
  }
  if (!data || data.app !== "gym-tracker") {
    throw new Error("Die Datei ist keine Sicherung dieser App.");
  }
  if (data.version > DATA_VERSION) {
    throw new Error("Die Sicherung stammt aus einer neueren Version der App.");
  }
  return migrate(data);
}

// Bringt Daten aus älteren Versionen Schritt für Schritt auf den
// aktuellen Stand. Jede Stufe macht aus Version n die Version n + 1.
function migrate(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.plans)) {
    throw new Error("Unbekanntes Datenformat");
  }
  if (data.version > DATA_VERSION) {
    throw new Error("Daten stammen aus einer neueren App-Version");
  }
  // Version 1 -> 2: Es gab noch keine Einstellungen
  if (data.version === 1) {
    data.settings = { weeklyGoals: [] };
    data.version = 2;
  }
  // Version 2 -> 3: Urlaubszeiten dazugekommen
  if (data.version === 2) {
    data.settings.vacations = [];
    data.version = 3;
  }
  return data;
}

// Den Browser bitten, unsere Daten dauerhaft zu behalten und nicht bei
// Speicherknappheit von selbst aufzuräumen. Nicht jeder Browser kennt
// das; dann passiert einfach nichts.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}

load();

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
    save();
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
    save();
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
    save();
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
    save();
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
    save();
  },

  // ----- Wochenziel -----

  // Das Wochenziel (Trainingstage pro Woche), das in einer bestimmten
  // Woche galt. weekKey ist der Montag dieser Woche, z.B. "2026-10-05".
  // Gibt null zurück, solange noch kein Ziel festgelegt wurde.
  getWeeklyGoal(weekKey = weekKeyOf(new Date())) {
    const goals = settings.weeklyGoals;
    if (goals.length === 0) return null;
    // Das letzte Ziel, das in dieser Woche schon galt
    const valid = goals.filter((g) => g.from <= weekKey);
    return valid.length > 0 ? valid[valid.length - 1].goal : goals[0].goal;
  },

  // Neues Wochenziel, gültig ab der laufenden Woche.
  // Das allererste Ziel gilt rückwirkend für alle früheren Wochen
  // ("0000-01-01" ist kleiner als jedes echte Datum). So bleibt es erhalten,
  // auch wenn man das Ziel noch in derselben Woche ändert.
  setWeeklyGoal(goal) {
    const from = settings.weeklyGoals.length === 0 ? "0000-01-01" : weekKeyOf(new Date());
    // Ein Eintrag pro Woche: Wird mehrmals in derselben Woche geändert,
    // zählt nur der letzte Wert
    settings.weeklyGoals = settings.weeklyGoals.filter((g) => g.from !== from);
    settings.weeklyGoals.push({ from: from, goal: goal });
    settings.weeklyGoals.sort((a, b) => a.from.localeCompare(b.from));
    save();
  },

  // ----- Sicherung (Export und Import) -----

  // Alle Daten als Text für die Sicherungsdatei. "app" kennzeichnet die
  // Datei, damit beim Import keine fremde Datei eingelesen wird.
  exportData() {
    return JSON.stringify({ app: "gym-tracker", exportedAt: new Date().toISOString(), ...snapshot() }, null, 2);
  },

  // Vorab prüfen, was in einer Sicherungsdatei steckt, ohne etwas zu
  // ändern. Wirft einen Fehler, wenn die Datei nicht passt.
  // Ergebnis: { exportedAt, workoutCount, exerciseCount }
  inspectBackup(text) {
    const data = parseBackup(text);
    return {
      exportedAt: data.exportedAt || data.savedAt,
      workoutCount: data.workouts.length,
      exerciseCount: data.exercises.length,
    };
  },

  // Sicherung einspielen: ersetzt ALLE aktuellen Daten. Die bisherigen
  // Daten werden vorher noch einmal intern beiseitegelegt.
  importData(text) {
    const data = parseBackup(text);
    try {
      localStorage.setItem(STORAGE_KEY + "-vor-import", JSON.stringify(snapshot()));
    } catch (error) {
      // Kein Platz für die Kopie: Import trotzdem durchführen
    }
    applyData(data);
    save();
  },

  // Nach einer erfolgreichen Sicherung aufrufen
  markBackupDone() {
    settings.lastBackupAt = new Date().toISOString();
    delete settings.backupSnoozedUntil;
    save();
  },

  // Erinnerung für einen Tag pausieren ("Später")
  snoozeBackupReminder() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    settings.backupSnoozedUntil = tomorrow.toISOString();
    save();
  },

  // Stand der Sicherung: wann zuletzt gesichert, wie viele Trainings seitdem
  // neu sind und ob eine Erinnerung fällig ist (5 neue Trainings, oder das
  // älteste ungesicherte Training ist über eine Woche her).
  getBackupStatus() {
    const last = settings.lastBackupAt || null;
    const unsaved = workouts.filter((w) => !last || w.date > last);
    const oldest = unsaved.length > 0 ? new Date(Math.min(...unsaved.map((w) => new Date(w.date)))) : null;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const snoozed = settings.backupSnoozedUntil && new Date(settings.backupSnoozedUntil) > new Date();
    const due = !snoozed && (unsaved.length >= 5 || (oldest !== null && oldest < weekAgo));
    return { lastBackupAt: last, unsavedCount: unsaved.length, due: due };
  },

  // ----- Urlaubsmodus -----

  // Läuft gerade ein Urlaub?
  isVacationActive() {
    return settings.vacations.some((v) => v.to === null);
  },

  // Seit wann der aktuelle Urlaub läuft (Text wie "2026-10-05") oder null
  getVacationStart() {
    const running = settings.vacations.find((v) => v.to === null);
    return running ? running.from : null;
  },

  // Alle Urlaubszeiten (für die Streak-Berechnung)
  getVacations() {
    return structuredClone(settings.vacations);
  },

  // Urlaubsmodus ein- oder ausschalten. Beim Einschalten beginnt ein neuer
  // Urlaub heute, beim Ausschalten endet der laufende heute.
  setVacationActive(active) {
    const today = dayKeyOf(new Date());
    if (active && !Store.isVacationActive()) {
      settings.vacations.push({ from: today, to: null });
    } else if (!active) {
      settings.vacations.forEach((v) => {
        if (v.to === null) v.to = today;
      });
      // Am selben Tag an- und wieder ausgeschaltet? Dann war es wohl ein
      // Versehen: diesen "Urlaub" ganz entfernen
      settings.vacations = settings.vacations.filter((v) => !(v.from === today && v.to === today));
    }
    save();
  },

  // ----- Trainings -----

  // Datum des letzten Trainings einer Einheit (als Date) oder null
  getLastWorkoutDate(unitId) {
    const dates = workouts.filter((w) => w.unitId === unitId).map((w) => new Date(w.date));
    if (dates.length === 0) return null;
    // Math.max liefert die größte Zahl, also den spätesten Zeitpunkt
    return new Date(Math.max(...dates));
  },

  // Alle beendeten Trainings (für die Statistiken auf der Startseite)
  getWorkouts() {
    return structuredClone(workouts);
  },

  // Verlauf einer Übung: alle Trainings, in denen sie abgehakt war und
  // Sätze mit Wiederholungen hatte, ältestes zuerst.
  // Ergebnis: [{ date: "2026-10-05T...", sets: [{ weight, reps }, ...] }, ...]
  getExerciseHistory(exerciseId) {
    const history = [];
    workouts.forEach((workout) => {
      const entry = workout.exercises.find((ex) => ex.exerciseId === exerciseId);
      if (entry && entry.done && !entry.skipped && entry.sets.length > 0) {
        history.push({ date: workout.date, sets: entry.sets });
      }
    });
    history.sort((a, b) => a.date.localeCompare(b.date));
    return structuredClone(history);
  },

  // Das laufende Training als Kopie (oder null), z.B. für "Heute bewegt"
  getCurrentWorkout() {
    return currentWorkout ? structuredClone(currentWorkout) : null;
  },

  // Die Einheit, deren Training gerade läuft (heute), sonst null
  // Gilt erst als "laufend", wenn schon etwas passiert ist (Wiederholungen
  // eingetragen, abgehakt oder übersprungen). Nur Reinschauen zählt nicht.
  getRunningUnitId() {
    if (!currentWorkout || !isToday(currentWorkout.startedAt)) return null;
    const active = Object.values(currentWorkout.exercises).some(
      (e) => e.done || e.skipped || e.sets.some((set) => set.reps !== null)
    );
    return active ? currentWorkout.unitId : null;
  },

  // ----- Laufendes Training -----

  // Training für eine Einheit beginnen bzw. das laufende weiterführen.
  // Ein neues Training beginnt, wenn noch keins läuft, wenn das laufende zu
  // einer anderen Einheit gehört oder wenn es von einem früheren Tag ist.
  // Das alte wird dabei automatisch gespeichert, damit nichts verloren geht.
  startWorkout(planId, unitId) {
    if (currentWorkout && currentWorkout.unitId === unitId && isToday(currentWorkout.startedAt)) return;
    if (currentWorkout) Store.finishWorkout(true);
    const now = new Date().toISOString(); // Zeitpunkt als Text, z.B. "2026-10-05T18:30:00.000Z"
    currentWorkout = {
      id: createId(),
      planId: planId,
      unitId: unitId,
      startedAt: now,
      lastActivityAt: now, // Zeitpunkt der letzten Eingabe
      exercises: {},
    };
    save();
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
    touchWorkout();
    save();
  },

  // Satz hinzufügen. Er übernimmt Gewicht und Wiederholungen vom letzten Satz.
  addSet(exerciseId) {
    const entry = workoutEntry(exerciseId);
    if (!entry) return;
    const last = entry.sets[entry.sets.length - 1];
    // { ...last } erstellt eine Kopie des letzten Satzes
    entry.sets.push(last ? { ...last } : { weight: null, reps: null });
    rememberSetCount(exerciseId, entry.sets.length);
    touchWorkout();
    save();
  },

  // Ist die Übung im laufenden Training abgehakt bzw. übersprungen?
  isExerciseDone(exerciseId) {
    const entry = currentWorkout && currentWorkout.exercises[exerciseId];
    return Boolean(entry && entry.done);
  },

  isExerciseSkipped(exerciseId) {
    const entry = currentWorkout && currentWorkout.exercises[exerciseId];
    return Boolean(entry && entry.skipped);
  },

  // Haken setzen bzw. wieder entfernen. Abhaken hebt "übersprungen" auf.
  toggleExerciseDone(exerciseId) {
    const entry = workoutEntry(exerciseId);
    if (!entry) return;
    entry.done = !entry.done;
    if (entry.done) entry.skipped = false;
    touchWorkout();
    save();
  },

  // Übung für dieses Training überspringen bzw. zurückholen
  toggleExerciseSkipped(exerciseId) {
    const entry = workoutEntry(exerciseId);
    if (!entry) return;
    entry.skipped = !entry.skipped;
    if (entry.skipped) entry.done = false;
    touchWorkout();
    save();
  },

  // Was wurde bei dieser Übung zuletzt gemacht? Sucht im Verlauf das neueste
  // Training, in dem die Übung ABGEHAKT war. Übersprungene oder nur
  // angefangene Übungen zählen nicht.
  // Ergebnis: { date: "2026-10-05T...", sets: [{ weight, reps }, ...] } oder null
  getLastPerformance(exerciseId) {
    // Neueste zuerst: Kopie der Liste nach Datum absteigend sortieren
    const newestFirst = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
    for (const workout of newestFirst) {
      const entry = workout.exercises.find((ex) => ex.exerciseId === exerciseId);
      if (entry && entry.done && !entry.skipped && entry.sets.length > 0) {
        return structuredClone({ date: workout.date, sets: entry.sets });
      }
    }
    return null;
  },

  // Training beenden: Es wandert in die Liste der absolvierten Trainings.
  // Gespeichert werden abgehakte und übersprungene Übungen sowie solche,
  // bei denen Wiederholungen eingetragen wurden. Übersprungene Übungen
  // werden OHNE Sätze gespeichert, damit sie im Verlauf nichts verfälschen.
  // Hinweis: Der Verlauf ist ab Schritt 7 dauerhaft gespeichert; ein
  // abgehakter Satz gilt als "letztes Mal", sobald das Training gespeichert
  // ist (durch "Training beenden" oder automatisch, siehe startWorkout).
  //
  // auto = true: Das Training wird automatisch gespeichert (andere Einheit
  // oder neuer Tag). Als Ende zählt dann die letzte Eingabe, nicht "jetzt".
  // Sonst bekäme ein Training von gestern das Datum von heute und eine
  // Dauer von 20 Stunden.
  finishWorkout(auto = false) {
    if (!currentWorkout) return;
    const endedAt = auto ? currentWorkout.lastActivityAt || currentWorkout.startedAt : new Date().toISOString();
    const minutes = Math.round((new Date(endedAt) - new Date(currentWorkout.startedAt)) / 60000);
    const finished = {
      id: currentWorkout.id,
      planId: currentWorkout.planId,
      unitId: currentWorkout.unitId,
      startedAt: currentWorkout.startedAt,
      date: endedAt, // Zeitpunkt des Endes
      durationMinutes: minutes,
      exercises: [],
    };
    // Object.entries macht aus { id: eintrag, ... } eine Liste von [id, eintrag]
    Object.entries(currentWorkout.exercises).forEach(([exerciseId, entry]) => {
      const hasReps = entry.sets.some((set) => set.reps !== null);
      if (!entry.done && !entry.skipped && !hasReps) return; // Übung nicht angefasst
      finished.exercises.push({
        exerciseId: exerciseId,
        // Nur Sätze mit Wiederholungen zählen. Ein Gewicht allein ist bloß
        // die Vorbelegung vom letzten Mal, kein gemachter Satz.
        sets: entry.skipped ? [] : entry.sets.filter((set) => set.reps !== null),
        done: Boolean(entry.done),
        skipped: Boolean(entry.skipped),
        restSeconds: Store.getRestSeconds(exerciseId),
      });
    });
    // Ein Training, in dem gar nichts gemacht wurde, wird nicht gespeichert
    if (finished.exercises.length > 0) {
      workouts.push(finished);
    }
    currentWorkout = null;
    save();
  },

  // Letzten Satz entfernen (mindestens einer bleibt)
  removeSet(exerciseId) {
    const entry = workoutEntry(exerciseId);
    if (!entry || entry.sets.length <= 1) return;
    entry.sets.pop(); // pop() entfernt das letzte Element
    rememberSetCount(exerciseId, entry.sets.length);
    touchWorkout();
    save();
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
    save();
  },

  // Übung aus der Einheit entfernen (im Pool bleibt sie erhalten)
  removeExerciseFromUnit(planId, unitId, exerciseId) {
    const unit = findUnit(planId, unitId);
    if (!unit) return;
    unit.exerciseIds = unit.exerciseIds.filter((id) => id !== exerciseId);
    save();
  },

  // Neue Reihenfolge der Übungen einer Einheit übernehmen (nach Drag and Drop)
  setUnitExerciseOrder(planId, unitId, orderedIds) {
    const unit = findUnit(planId, unitId);
    if (!unit) return;
    // Sicherheitshalber nur ids übernehmen, die wirklich zur Einheit gehören
    unit.exerciseIds = orderedIds.filter((id) => unit.exerciseIds.includes(id));
    save();
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
// mit der passenden Satzanzahl angelegt (siehe unten). Die GEWICHTE kommen
// vom letzten Mal, die Wiederholungen bleiben leer (die App zeigt die alten
// nur als Hinweis an).
function workoutEntry(exerciseId) {
  if (!currentWorkout) return null;
  if (!currentWorkout.exercises[exerciseId]) {
    const exercise = exercises.find((ex) => ex.id === exerciseId);
    const last = Store.getLastPerformance(exerciseId);
    // Satzanzahl: bewusst eingestellt (+/− Satz) > wie letztes Mal > Standard 2
    const count =
      exercise && exercise.setCount ? exercise.setCount : last ? last.sets.length : DEFAULT_SET_COUNT;
    // Array.from({ length: 2 }, ...) erzeugt eine Liste mit 2 Einträgen
    const sets = Array.from({ length: count }, (_, i) => {
      // Gab es letztes Mal weniger Sätze, nehmen wir das Gewicht des letzten
      const lastSet = last ? last.sets[Math.min(i, last.sets.length - 1)] : null;
      return { weight: lastSet ? lastSet.weight : null, reps: null };
    });
    currentWorkout.exercises[exerciseId] = { sets: sets, done: false, skipped: false };
  }
  return currentWorkout.exercises[exerciseId];
}

// Kennung einer Woche: das Datum ihres Montags als Text, z.B. "2026-10-05".
// Text lässt sich leicht vergleichen und sortieren ("2026-09-28" < "2026-10-05").
function weekKeyOf(date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  // getDay(): Sonntag = 0, Montag = 1 ... Wir rechnen auf "Montag = 0" um.
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dayKeyOf(monday);
}

// Ein Tag als Text, z.B. "2026-10-05" (in Ortszeit, nicht in UTC)
function dayKeyOf(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Merkt sich den Zeitpunkt der letzten Eingabe im laufenden Training
function touchWorkout() {
  if (currentWorkout) currentWorkout.lastActivityAt = new Date().toISOString();
}

// Liegt ein Zeitpunkt (als Text) am heutigen Kalendertag?
function isToday(isoText) {
  return new Date(isoText).toDateString() === new Date().toDateString();
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
