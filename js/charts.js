// ===== Diagramme und Statistiken =====
// Diese Datei berechnet Kennzahlen aus den gespeicherten Trainings und
// zeichnet Diagramme. Sie liest Daten nur über "Store" (storage.js).
//
// Die Diagramme zeichnen wir selbst als SVG: eine Grafik, die in Textform
// beschrieben wird (Linien, Kreise, Rechtecke mit Koordinaten) und die der
// Browser direkt anzeigt. Für eine Linie und ein paar Balken ist das
// einfacher und leichter als eine ganze Diagramm-Bibliothek.
//
// Regeln für gute Diagramme, an die wir uns halten:
// - Immer nur EINE y-Achse. Gewicht und Volumen haben ganz verschiedene
//   Größenordnungen, deshalb zeigen wir sie abwechselnd (Umschalter).
// - Dünne Linien, dezente Hilfslinien, Werte nur selektiv direkt am
//   Diagramm (der letzte), der Rest per Antippen.
// - Zu jedem Diagramm gibt es dieselben Werte auch als Liste.

// ===== Berechnungen =====

// Höchstes Gewicht eines Trainings, oder null bei Übungen ohne Gewicht
function sessionWeight(sets) {
  const weights = sets.map((set) => set.weight).filter((w) => w !== null);
  return weights.length > 0 ? Math.max(...weights) : null;
}

// Volumen eines Trainings: Summe aus Gewicht × Wiederholungen.
// Hat kein einziger Satz ein Gewicht (z.B. Klimmzüge), zählen die
// Wiederholungen. reduce() addiert alle Einträge einer Liste auf.
function sessionVolume(sets) {
  if (sets.every((set) => set.weight === null)) {
    return sets.reduce((sum, set) => sum + set.reps, 0);
  }
  return sets.reduce((sum, set) => sum + (set.weight || 0) * set.reps, 0);
}

// Montag 0:00 Uhr der aktuellen Woche
function startOfWeek() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  // getDay(): Sonntag = 0, Montag = 1 ... Wir rechnen auf "Montag = 0" um.
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date;
}

// Zahl mit Tausenderpunkt und Komma, z.B. 1080 -> "1.080", 62.5 -> "62,5"
function formatGerman(number) {
  return number.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

// Datum kurz, z.B. "05.10."
function shortDate(isoText) {
  return new Date(isoText).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

// ===== Widgets der Startseite =====

// Heute bewegtes Gewicht: Summe aus Gewicht × Wiederholungen aller Sätze
// von abgehakten Übungen, aus dem laufenden Training und aus heute
// beendeten Trainings. Übungen ohne Gewicht (z.B. Klimmzüge) zählen nicht.
function renderTodayWidget(workouts) {
  const today = new Date().toDateString();
  // Alle heute abgehakten Übungen sammeln: [{ exerciseId, sets }]
  const entries = [];
  workouts
    .filter((w) => new Date(w.date).toDateString() === today)
    .forEach((w) => w.exercises.forEach((e) => e.done && !e.skipped && entries.push(e)));
  const current = Store.getCurrentWorkout();
  if (current && new Date(current.startedAt).toDateString() === today) {
    Object.entries(current.exercises).forEach(([exerciseId, e]) => {
      // Nur Sätze mit Wiederholungen; ein Gewicht allein ist nur vorbelegt
      if (e.done && !e.skipped) entries.push({ exerciseId, sets: e.sets.filter((s) => s.reps !== null) });
    });
  }

  const total = entries.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => s + (set.weight || 0) * set.reps, 0),
    0
  );
  const setCount = entries.reduce((sum, e) => sum + e.sets.length, 0);

  if (entries.length === 0) {
    return `
      <div class="widget-title">Heute bewegt</div>
      <p class="widget-empty">Noch keine Übung abgehakt. Sobald du heute eine Übung abhakst, siehst du hier, wie viel Gewicht du insgesamt bewegt hast.</p>
    `;
  }

  // Zum Vergleich: das Volumen des letzten Trainings vor heute
  const before = workouts
    .filter((w) => new Date(w.date).toDateString() !== today)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const beforeTotal = before
    ? before.exercises
        .filter((e) => e.done && !e.skipped)
        .reduce((sum, e) => sum + e.sets.reduce((s, set) => s + (set.weight || 0) * set.reps, 0), 0)
    : null;

  return `
    <div class="widget-title">Heute bewegt</div>
    <div class="hero-row">
      <span class="hero-number">${formatGerman(total)}</span>
      <span class="hero-unit">kg</span>
    </div>
    <div class="widget-subtitle">${entries.length} ${entries.length === 1 ? "Übung" : "Übungen"} · ${setCount} ${setCount === 1 ? "Satz" : "Sätze"} · Gewicht × Wiederholungen</div>
    ${beforeTotal ? `<div class="widget-footnote">Letztes Training: ${formatGerman(beforeTotal)} kg</div>` : ""}
  `;
}

