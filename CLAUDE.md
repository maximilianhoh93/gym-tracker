# Gym-Tracker

Eine Web-App (PWA) zum Erfassen von Krafttraining, gedacht für die Nutzung auf dem iPhone. Sie soll so allgemein sein, dass auch andere Nutzer/innen mit ganz anderen Trainingsplänen sie verwenden können. Es darf also nichts Persönliches fest eingebaut sein.

**Hinweis:** Die Anforderungen unten sind der erste Stand, nicht die endgültige Spezifikation. Der genaue Funktionsumfang ergibt sich erst im Laufe der Entwicklung. Sie haben Spielraum: Wenn sich beim Bauen oder Testen bessere Lösungen zeigen, schlag sie vor. Passt die Datei dann gemeinsam mit mir an.

## Zusammenarbeit (wichtig)

- Ich bin neu im Programmieren. Erkläre mir die Grundlagen verständlich auf Deutsch: Was macht der Code, warum wurde er so gelöst? Fachbegriffe bitte beim ersten Mal kurz erklären.
- Setze Aufgaben direkt um. Frag nicht bei jedem Schritt um Erlaubnis. Triff einfache Entscheidungen selbst und begründe sie kurz.
- Frag nur nach, wenn eine Anforderung unklar ist oder eine Entscheidung später schwer zu ändern wäre.
- Halte den Code einfach und gut lesbar. Kommentare auf Deutsch.
- Keine zusätzlichen Bibliotheken außer Chart.js (für Diagramme). Chart.js lokal im Projekt ablegen, nicht per CDN laden, damit die App offline funktioniert.
- Sag nach jedem Schritt kurz, was du gemacht hast und wie ich es testen kann.
- Mach nach jedem funktionierenden Schritt einen Git-Commit mit verständlicher Nachricht. Erkläre mir Git, wenn es relevant wird.

## Technik

- Reines HTML, CSS und JavaScript, kein Framework, kein Build-Tool.
- PWA: `manifest.webmanifest`, Service Worker für Offline-Nutzung, App-Icon. Auf dem iPhone soll sie über Safari zum Home-Bildschirm hinzugefügt werden können.
- Hosting später kostenlos über GitHub Pages (die PWA braucht HTTPS). Erkläre mir den Ablauf, wenn wir so weit sind.
- Daten lokal im Browser speichern (localStorage oder IndexedDB, wähle die passende Variante und begründe sie). Kein Login, kein Server.
- Den Speicher-Code in eine eigene Datei (`storage.js`) auslagern. Der Rest der App greift nur darüber auf Daten zu, damit sich die Speicherung später durch eine Cloud-Lösung ersetzen lässt.
- Vorgeschlagene Struktur: `index.html`, `css/styles.css`, `js/app.js`, `js/storage.js`, `js/timer.js`, `js/charts.js`, `service-worker.js`.

## Funktionen

### Trainingspläne
- Beim ersten Öffnen ist nur eine Übersicht gängiger Trainingsarten für Krafttraining vorhanden, zum Beispiel Push/Pull/Legs, Upper/Lower, Ganzkörper. Jede Trainingsart enthält ihre Einheiten (bei Push/Pull/Legs also Push, Pull und Legs).
- Es sind keine Übungen vorgegeben. Nutzer/innen legen ihre Übungen selbst an.
- Alle Übungen liegen in einem gemeinsamen **Übungs-Pool** (eigener Tab „Übungen“), gruppiert nach Muskelgruppe. Jede Übung gibt es dort genau einmal.
- In jeder Einheit werden Übungen aus dem Pool ausgewählt. Fehlt eine, kann sie direkt bei der Auswahl neu angelegt werden.
- Die Reihenfolge der Übungen einer Einheit wird per Drag and Drop (Griff ≡) festgelegt.
- Ein Plan wird als **aktiver Plan** gewählt (man trainiert meist immer mit demselben). Die Reihenfolge seiner Einheiten ist per Drag and Drop änderbar.

