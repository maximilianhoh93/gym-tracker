// ===== Fortschritt: Steigerungsvorschlag und Rekorde =====
// Diese Datei rechnet nur, sie zeichnet nichts. Sie liest die Daten über
// "Store" (storage.js). Es zählen immer nur Arbeitssätze, nie Aufwärmsätze
// (Store.getExerciseHistory liefert bereits nur Arbeitssätze).
//
// Steigerung nach der "doppelten Progression" (siehe CLAUDE.md):
// 1. Jede Übung hat einen Wiederholungsbereich, Standard 6–10.
// 2. Bei gleichem Gewicht von Training zu Training Wiederholungen dazugewinnen.
// 3. Erst wenn ALLE Arbeitssätze das obere Ende erreichen, kommt Gewicht
//    dazu, und man beginnt wieder am unteren Ende.

// Höchstes Gewicht in einer Liste von Sätzen (oder null ohne Gewicht)
function topWeight(sets) {
  const weights = sets.map((set) => set.weight).filter((w) => w !== null);
  return weights.length > 0 ? Math.max(...weights) : null;
}

// Auf eine sinnvolle Stufe runden, z.B. 92,25 -> 92,5 bei Stufe 2,5
function roundTo(value, step) {
  return Math.round(value / step) * step;
}

// Vorschlag für das nächste Training einer Übung, aus dem letzten Training.
// Ergebnis (oder null, wenn es noch kein letztes Training gibt):
// - { type: "increase", weight, increment, targets }  -> mehr Gewicht
// - { type: "reps",     weight, targets }             -> 1 Wdh. mehr
// - { type: "decrease", weight, targets }             -> Gewicht reduzieren
// - { type: "bodyweight-top", targets }               -> ohne Gewicht am oberen Ende
// "targets" = Ziel-Wiederholungen pro Arbeitssatz
function progressionAdvice(exerciseId) {
  const settings = Store.getExerciseSettings(exerciseId);
  const history = Store.getExerciseHistory(exerciseId);
  if (history.length === 0) return null;

  const last = history[history.length - 1].sets;
  const weight = topWeight(last);
  const oneMore = last.map((set) => Math.min(settings.repMax, set.reps + 1));
  const allAtTop = last.every((set) => set.reps >= settings.repMax);

  // Übungen ohne Gewicht (z.B. Klimmzüge): nur Wiederholungen steigern
  if (weight === null) {
    if (allAtTop) return { type: "bodyweight-top", targets: last.map(() => settings.repMax) };
    return { type: "reps", weight: null, targets: oneMore };
  }

  // Alle Sätze am oberen Ende: Gewicht erhöhen, Ziel wieder unteres Ende
  if (allAtTop) {
    return {
      type: "increase",
      weight: weight + settings.increment,
      increment: settings.increment,
      targets: last.map(() => settings.repMin),
    };
  }

  // Zweimal hintereinander schon der erste (stärkste) Satz unter dem
  // Bereich: Das Gewicht ist wohl zu schwer. Etwa 10 % weniger vorschlagen.
  const below = (sets) => sets[0].reps < settings.repMin;
  const previous = history.length >= 2 ? history[history.length - 2].sets : null;
  if (previous && below(last) && below(previous)) {
    // In den Schritten der Übung runden (z.B. 5 kg an Maschinen mit 5er-Platten)
    const lighter = Math.max(settings.increment, roundTo(weight * 0.9, settings.increment));
    return { type: "decrease", weight: lighter, targets: last.map(() => settings.repMin) };
  }

  // Sonst: gleiches Gewicht, in jedem Satz 1 Wiederholung mehr
  return { type: "reps", weight: weight, targets: oneMore };
}

// Ist Satz a besser als Satz b? Mehr Gewicht schlägt alles; bei gleichem
// Gewicht zählen mehr Wiederholungen. Ohne Gewicht zählen nur Wiederholungen.
function isBetterSet(a, b) {
  const wa = a.weight || 0;
  const wb = b.weight || 0;
  if (wa !== wb) return wa > wb;
  return a.reps > b.reps;
}

// Bester Satz einer Liste (oder null)
function bestSet(sets) {
  const valid = sets.filter((set) => set.reps !== null && set.reps > 0);
  if (valid.length === 0) return null;
  return valid.reduce((best, set) => (isBetterSet(set, best) ? set : best));
}

// Rekord einer Übung aus allen gespeicherten Trainings:
// { weight, reps, date } oder null, wenn es noch keinen gibt
function exerciseRecord(exerciseId) {
  let record = null;
  Store.getExerciseHistory(exerciseId).forEach((session) => {
    const best = bestSet(session.sets);
    if (best && (!record || isBetterSet(best, record))) {
      record = { weight: best.weight, reps: best.reps, date: session.date };
    }
  });
  return record;
}

// Ist in diesen Sätzen (z.B. vom laufenden Training) ein neuer Rekord?
// Beim allerersten Training einer Übung gibt es noch nichts zu schlagen.
function isNewRecord(exerciseId, sets) {
  const record = exerciseRecord(exerciseId);
  const best = bestSet(workingSets(sets));
  return Boolean(record && best && isBetterSet(best, record));
}

// Wurde in diesem (vergangenen) Training bei der Übung ein Rekord
// aufgestellt? Verglichen wird mit allen Trainings DAVOR.
function wasRecordInWorkout(exerciseId, workout) {
  const entry = workout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!entry || !entry.done || entry.skipped) return false;
  const best = bestSet(workingSets(entry.sets));
  if (!best) return false;
  let before = null;
  Store.getExerciseHistory(exerciseId)
    .filter((session) => session.date < workout.date)
    .forEach((session) => {
      const b = bestSet(session.sets);
      if (b && (!before || isBetterSet(b, before))) before = b;
    });
  return Boolean(before && isBetterSet(best, before));
}