// ===== Wochen-Streak =====
// Wie bei Duolingo: Wer sein Wochenziel (Trainingstage pro Woche) schafft,
// verlängert seine Streak. Eine verpasste Woche beendet sie.
// - "gold": Ziel erreicht
// - "ice":  Woche vorbei, Ziel verpasst (eisblau)
// - "open": laufende Woche, Ziel noch nicht erreicht (zählt noch nicht)
// - "start": die Woche des allerersten Trainings, Ziel nicht erreicht.
//   Wer mitten in der Woche anfängt, soll dafür nicht bestraft werden.
// Wochen vor dem allerersten Training zählen gar nicht.

// Alle Trainingstage als Text ("2026-10-05"). Ein Tag zählt, wenn dort
// mindestens eine Übung abgehakt wurde. Mehrere Trainings am selben Tag
// zählen als ein Tag. Das laufende Training zählt schon mit.
function trainingDayKeys() {
  const days = new Set();
  Store.getWorkouts().forEach((w) => {
    if (w.exercises.some((e) => e.done && !e.skipped)) days.add(dayKeyOf(w.date));
  });
  const current = Store.getCurrentWorkout();
  if (current && Object.values(current.exercises).some((e) => e.done && !e.skipped)) {
    days.add(dayKeyOf(current.startedAt));
  }
  return days;
}

// Status jeder Woche vom ersten Training bis heute.
// Ergebnis: Map von Wochen-Kennung -> { count, goal, status }
// (Eine Map ist wie ein Nachschlagewerk: zu jedem Schlüssel ein Wert.)
function weekStatuses(days = trainingDayKeys()) {
  const weeks = new Map();
  if (days.size === 0 || Store.getWeeklyGoal() === null) return weeks;

  // Trainingstage pro Woche zählen
  const counts = new Map();
  days.forEach((day) => {
    const key = weekKeyOf(new Date(day + "T12:00"));
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  // Von der Woche des ersten Trainings bis zur aktuellen Woche
  const currentKey = weekKeyOf(new Date());
  const firstDay = [...days].sort()[0];
  const firstKey = weekKeyOf(new Date(firstDay + "T12:00"));
  const monday = new Date(firstKey + "T12:00");
  while (dayKeyOf(monday) <= currentKey) {
    const key = dayKeyOf(monday);
    const count = counts.get(key) || 0;
    const goal = Store.getWeeklyGoal(key);
    let status = "ice";
    if (count >= goal) status = "gold";
    else if (key === currentKey) status = "open";
    else if (key === firstKey) status = "start";
    weeks.set(key, { count, goal, status });
    monday.setDate(monday.getDate() + 7);
  }
  return weeks;
}

// Aktuelle und längste Streak, Anzahl goldener Wochen
function streakInfo(weeks = weekStatuses()) {
  const list = [...weeks.values()];
  // Aktuelle Streak: von hinten zählen. Die laufende Woche bricht nichts,
  // solange sie noch "open" ist.
  let current = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].status === "gold") current++;
    else if (list[i].status === "open") continue;
    else break; // "ice" beendet die Streak, "start" ist ihr Anfang
  }
  // Längste Streak: längste Folge goldener Wochen
  let longest = 0;
  let run = 0;
  list.forEach((w) => {
    run = w.status === "gold" ? run + 1 : w.status === "ice" ? 0 : run;
    longest = Math.max(longest, run);
  });
  const goldWeeks = list.filter((w) => w.status === "gold").length;
  return { current, longest, goldWeeks };
}

