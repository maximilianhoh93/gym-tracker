// ===== Pausentimer =====
// Diese Datei enthält nur die Logik des Timers, keine Anzeige.
// Die Anzeige baut app.js; sie wird über zwei "Rückruf-Funktionen"
// (onTick, onChange) informiert, wenn sich etwas tut.
//
// Wichtig: Wir zählen NICHT einfach jede Sekunde eins herunter. Wenn das
// iPhone die App in den Hintergrund schickt, pausiert der Browser solche
// Zähler, und die Zeit würde falsch. Stattdessen merken wir uns den
// Zeitstempel, an dem die Pause ENDET (endTime), und rechnen bei jeder
// Anzeige: Restzeit = endTime - jetzt. Das stimmt immer, egal wie lange
// die App im Hintergrund war.

const RestTimer = {
  status: "idle",   // "idle" (bereit), "running" (läuft), "paused" (angehalten), "done" (abgelaufen)
  durationMs: 0,    // Eingestellte Gesamtdauer in Millisekunden
  endTime: 0,       // Zeitstempel, wann die Pause endet (nur während "running")
  remainingMs: 0,   // Restzeit im Moment des Anhaltens (nur während "paused")
  context: null,    // Zu welcher Übung der Timer gehört: { unitId, exerciseId, exerciseName }
  intervalId: null, // Kennung des Aktualisierungs-Intervalls

  onTick: null,     // Wird mehrmals pro Sekunde aufgerufen, solange der Timer läuft
  onChange: null,   // Wird aufgerufen, wenn sich der Status ändert

  // Timer mit einer Dauer in Sekunden starten
  start(seconds, context) {
    unlockAudio(); // Muss beim Antippen passieren, sonst blockiert iOS den Ton
    RestTimer.durationMs = seconds * 1000;
    RestTimer.endTime = Date.now() + RestTimer.durationMs;
    RestTimer.context = context;
    RestTimer.setStatus("running");
    RestTimer.startTicking();
  },

  pause() {
    if (RestTimer.status !== "running") return;
    RestTimer.remainingMs = RestTimer.endTime - Date.now();
    RestTimer.stopTicking();
    RestTimer.setStatus("paused");
  },

  resume() {
    if (RestTimer.status !== "paused") return;
    unlockAudio();
    RestTimer.endTime = Date.now() + RestTimer.remainingMs;
    RestTimer.setStatus("running");
    RestTimer.startTicking();
  },

  // Abbrechen bzw. nach dem Ablaufen zurücksetzen
  reset() {
    RestTimer.stopTicking();
    RestTimer.context = null;
    RestTimer.setStatus("idle");
  },

  // Verbleibende Zeit in Millisekunden (nie negativ)
  getRemainingMs() {
    if (RestTimer.status === "running") return Math.max(0, RestTimer.endTime - Date.now());
    if (RestTimer.status === "paused") return RestTimer.remainingMs;
    return 0;
  },

  // Anteil der verbleibenden Zeit, von 1 (voll) bis 0 (abgelaufen). Für den Ring.
  getProgress() {
    if (RestTimer.durationMs === 0) return 0;
    return RestTimer.getRemainingMs() / RestTimer.durationMs;
  },

  // ----- Interne Funktionen -----

  setStatus(status) {
    RestTimer.status = status;
    if (RestTimer.onChange) RestTimer.onChange();
  },

  startTicking() {
    RestTimer.stopTicking();
    // 4-mal pro Sekunde prüfen. Das ist nur für die Anzeige; die Zeit
    // selbst kommt immer aus dem Zeitstempel.
    RestTimer.intervalId = setInterval(RestTimer.tick, 250);
    RestTimer.tick();
  },

  stopTicking() {
    clearInterval(RestTimer.intervalId);
    RestTimer.intervalId = null;
  },

  tick() {
    if (RestTimer.status !== "running") return;
    if (RestTimer.getRemainingMs() <= 0) {
      RestTimer.stopTicking();
      playAlarm();
      RestTimer.setStatus("done");
      return;
    }
    if (RestTimer.onTick) RestTimer.onTick();
  },
};

// Kommt die App aus dem Hintergrund zurück, sofort neu prüfen (statt bis
// zum nächsten Intervall zu warten). Ist die Zeit inzwischen abgelaufen,
// springt der Timer direkt auf "done".
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") RestTimer.tick();
});

// Zeit als "m:ss" anzeigen, z.B. 90000 ms -> "1:30".
// Math.ceil rundet auf, damit "0:00" erst am echten Ende erscheint.
function formatDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  // padStart füllt vorne mit "0" auf: 5 -> "05"
  return minutes + ":" + String(seconds).padStart(2, "0");
}

// ===== Ton am Ende der Pause =====
// Wir erzeugen den Ton direkt im Browser (Web Audio), statt eine
// Audiodatei mitzuliefern. iOS erlaubt Töne nur, wenn der Ton-Baustein
// beim Antippen eines Knopfes "freigeschaltet" wurde, daher unlockAudio().

let audioContext = null;

function unlockAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

// Drei kurze Pieptöne
function playAlarm() {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  for (let i = 0; i < 3; i++) {
    const start = now + i * 0.3;
    const oscillator = audioContext.createOscillator(); // Tonerzeuger
    const gain = audioContext.createGain();             // Lautstärke
    oscillator.frequency.value = 880; // Tonhöhe in Hertz
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02); // schnell lauter
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18); // ausklingen
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.2);
  }
}