### Training durchführen
- Die Trainingsseite (Startseite) zeigt die Einheiten des aktiven Plans. Ein Tipp auf eine Einheit (z.B. Push) startet das Training und zeigt ihre Übungen.
- Bei jeder Einheit steht, wann sie zuletzt trainiert wurde. Die Einheit nach der zuletzt trainierten (in Plan-Reihenfolge, danach wieder von vorn) ist als „Heute dran“ markiert.
- Für das aktuelle Training können Übungen hinzugefügt oder entfernt werden, ohne den gespeicherten Plan zu ändern.
- Übungen lassen sich auf der Trainingsseite der Einheit abhaken (Kreis links). Abgehakte rutschen animiert nach unten in „Erledigt“, die offenen rücken nach.
- Unter jeder Übung steht eine kurze Zusammenfassung der eingetragenen Sätze (z.B. „62,5 kg × 10 · 8“).
- Abgehakte Übungen bleiben änderbar (Gewicht und Wiederholungen).
- Einzelne Übungen lassen sich für das aktuelle Training überspringen („Heute überspringen“ auf der Übungsseite, „↺“ holt sie zurück). Für übersprungene Übungen wird nichts gespeichert, sie verfälschen also keinen Verlauf und keinen Durchschnitt.
- „Training beenden“ speichert das Training (Sätze, verwendete Pausenzeit pro Übung) im Verlauf. Sind noch Übungen offen, kommt eine Rückfrage.
- Ein nicht beendetes Training wird automatisch gespeichert, sobald man eine andere Einheit oder dieselbe Einheit an einem späteren Tag startet.

### Letztes Mal
- „Letztes Mal“ einer Übung = das neueste gespeicherte Training, in dem sie abgehakt war. Es zählen nur Sätze mit eingetragenen Wiederholungen (ein Gewicht allein ist nur die Vorbelegung).
- Beim nächsten Training sind die Gewichte vom letzten Mal eingetragen, die Wiederholungen nicht. Diese stehen nur als grauer Hinweis im leeren Feld, dazu eine Zeile „Letztes Mal (TT.MM.): …“ über den Sätzen.

### Sätze, Gewicht, Wiederholungen
- Ein Tipp auf eine Übung im Training öffnet ihre Seite. Oben stehen die Sätze (Satznummer, kg, Wdh.).
- Pro Übung standardmäßig 2 Sätze, mit „+ Satz“/„− Satz“ änderbar. Jede Übung merkt sich ihre zuletzt verwendete Satzanzahl.
- Gewicht und Wiederholungen werden pro Satz erfasst. Das Gewicht ist meist gleich: Ein Gewicht wird in die folgenden Sätze übernommen, solange die leer sind oder denselben Wert hatten. Einzeln bleibt es änderbar. Ein neuer Satz übernimmt die Werte des vorherigen.

### Pausentimer
- Auf der Übungsseite unter den Sätzen eine schmale, dezente Zeile: „Pause − 2:00 + Start“.
- Der Timer wird manuell gestartet. Standardwert: 2 Minuten, in 15-Sekunden-Schritten änderbar.
- Jede Übung merkt sich ihre zuletzt eingestellte Pausenzeit.
- Beim Start poppt oben links in der Ecke ein kleiner schwarzer Kreis auf, mit einem orangen Ring, der wie eine Ladeanzeige abläuft. Sichtbar auf allen Seiten. Bewusst nicht oben mittig, damit die echte Dynamic Island des iPhones frei bleibt.
- Antippen klappt ihn zu einer Ansicht auf (Übungsname, große Zeit, Anhalten/Fortsetzen, Abbrechen). Ein Tipp daneben klappt sie zu.
- Am Ende ertönt ein kurzer Ton, das Widget klappt auf und zeigt „Pause vorbei“ (Nochmal / Fertig).
- Die Zeit über Zeitstempel berechnen (nicht über einen reinen Zähler), damit der Timer auch korrekt bleibt, wenn die App kurz im Hintergrund war.
- Die verwendete Pausenzeit wird mit der Übung gespeichert.