// Kalenderwoche nach ISO (Montag als Wochenbeginn), z.B. 41
function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; // Sonntag = 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Donnerstag derselben Woche
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Flamme als kleine SVG-Grafik. "lit" = brennt (orange-gold), sonst grau.
function flameIcon(lit) {
  return `
    <svg class="flame ${lit ? "lit" : ""}" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="flame-gradient" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#ff9600"/>
          <stop offset="1" stop-color="#ffc800"/>
        </linearGradient>
      </defs>
      <path d="M12 2.5c.6 3.2 4.8 5.3 4.8 10.6A4.9 4.9 0 0 1 12 18a4.9 4.9 0 0 1-4.8-4.9c0-2.4 1.3-3.6 2-5 .3 1.6 1.2 2.3 1.9 2.4-.4-3.2.3-5.8.9-8z"/>
      <path class="flame-core" d="M12 11.5c.4 1.3 2.2 2.1 2.2 3.9A2.2 2.2 0 0 1 12 17.6a2.2 2.2 0 0 1-2.2-2.2c0-1.4 1.6-2.4 2.2-3.9z"/>
    </svg>`;
}

// Widget "Wochen-Streak" (das erste auf der Startseite)
function renderStreakWidget() {
  const goal = Store.getWeeklyGoal();

  // Noch kein Ziel: direkt hier fragen
  if (goal === null) {
    return `
      <div class="widget-title">Wochen-Streak</div>
      <p class="widget-subtitle">Wie oft möchtest du pro Woche trainieren?</p>
      <div class="goal-picker">
        ${[2, 3, 4, 5, 6]
          .map((n) => `<button class="goal-option" data-action="set-goal" data-goal="${n}">${n}×</button>`)
          .join("")}
      </div>
      <div class="widget-footnote">Schaffst du dein Ziel, wächst deine Streak jede Woche um eins.</div>
    `;
  }

  const weeks = weekStatuses();
  const info = streakInfo(weeks);
  const thisWeek = weeks.get(weekKeyOf(new Date())) || { count: 0, goal, status: "open" };
  const percent = Math.min(100, (thisWeek.count / thisWeek.goal) * 100);
  const reached = thisWeek.count >= thisWeek.goal;

  // Die letzten 6 Wochen als kleine Kacheln mit Kalenderwoche
  const pills = [];
  const monday = new Date(weekKeyOf(new Date()) + "T12:00");
  monday.setDate(monday.getDate() - 35);
  for (let i = 0; i < 6; i++) {
    const week = weeks.get(dayKeyOf(monday));
    const status = week ? week.status : "none";
    const labels = { gold: "Ziel erreicht", ice: "verpasst", open: "läuft", start: "erste Woche", none: "kein Training" };
    pills.push(
      `<span class="week-pill ${status}" title="KW ${isoWeekNumber(monday)}: ${labels[status]}">${isoWeekNumber(monday)}</span>`
    );
    monday.setDate(monday.getDate() + 7);
  }

  return `
    <div class="widget-title">Wochen-Streak</div>
    <div class="streak-head">
      ${flameIcon(info.current > 0 || reached)}
      <span class="hero-number">${info.current}</span>
      <span class="hero-unit">${info.current === 1 ? "Woche" : "Wochen"} in Folge</span>
    </div>
    <div class="streak-label">
      <span>${reached ? "Wochenziel erreicht!" : "Diese Woche"}</span>
      <span><strong>${thisWeek.count}</strong> von ${thisWeek.goal} Tagen</span>
    </div>
    <div class="streak-bar" role="progressbar" aria-valuenow="${thisWeek.count}" aria-valuemin="0" aria-valuemax="${thisWeek.goal}">
      <span class="streak-fill ${reached ? "full" : ""}" style="width: ${percent}%"></span>
    </div>
    <div class="week-pills" aria-label="Letzte 6 Wochen">${pills.join("")}</div>
  `;
}

// Ein Monatskalender: 7 Spalten (Mo–So). Jeder Tag bekommt die Farbe
// seiner Woche: gold (Ziel erreicht) oder eisblau (verpasst). Trainingstage
// sind kräftig gefärbt, die übrigen Tage der Woche nur zart.
function renderCalendar(year, month, days, weeks, size = "small") {
  const todayKey = dayKeyOf(new Date());
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // Tag 0 des Folgemonats = letzter Tag
  // Leere Felder vor dem 1., damit die Tage unter dem richtigen Wochentag stehen
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  let cells = "";
  for (let i = 0; i < offset; i++) cells += `<span class="cal-day empty"></span>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day, 12);
    const key = dayKeyOf(date);
    const week = weeks.get(weekKeyOf(date));
    const classes = ["cal-day"];
    if (week && (week.status === "gold" || week.status === "ice")) classes.push(week.status);
    if (days.has(key)) classes.push("trained");
    if (key === todayKey) classes.push("today");
    if (key > todayKey) classes.push("future");
    const label = size === "large" ? `<span class="cal-number">${day}</span>` : "";
    cells += `<span class="${classes.join(" ")}" title="${day}.">${label}</span>`;
  }
  return `<div class="calendar ${size}">${cells}</div>`;
}

// Kurze Auswertung eines Monats: Trainingstage und Wochen mit erreichtem Ziel.
// Eine Woche zählt zu dem Monat, in dem ihr Montag liegt.
function monthSummary(year, month, days, weeks) {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const trainingDays = [...days].filter((d) => d.startsWith(prefix)).length;
  const monthWeeks = [...weeks.entries()].filter(([key]) => key.startsWith(prefix));
  const gold = monthWeeks.filter(([, w]) => w.status === "gold").length;
  // Entschiedene Wochen: gold oder verpasst (laufende und Startwoche nicht)
  const decided = monthWeeks.filter(([, w]) => w.status === "gold" || w.status === "ice").length;
  return { trainingDays, gold, decided };
}

// Trainingstage in diesem Monat, mit Kalender in Streak-Farben
function renderMonthWidget() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = trainingDayKeys();
  const weeks = weekStatuses(days);
  const summary = monthSummary(year, month, days, weeks);
  // Vormonat: new Date(year, month - 1) rechnet Januar -> Dezember selbst richtig
  const prev = new Date(year, month - 1, 1);
  const prevSummary = monthSummary(prev.getFullYear(), prev.getMonth(), days, weeks);
  const monthName = now.toLocaleDateString("de-DE", { month: "long" });

  // Links die Zahl, rechts der Kalender
  return `
    <div class="widget-title">Diesen Monat</div>
    <div class="month-layout">
      <div>
        <div class="hero-row">
          <span class="hero-number">${summary.trainingDays}</span>
        </div>
        <div class="widget-subtitle">${summary.trainingDays === 1 ? "Trainingstag" : "Trainingstage"} im ${monthName}</div>
        ${summary.decided > 0 ? `<div class="widget-footnote">Ziel in ${summary.gold} von ${summary.decided} Wochen erreicht</div>` : ""}
        <div class="widget-footnote">Vormonat: ${prevSummary.trainingDays}</div>
      </div>
      ${renderCalendar(year, month, days, weeks)}
    </div>
  `;
}

// Sätze pro Muskelgruppe in dieser Woche (Montag bis heute)
function renderVolumeWidget(workouts) {
  const weekStart = startOfWeek();
  const counts = {}; // z.B. { brust: 8, trizeps: 4 }
  workouts
    .filter((w) => new Date(w.date) >= weekStart)
    .forEach((w) => {
      w.exercises.forEach((entry) => {
        if (!entry.done || entry.skipped) return;
        const exercise = Store.getExercise(entry.exerciseId);
        if (!exercise) return; // Übung wurde inzwischen gelöscht
        counts[exercise.muscleGroupId] = (counts[exercise.muscleGroupId] || 0) + entry.sets.length;
      });
    });

  // In der festen Reihenfolge der Muskelgruppen, nur die mit Sätzen
  const rows = Store.getMuscleGroups().filter((g) => counts[g.id] > 0);
  if (rows.length === 0) {
    return `
      <div class="widget-title">Volumen diese Woche</div>
      <p class="widget-empty">Noch kein Training diese Woche. Nach dem ersten Training siehst du hier deine Sätze pro Muskelgruppe.</p>
    `;
  }
  const max = Math.max(...rows.map((g) => counts[g.id]));
  const total = rows.reduce((sum, g) => sum + counts[g.id], 0);

  // Ein Balken pro Muskelgruppe. Alle in derselben Farbe: Die Länge zeigt
  // die Menge, die Farbe hat keine zusätzliche Bedeutung.
  const bars = rows
    .map(
      (g) => `
        <div class="hbar-row">
          <span class="hbar-label">${escapeHtml(g.name)}</span>
          <span class="hbar-track"><span class="hbar-fill" style="width: ${(counts[g.id] / max) * 100}%"></span></span>
          <span class="hbar-value">${counts[g.id]}</span>
        </div>`
    )
    .join("");

  return `
    <div class="widget-title">Volumen diese Woche</div>
    <div class="widget-subtitle">${total} Sätze, nach Muskelgruppe</div>
    <div class="hbars">${bars}</div>
  `;
}

// Durchschnittliche Trainingsdauer der letzten 10 Trainings
function renderDurationWidget(workouts) {
  // Nur plausible Dauern: unter 5 Minuten war es eher ein Versehen,
  // über 4 Stunden wurde wohl vergessen, das Training zu beenden
  const valid = workouts
    .filter((w) => typeof w.durationMinutes === "number" && w.durationMinutes >= 5 && w.durationMinutes <= 240)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  if (valid.length === 0) {
    return `
      <div class="widget-title">Ø Trainingsdauer</div>
      <p class="widget-empty">Beende ein Training mit „Training beenden“, dann siehst du hier, wie lange du im Schnitt trainierst.</p>
    `;
  }
  const average = Math.round(valid.reduce((sum, w) => sum + w.durationMinutes, 0) / valid.length);
  const last = valid[0].durationMinutes;
  return `
    <div class="widget-title">Ø Trainingsdauer</div>
    <div class="hero-row">
      <span class="hero-number">${average}</span>
      <span class="hero-unit">Minuten</span>
    </div>
    <div class="widget-subtitle">Durchschnitt aus ${valid.length} ${valid.length === 1 ? "Training" : "Trainings"}</div>
    <div class="widget-footnote">Letztes Training: ${last} min</div>
  `;
}

// Alle Widgets als wischbare Reihe ("Karussell") mit Punkten darunter
function renderWidgets() {
  const workouts = Store.getWorkouts();
  const widgets = [
    renderStreakWidget(),
    renderMonthWidget(),
    renderTodayWidget(workouts),
    renderVolumeWidget(workouts),
    renderDurationWidget(workouts),
  ];
  return `
    <div class="widget-carousel" aria-label="Statistiken, zum Wechseln wischen">
      ${widgets.map((html) => `<section class="widget">${html}</section>`).join("")}
    </div>
    <div class="carousel-dots">
      ${widgets
        .map((_, i) => `<button class="dot ${i === 0 ? "active" : ""}" data-index="${i}" aria-label="Widget ${i + 1}"></button>`)
        .join("")}
    </div>
  `;
}

// Punkte unter dem Karussell an die Wischposition anpassen.
// "scroll" meldet sich nicht über "Blubbern" nach oben, deshalb hören wir
// in der "capture"-Phase zu (drittes Argument true): Dann erfahren wir
// von jedem Scrollen auf der Seite und prüfen, ob es das Karussell war.
document.addEventListener(
  "scroll",
  (event) => {
    const carousel = event.target;
    if (!(carousel instanceof Element) || !carousel.matches(".widget-carousel")) return;
    const widgetWidth = carousel.firstElementChild.getBoundingClientRect().width;
    const index = Math.round(carousel.scrollLeft / widgetWidth);
    carousel.nextElementSibling.querySelectorAll(".dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  },
  true
);

// Klick auf einen Punkt springt zum passenden Widget (praktisch mit der Maus)
document.addEventListener("click", (event) => {
  const dot = event.target.closest(".carousel-dots .dot");
  if (!dot) return;
  const carousel = dot.parentElement.previousElementSibling;
  const widget = carousel.children[Number(dot.dataset.index)];
  // offsetLeft = Abstand des Widgets vom Anfang der Reihe; minus Innenabstand
  carousel.scrollTo({ left: widget.offsetLeft - carousel.firstElementChild.offsetLeft, behavior: "smooth" });
});

// ===== Verlauf einer Übung =====

// Werte für das Diagramm: [{ date, value }]
// metric "weight" = höchstes Gewicht, "volume" = Volumen
function historyPoints(history, metric) {
  return history
    .map((h) => ({ date: h.date, value: metric === "weight" ? sessionWeight(h.sets) : sessionVolume(h.sets) }))
    .filter((p) => p.value !== null);
}

// Ein "glatter" Abstand für Hilfslinien, sodass es etwa 2–4 Linien gibt:
// 1, 2, 2,5 oder 5 mal einer Zehnerpotenz (z.B. 5, 10, 25, 50, 250, 500).
function niceStep(range) {
  const raw = Math.max(range, 1) / 3;
  const power = 10 ** Math.floor(Math.log10(raw)); // 10er-Potenz, z.B. 10 bei raw = 37
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

// Diagramm als SVG. kind "line" (für Gewicht) oder "bars" (für Volumen).
// Gezeigt werden höchstens die letzten 12 Trainings, damit es lesbar bleibt.
function renderHistoryChart(points, kind, unit) {
  points = points.slice(-12);

  // Maße in "SVG-Einheiten". Das SVG wird auf die Bildschirmbreite skaliert.
  const width = 340;
  const height = 170;
  const pad = { top: 22, right: 14, bottom: 24, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // y-Bereich: bei Balken ab 0 (Länge muss ehrlich sein), bei der Linie
  // etwas Luft um den kleinsten und größten Wert. Danach auf "glatte"
  // Schritte runden, damit die Hilfslinien z.B. bei 50, 60, 70 liegen.
  const values = points.map((p) => p.value);
  let min = kind === "bars" ? 0 : Math.min(...values);
  let max = Math.max(...values);
  if (kind === "line") {
    const room = Math.max((max - min) * 0.15, max * 0.05, 1);
    min = Math.max(0, min - room);
    max = max + room;
  }
  const step = niceStep(max - min);
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  if (max === min) max = min + step;

  // Umrechnung Wert -> Position
  const x = (i) =>
    points.length === 1 ? pad.left + plotW / 2 : pad.left + (i / (points.length - 1)) * plotW;
  const y = (value) => pad.top + plotH - ((value - min) / (max - min)) * plotH;

  // Dezente Hilfslinien mit Beschriftung, eine pro Schritt
  let grid = "";
  for (let value = min; value <= max + step / 2; value += step) {
    const gy = y(value);
    grid += `<line class="grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${gy}" y2="${gy}"></line>
             <text class="axis-label" x="${pad.left - 6}" y="${gy + 4}" text-anchor="end">${formatGerman(value)}</text>`;
  }

  // x-Achse: erstes und letztes Datum
  const xLabels =
    `<text class="axis-label" x="${x(0)}" y="${height - 6}" text-anchor="${points.length === 1 ? "middle" : "start"}">${shortDate(points[0].date)}</text>` +
    (points.length > 1
      ? `<text class="axis-label" x="${x(points.length - 1)}" y="${height - 6}" text-anchor="end">${shortDate(points[points.length - 1].date)}</text>`
      : "");

  let marks = "";
  if (kind === "line") {
    // Eine Linie durch alle Punkte: "M x,y" = Stift ansetzen, "L x,y" = Linie ziehen
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
    marks += `<path class="chart-line" d="${path}"></path>`;
    marks += points.map((p, i) => `<circle class="chart-dot" cx="${x(i)}" cy="${y(p.value)}" r="4"></circle>`).join("");
  } else {
    // Balken: Breite abhängig von der Anzahl, mit Lücke dazwischen
    const slot = plotW / points.length;
    const barW = Math.min(28, slot - 4);
    marks += points
      .map((p, i) => {
        const cx = points.length === 1 ? pad.left + plotW / 2 : pad.left + slot * i + slot / 2;
        const top = y(p.value);
        const h = pad.top + plotH - top;
        // Oben abgerundet (rx), unten am Boden "verankert"
        return `<rect class="chart-bar" x="${cx - barW / 2}" y="${top}" width="${barW}" height="${Math.max(h, 1)}" rx="4"></rect>`;
      })
      .join("");
  }

  // Den letzten Wert direkt am Diagramm beschriften
  const lastIndex = points.length - 1;
  const lastX = kind === "line" || points.length === 1 ? x(lastIndex) : pad.left + (plotW / points.length) * (lastIndex + 0.5);
  const lastLabel = `<text class="value-label" x="${lastX}" y="${y(points[lastIndex].value) - 9}" text-anchor="${points.length > 1 ? "end" : "middle"}">${formatGerman(points[lastIndex].value)} ${unit}</text>`;

  // Die Werte stecken zusätzlich als data-Attribut am Diagramm, damit
  // beim Antippen der nächstgelegene Punkt angezeigt werden kann
  const data = points.map((p, i) => ({
    x: kind === "line" || points.length === 1 ? x(i) : pad.left + (plotW / points.length) * (i + 0.5),
    text: `${shortDate(p.date)}: ${formatGerman(p.value)} ${unit}`,
  }));

  return `
    <div class="chart" data-points='${JSON.stringify(data)}' data-width="${width}">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Verlauf, letzter Wert ${formatGerman(points[lastIndex].value)} ${unit}">
        ${grid}${marks}${xLabels}${lastLabel}
        <line class="crosshair" x1="0" x2="0" y1="${pad.top}" y2="${pad.top + plotH}" visibility="hidden"></line>
      </svg>
      <div class="chart-tooltip" hidden></div>
    </div>
  `;
}

// Antippen oder Darüberwischen zeigt den Wert des nächstgelegenen Punkts
function showChartTooltip(event) {
  const chart = event.target.closest(".chart");
  if (!chart) return;
  const points = JSON.parse(chart.dataset.points);
  const rect = chart.getBoundingClientRect();
  // Fingerposition in SVG-Einheiten umrechnen
  const svgX = ((event.clientX - rect.left) / rect.width) * Number(chart.dataset.width);
  // Den Punkt mit dem kleinsten Abstand suchen
  let nearest = points[0];
  points.forEach((p) => {
    if (Math.abs(p.x - svgX) < Math.abs(nearest.x - svgX)) nearest = p;
  });
  const crosshair = chart.querySelector(".crosshair");
  crosshair.setAttribute("x1", nearest.x);
  crosshair.setAttribute("x2", nearest.x);
  crosshair.setAttribute("visibility", "visible");
  const tooltip = chart.querySelector(".chart-tooltip");
  tooltip.textContent = nearest.text;
  tooltip.hidden = false;
  // Tooltip über dem Punkt, aber nicht über den Rand hinaus
  const left = (nearest.x / Number(chart.dataset.width)) * rect.width;
  tooltip.style.left = Math.min(Math.max(left, 60), rect.width - 60) + "px";
}

document.addEventListener("pointerdown", showChartTooltip);
document.addEventListener("pointermove", (event) => {
  // Nur bei gedrücktem Finger bzw. Maustaste mitziehen
  if (event.buttons > 0 || event.pointerType === "mouse") showChartTooltip(event);
});

// Tippen außerhalb eines Diagramms blendet den Tooltip wieder aus
document.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".chart")) return;
  document.querySelectorAll(".chart-tooltip").forEach((t) => (t.hidden = true));
  document.querySelectorAll(".crosshair").forEach((c) => c.setAttribute("visibility", "hidden"));
});

// Der ganze Verlaufsbereich einer Übung: Umschalter, Diagramm,
// Kennzahlen und die Liste der letzten Trainings
function renderExerciseHistory(exerciseId, metric) {
  const history = Store.getExerciseHistory(exerciseId);
  if (history.length === 0) {
    return `
      <h2 class="section-title">Verlauf</h2>
      <p class="placeholder">Noch kein Verlauf. Hake die Übung nach deinen Sätzen ab und beende das Training, dann erscheint hier deine Entwicklung.</p>
    `;
  }

  // Ohne Gewichte (z.B. Klimmzüge) gibt es nur das Volumen in Wiederholungen
  const bodyweight = history.every((h) => sessionWeight(h.sets) === null);
  if (bodyweight) metric = "volume";
  const volumeUnit = bodyweight ? "Wdh." : "kg";

  const points = historyPoints(history, metric);
  const chart =
    metric === "weight"
      ? renderHistoryChart(points, "line", "kg")
      : renderHistoryChart(points, "bars", volumeUnit);

  // Kennzahlen: bestes Gewicht bzw. Volumen und Veränderung seit Beginn
  const weights = historyPoints(history, "weight").map((p) => p.value);
  const volumes = historyPoints(history, "volume").map((p) => p.value);
  const change = (list) => {
    if (list.length < 2) return "–";
    const diff = list[list.length - 1] - list[0];
    return (diff > 0 ? "+" : diff < 0 ? "−" : "±") + formatGerman(Math.abs(diff));
  };
  const stats = bodyweight
    ? [
        ["Bestes Volumen", `${formatGerman(Math.max(...volumes))} Wdh.`],
        ["Seit Beginn", `${change(volumes)} Wdh.`],
        ["Trainings", history.length],
      ]
    : [
        ["Höchstes Gewicht", `${formatGerman(Math.max(...weights))} kg`],
        ["Seit Beginn", `${change(weights)} kg`],
        ["Trainings", history.length],
      ];

  // Die letzten 5 Trainings als Liste, neuestes zuerst (die "Tabelle" zum Diagramm)
  const rows = history
    .slice(-5)
    .reverse()
    .map(
      (h) => `
        <li class="history-row">
          <span class="history-date">${shortDate(h.date)}</span>
          <span class="history-sets">${formatSets(h.sets)}</span>
          <span class="history-volume">${formatGerman(sessionVolume(h.sets))} ${volumeUnit}</span>
        </li>`
    )
    .join("");

  // Umschalter nur, wenn es Gewichte gibt
  const toggle = bodyweight
    ? ""
    : `<div class="segmented" role="tablist">
         <button class="${metric === "weight" ? "selected" : ""}" data-action="history-metric" data-metric="weight"
           role="tab" aria-selected="${metric === "weight"}">Gewicht</button>
         <button class="${metric === "volume" ? "selected" : ""}" data-action="history-metric" data-metric="volume"
           role="tab" aria-selected="${metric === "volume"}">Volumen</button>
       </div>`;

  const caption =
    metric === "weight"
      ? "Höchstes Gewicht pro Training"
      : bodyweight
        ? "Wiederholungen pro Training, alle Sätze zusammen"
        : "Volumen pro Training: Gewicht × Wiederholungen, alle Sätze zusammen";

  return `
    <h2 class="section-title">Verlauf</h2>
    <div class="history-card">
      ${toggle}
      <div class="chart-caption">${caption}</div>
      ${chart}
      <div class="stat-row">
        ${stats.map(([label, value]) => `<div class="stat"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`).join("")}
      </div>
    </div>
    <ul class="history-list">${rows}</ul>
  `;
}