### Verlauf
- Pro Übung ein Diagramm, das die Entwicklung des Gewichts über die Zeit zeigt.

### Daten sichern
- Export aller Daten als JSON-Datei und Import dieser Datei. So kann man Backups in iCloud Drive ablegen und Daten auf ein neues Gerät übertragen.

## Design

- Sprache: Deutsch.
- Hell- und Dunkelmodus folgen automatisch der Systemeinstellung (`prefers-color-scheme`).
- Mobile-first für das iPhone: große Tipp-Flächen, gut bedienbar mit einer Hand, Safe Areas beachten.

## Vorgehen

Bitte in dieser Reihenfolge bauen und jeweils testen, bevor es weitergeht:

1. Grundgerüst und Navigation
2. Trainingsarten und Einheiten anzeigen
3. Übungen pro Einheit anlegen
4. Training starten, Übungen abhaken, Sätze mit Gewicht und Wiederholungen erfassen
5. Übungen im aktuellen Training hinzufügen und entfernen
6. Pausentimer
7. Speichern der Daten
8. Verlauf-Diagramm
9. Export und Import
10. PWA-Funktionen (Manifest, Service Worker, Icon) und Hosting

## Stand

- [x] 1. Grundgerüst und Navigation (Tab-Leiste unten, Ansichten über den #-Teil der Adresse)
- [x] 2. Trainingsarten und Einheiten anzeigen (Ganzkörper, Upper/Lower, Push/Pull/Legs, Bro-Split; Vorlagen in `js/storage.js`)
- [x] 3. Übungen pro Einheit anlegen (Übungs-Pool nach Muskelgruppen, Auswahl pro Einheit, Sortieren per Drag and Drop; noch nicht dauerhaft gespeichert, das folgt in Schritt 7)
- [x] Zusatz: aktiver Plan, Einheiten auf der Trainingsseite mit „Zuletzt“ und „Heute dran“, Einheiten per Drag and Drop sortierbar
- [x] 6. Pausentimer (vorgezogen; `js/timer.js`)
- [x] 4. Training starten, Übungen abhaken, Sätze mit Gewicht und Wiederholungen erfassen, Training beenden
- [x] 7. Speichern der Daten (localStorage, Schlüssel `gym-tracker-data`, mit Versionsnummer `DATA_VERSION`; dauerhafter Speicher wird angefordert)

Lokal testen: `python3 -m http.server 8000` im Projektordner, dann http://localhost:8000 öffnen.

## Datensicherheit (Entscheidung)

- Daten liegen lokal auf dem Gerät (localStorage). Eine reine Web-App kann nicht garantieren, dass sie das Löschen der Browserdaten übersteht.
- Schutz deshalb: App als Home-Bildschirm-App installieren, dauerhaften Speicher anfordern und regelmäßige Sicherung als Datei in iCloud Drive (Erinnerung in der App, fester Dateiname `gym-tracker-backup.json`, wird beim Sichern ersetzt). Wiederherstellen über „Importieren“.
- Die App soll mit meiner Freundin geteilt werden (Link zu GitHub Pages). Jede Person hat ihre eigenen, getrennten Daten auf ihrem iPhone.

## Spätere Ideen (noch nicht bauen)

- Eigene Trainingspläne anlegen und bearbeiten
- Cloud-Speicherung mit Accounts, damit wir die App zusammen nutzen können (z.B. gemeinsame Pläne, Verlauf der anderen sehen). Vorbereitet: Alle Daten laufen über `storage.js`, alle Einträge haben eindeutige ids, das Datenformat hat eine Versionsnummer. Die Daten sollen dann zusätzlich lokal bleiben (offline im Studio nutzbar), beim ersten Anmelden werden die lokalen Daten hochgeladen.
- Persönliche Rekorde
