# Gym-Tracker

Eine Web-App (PWA) zum Erfassen von Krafttraining, gedacht für die Nutzung auf dem iPhone. Sie soll so allgemein sein, dass auch andere Nutzer/innen mit ganz anderen Trainingsplänen sie verwenden können. Es darf also nichts Persönliches fest eingebaut sein.

**Hinweis:** Die Anforderungen unten sind der erste Stand, nicht die endgültige Spezifikation. Der genaue Funktionsumfang ergibt sich erst im Laufe der Entwicklung. Sie haben Spielraum: Wenn sich beim Bauen oder Testen bessere Lösungen zeigen, schlag sie vor. Passt die Datei dann gemeinsam mit mir an.

## Zusammenarbeit (wichtig)

- Ich bin neu im Programmieren. Erkläre mir die Grundlagen verständlich auf Deutsch: Was macht der Code, warum wurde er so gelöst? Fachbegriffe bitte beim ersten Mal kurz erklären.
- Setze Aufgaben direkt um. Frag nicht bei jedem Schritt um Erlaubnis. Triff einfache Entscheidungen selbst und begründe sie kurz.
- Frag nur nach, wenn eine Anforderung unklar ist oder eine Entscheidung später schwer zu ändern wäre.
- Halte den Code einfach und gut lesbar. Kommentare auf Deutsch.
- Keine zusätzlichen Bibliotheken. Chart.js wäre erlaubt, wird aber nicht gebraucht: Die Diagramme werden in `js/charts.js` selbst als SVG gezeichnet (leichter, offline, Apple-Optik). Falls doch einmal Chart.js: lokal im Projekt ablegen, nicht per CDN.
- Sag nach jedem Schritt kurz, was du gemacht hast und wie ich es testen kann.
- Mach nach jedem funktionierenden Schritt einen Git-Commit mit verständlicher Nachricht. Erkläre mir Git, wenn es relevant wird.

## Technik

- Reines HTML, CSS und JavaScript, kein Framework, kein Build-Tool.
- PWA: `manifest.webmanifest`, Service Worker für Offline-Nutzung, App-Icon. Auf dem iPhone soll sie über Safari zum Home-Bildschirm hinzugefügt werden können.
- Hosting später kostenlos über GitHub Pages (die PWA braucht HTTPS). Erkläre mir den Ablauf, wenn wir so weit sind.
- Daten lokal im Browser speichern (localStorage oder IndexedDB, wähle die passende Variante und begründe sie). Kein Login, kein Server.
- Den Speicher-Code in eine eigene Datei (`storage.js`) auslagern. Der Rest der App greift nur darüber auf Daten zu, damit sich die Speicherung später durch eine Cloud-Lösung ersetzen lässt.
- Struktur: `index.html`, `css/styles.css`, `js/app.js` (Anzeige und Bedienung), `js/storage.js` (Daten), `js/timer.js` (Pausentimer), `js/charts.js` (Diagramme, Widgets, Streak), `js/progress.js` (Steigerungsvorschlag, Rekorde); später `service-worker.js`.

## Funktionen

### Trainingspläne
- Beim ersten Öffnen ist nur eine Übersicht gängiger Trainingsarten für Krafttraining vorhanden, zum Beispiel Push/Pull/Legs, Upper/Lower, Ganzkörper. Jede Trainingsart enthält ihre Einheiten (bei Push/Pull/Legs also Push, Pull und Legs).
- Es sind keine Übungen vorgegeben. Nutzer/innen legen ihre Übungen selbst an.
- Alle Übungen liegen in einem gemeinsamen **Übungs-Pool** (eigener Tab „Übungen“), gruppiert nach Muskelgruppe. Jede Übung gibt es dort genau einmal.
- In jeder Einheit werden Übungen aus dem Pool ausgewählt. Fehlt eine, kann sie direkt bei der Auswahl neu angelegt werden.
- Die Reihenfolge der Übungen einer Einheit wird per Drag and Drop (Griff ≡) festgelegt.
- Ein Plan wird als **aktiver Plan** gewählt (man trainiert meist immer mit demselben). Die Reihenfolge seiner Einheiten ist per Drag and Drop änderbar.

### Startseite
- Titel oben: der Name der App, „GymTracker“ (Tab heißt weiter „Start“).
- Tabs unten: Start, Pläne, Übungen, Einstellungen. Einen eigenen Tab „Verlauf“ gibt es nicht; der Verlauf steckt in der jeweiligen Übung.
- Aufbau von oben nach unten: Wochen-Streak allein → Block „Training starten“ → Überschrift „Statistik“ mit den übrigen Widgets.
- Wochen-Streak als eigenes Widget ganz oben: Flamme mit Anzahl Wochen in Folge, Balken für den Fortschritt dieser Woche (Verlauf Orange → Gold), darunter die Tage Mo–So dieser Woche; Trainingstage mit orange-goldenem Haken.
- Block „Training starten“ ist das Wichtigste der App und deutlich hervorgehoben: zart blau getönter Block, große Überschrift, rechts der Name des aktiven Plans als Link. Die Einheit, die dran ist (bzw. läuft), ist blau getönt und hat einen runden Start-Knopf ▶ statt des Pfeils (kein dauerhafter Rahmen).
- Statistik-Widgets als wischbares Karussell (mit Punkten), nicht überladen:
  - Diesen Monat: Trainingstage, Kalender in Streak-Farben, Vergleich zum Vormonat
  - Heute bewegt: Summe aus Gewicht × Wiederholungen aller Sätze von heute abgehakten Übungen, zählt schon während des Trainings; Vergleich zum letzten Training
  - Volumen diese Woche: Sätze pro Muskelgruppe (Montag bis heute). Sätze statt kg, weil kg zwischen Muskelgruppen nicht vergleichbar sind
  - Ø Trainingsdauer der letzten 10 Trainings (nur plausible Dauern von 5 Minuten bis 4 Stunden)
- Ein begonnenes, nicht beendetes Training ist mit „Läuft“ markiert.
- Antippbare Kästchen (Einheiten, Übungen, Pläne) bekommen unter dem Mauszeiger (bzw. beim Antippen der Einheiten auf dem iPhone) einen blauen Rahmen.

### Training durchführen
- Die Startseite zeigt die Einheiten des aktiven Plans. Ein Tipp auf eine Einheit (z.B. Push) startet das Training und zeigt ihre Übungen.
- Bei jeder Einheit steht, wann sie zuletzt trainiert wurde. Die Einheit nach der zuletzt trainierten (in Plan-Reihenfolge, danach wieder von vorn) ist als „Heute dran“ markiert.
- Für das aktuelle Training können Übungen hinzugefügt oder entfernt werden, ohne den gespeicherten Plan zu ändern.
- Übungen lassen sich auf der Trainingsseite der Einheit abhaken (Kreis links). Abgehakte rutschen animiert nach unten in „Erledigt“, die offenen rücken nach.
- Unter jeder Übung steht eine kurze Zusammenfassung der eingetragenen Sätze (z.B. „62,5 kg × 10 · 8“).
- Abgehakte Übungen bleiben änderbar (Gewicht und Wiederholungen).
- Einzelne Übungen lassen sich für das aktuelle Training überspringen („Heute überspringen“ auf der Übungsseite, „↺“ holt sie zurück). Für übersprungene Übungen wird nichts gespeichert, sie verfälschen also keinen Verlauf und keinen Durchschnitt.
- „Training beenden“ steht oben auf der Trainingsseite der Einheit (grün, sobald alles erledigt ist). Es speichert das Training (Sätze, verwendete Pausenzeit pro Übung, Dauer) im Verlauf. Sind noch Übungen offen, kommt eine Rückfrage.
- Bei automatisch gespeicherten Trainings zählt die letzte Eingabe als Ende (für Datum und Dauer).
- Ein nicht beendetes Training wird automatisch gespeichert, sobald man eine andere Einheit oder dieselbe Einheit an einem späteren Tag startet.

### Letztes Mal
- „Letztes Mal“ einer Übung = das neueste gespeicherte Training, in dem sie abgehakt war. Es zählen nur Sätze mit eingetragenen Wiederholungen (ein Gewicht allein ist nur die Vorbelegung).
- Beim nächsten Training sind die Gewichte vom letzten Mal eingetragen, die Wiederholungen nicht. Diese stehen nur als grauer Hinweis im leeren Feld, dazu eine Zeile „Letztes Mal (TT.MM.): …“ über den Sätzen.

### Sätze, Gewicht, Wiederholungen
- Ein Tipp auf eine Übung im Training öffnet ihre Seite. Oben stehen die Sätze (Satznummer, kg, Wdh.).
- Pro Übung standardmäßig ein Aufwärmsatz „W“ und 2 Arbeitssätze, mit „+ Satz“/„− Satz“ änderbar. Eine bewusst eingestellte Satzanzahl (+/−) merkt sich die Übung, sonst gilt der Standard 2.
- Reihenfolge auf der Übungsseite: oben „x von y erledigt“ (wie in der Übungsliste, übersprungene zählen nicht) mit Knopf „Bearbeiten“ (öffnet „Übung bearbeiten“), dann Letztes Mal, Vorschlag, Sätze (mit „− Satz / + Satz“ im selben Kasten), Pausentimer, Notiz, Verlauf. Kein Knopf „Nächste Übung“.
- Gewicht und Wiederholungen werden pro Satz erfasst. Das Gewicht ist meist gleich: Ein Gewicht wird in die folgenden Sätze übernommen, solange die leer sind oder denselben Wert hatten. Einzeln bleibt es änderbar. Ein neuer Satz übernimmt die Werte des vorherigen.

### Pausentimer
- Auf der Übungsseite unter den Sätzen eine schmale, dezente Zeile: „Pause − 2:00 + Start“. Kein Dynamic-Island-Design und kein schwebendes Widget.
- Der Timer wird manuell gestartet. Standardwert: 2 Minuten, in 15-Sekunden-Schritten änderbar.
- Jede Übung merkt sich ihre zuletzt eingestellte Pausenzeit.
- Nach dem Start füllt sich die Zeile selbst mit einem orangen Balken, der bis zum Ende der Pause nach links schrumpft; dazu Restzeit, Anhalten/Fortsetzen und Abbrechen.
- Der Timer läuft beim Wechsel der Übung weiter; jede Übungsseite zeigt ihn (bei einer anderen Übung mit deren Namen).
- Am Ende ertönt ein kurzer Ton, die Zeile wird zart grün: „Pause vorbei“ mit „Nochmal“ und ✕.
- Die Zeit über Zeitstempel berechnen (nicht über einen reinen Zähler), damit der Timer auch korrekt bleibt, wenn die App kurz im Hintergrund war.
- Die verwendete Pausenzeit wird mit der Übung gespeichert.

### Wochen-Streak (wie bei Duolingo)
- Wochenziel = Trainingstage pro Woche (1–7). Beim ersten Mal fragt das Streak-Widget danach, ändern im Tab „Daten“.
- Gezählt werden Trainingstage, nicht Trainings: ein Tag, an dem ein Training mit mindestens einer abgehakten Übung BEENDET wurde. Erst „Training beenden“ (oder das automatische Speichern) zählt, nicht schon das Abhaken.
- Woche erreicht → gold, Streak +1. Woche vorbei und nicht erreicht → „Eis-Look“ (eisblau), Streak endet.
- Die laufende Woche bricht die Streak nie. Die Woche des allerersten Trainings wird neutral gewertet (wer mitten in der Woche anfängt, wird nicht bestraft).
- Ziel-Änderungen gelten ab der laufenden Woche; das allererste Ziel gilt rückwirkend. Alte Wochen behalten so ihre Farbe.
- Urlaubsmodus (Schalter in den Einstellungen): Wochen mit Urlaub, in denen das Ziel nicht erreicht wurde, brechen die Streak nicht (verlängern sie aber auch nicht). Im Kalender lila. Urlaubszeiten werden mit Beginn und Ende gespeichert; am selben Tag an- und ausgeschaltet zählt nicht.
- Kalender: Wochen mit erreichtem Ziel zart gold, Trainingstage darin kräftig gold; verpasste Wochen eisblau. Gold im hellen Modus etwas kräftiger (#f0ab00) als bei Duolingo, weil #ffc800 auf Weiß kaum sichtbar ist. Orange nur im Fortschrittsbalken (Orange und Gold sind als Kalenderfarben zu ähnlich).
- Tab „Einstellungen“: Wochenziel, Urlaubsmodus, Streak (aktuell, längste), Monatsübersicht mit Legende. Die Monate sind zugeklappt und lassen sich einzeln aufklappen, damit die Seite nicht zu lang wird.

### Verlauf
- Auf der Übungsseite (im Training) unter Sätzen und Timer ein Bereich „Verlauf“.
- Umschalter „Gewicht | Volumen“ (keine Tabelle, nie zwei y-Achsen in einem Diagramm):
  - Gewicht: höchstes Gewicht pro Training als Linie (Standard)
  - Volumen: gestapelte, schmale Balken, ein Balken pro Training (höchstens die letzten 8), aufgeteilt in die einzelnen Arbeitssätze (Satz 1 unten), mit Umrandung um den ganzen Balken. Höhe = Gewicht × Wdh., im Abschnitt steht die Wiederholungszahl. Bei Übungen ohne Gewicht nur diese Ansicht (Höhe = Wiederholungen).
- Antippen zeigt die Sätze des nächstgelegenen Trainings. Darunter Kennzahlen: Rekord (mit Pokal), Veränderung seit Beginn, Anzahl Trainings.
- Es zählen nur abgehakte Übungen mit eingetragenen Wiederholungen; übersprungene nie.

### Daten sichern
- Export aller Daten als JSON-Datei und Import dieser Datei. So kann man Backups in iCloud Drive ablegen und Daten auf ein neues Gerät übertragen.

## Design

- Sprache: Deutsch.
- Hell- und Dunkelmodus folgen automatisch der Systemeinstellung (`prefers-color-scheme`).
- Mobile-first für das iPhone: große Tipp-Flächen, gut bedienbar mit einer Hand, Safe Areas beachten.
- Optik angelehnt an den klassischen iOS-Look, einheitlich über ein kleines Design-System in `css/styles.css`:
  - Alle Farben und Maße als Variablen ganz oben (Apples Systemfarben für hell und dunkel: Hintergrund #f2f2f7 / #000, Karten weiß / #1c1c1e, Systemblau #007aff / #0a84ff, Text in drei Abstufungen). Regeln benutzen nur diese Variablen.
  - Feste Bedeutung der Farben: Blau = antippbar, Grün = erledigt/läuft/an, Orange = Pausentimer, Gold = Erfolge (Streak, Rekorde), Eisblau/Lila nur für die Streak.
  - Eine Abrundung für Listen, Karten und Knöpfe (12px), eine größere für Widgets (20px).
  - Listen aus einzelnen, abgerundeten Kästchen: kleiner Abstand (6px) innerhalb einer Liste (z.B. Übungen in Pull), größerer Abstand (12px) zwischen den Einheiten auf der Startseite (Push, Pull, Legs); grauer Pfeil › rechts; Überschriften klein, grau, in Großbuchstaben.
  - Wenig Text: keine Wiederholung des Plannamens innerhalb einer Einheit, keine Erklärtexte, wo sich die Bedienung selbst erklärt (z.B. Sortier-Griff, Häkchen).
  - Drei Knopfarten: gefüllt (Hauptaktion), getönt (zarter Farbton, z.B. „+ Satz“), Text.
  - Entfernen als graues ⓧ, Auswahl als blaues Häkchen rechts, Abhaken als Kreis links (wie Erinnerungen).
  - Navigationsleiste wie iOS: Zurück-Knopf in einem abgerundeten Kasten („‹ Pläne“, nennt das Ziel), großer Titel im Inhalt, beim Scrollen kleiner Titel mittig in einer verschwommenen Leiste. Die Leiste ist ein Raster aus drei Spalten, damit Zurück-Knopf und Titel sich nie überlappen. Lange Titel werden kleiner, deutsch getrennt und auf zwei Zeilen begrenzt.
  - Leere Zustände („Noch keine …“) immer als Hinweis-Karte, nie als loser Text.
  - Zusammenfassungen von Sätzen bleiben einzeilig: bei wechselndem Gewicht oder mehr als 4 Sätzen kurz als „6 Sätze · 95–102,5 kg“.
  - Symbole als SVG-Grafiken, nicht als Schriftzeichen (die sehen je nach Gerät anders aus).
  - Ein Training gilt erst als „Läuft“, wenn etwas eingetragen, abgehakt oder übersprungen wurde.
- Tab-Leiste im Stil von Apples „Liquid Glass“: schwebende, abgerundete Kapsel mit Abstand zu allen Rändern (berührt den unteren Rand nicht), stark durchscheinend und verschwommen, feine helle Kante und weicher Schatten. Hinter dem aktiven Tab eine kleinere Glas-Kapsel mit Umrandung, die beim Umschalten mit leichtem Nachfedern zum neuen Tab gleitet. Schlichte Linien-Symbole (SVG), inaktiv grau, aktiv blau.
- „Heute dran“ wird als Etikett gezeigt, nicht als Rahmen (sah sonst aus wie eine Auswahl).
- Pläne: Der aktive Plan ist grün hinterlegt (dasselbe Grün wie „Pause vorbei“), mit grünem Etikett „Aktiv“.
- Hover-Effekte (Hervorhebung beim Darüberfahren mit der Maus) für Tabs, Karten und Knöpfe, aber nur auf Geräten mit Maus (`@media (hover: hover)`), damit sie auf dem iPhone nicht „kleben bleiben“.
- Die Widgets auf der Startseite rasten beim Wischen immer genau beim nächsten ein; die Punkte darunter sind anklickbar.

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
- [x] Wochen-Streak mit Wochenziel und Urlaubsmodus, Tab „Einstellungen“ mit aufklappbarer Monatsübersicht (Datenformat Version 3)
- [x] 8. Verlauf pro Übung (Diagramm Gewicht/Volumen) und Startseite mit Widgets
- [x] 9. Export und Import (Sicherung in iCloud Drive mit Erinnerung, siehe „Nächste Funktionen“ Punkt 1)
- [x] Übungen bearbeiten, Notizen, Aufwärmsatz, Progressive Overload, Rekorde, Trainingsprotokoll, eigene Pläne (siehe „Nächste Funktionen“)
- [x] 7. Speichern der Daten (localStorage, Schlüssel `gym-tracker-data`, mit Versionsnummer `DATA_VERSION`; dauerhafter Speicher wird angefordert)

Lokal testen: `python3 -m http.server 8000` im Projektordner, dann http://localhost:8000 öffnen.

## Datensicherheit (Entscheidung)

- Daten liegen lokal auf dem Gerät (localStorage). Eine reine Web-App kann nicht garantieren, dass sie das Löschen der Browserdaten übersteht.
- Schutz deshalb: App als Home-Bildschirm-App installieren, dauerhaften Speicher anfordern und regelmäßige Sicherung als Datei in iCloud Drive (Erinnerung in der App, fester Dateiname `gym-tracker-backup.json`, wird beim Sichern ersetzt). Wiederherstellen über „Importieren“.
- Die App soll mit meiner Freundin geteilt werden (Link zu GitHub Pages). Jede Person hat ihre eigenen, getrennten Daten auf ihrem iPhone.

## Nächste Funktionen (beschlossen; alle 8 umgesetzt)

1. ✅ **Sicherung** (erledigt): Export aller Daten als Datei nach iCloud Drive (fester Name `gym-tracker-backup.json`, Teilen-Menü von iOS), Erinnerung nach 5 Trainings oder spätestens 1 Woche, Import zum Wiederherstellen. Anzeige „Letzte Sicherung vor X Tagen“ in den Einstellungen.
2. ✅ **Übungen bearbeiten** (erledigt, Seite `#uebungen/<id>`): Im Pool eine Übung antippen → Name und Muskelgruppe ändern.
3. ✅ **Notiz pro Übung** (erledigt): kompakt, eine Zeile „📝 Notiz hinzufügen“ auf der Übungsseite; vorhandene Notiz zeigt ihre erste Zeile, Tipp zum Bearbeiten. Gilt dauerhaft für die Übung (z.B. „Sitz auf Stufe 4“).
4. ✅ **Aufwärmsatz** (erledigt): Jede Übung startet standardmäßig mit einem Aufwärmsatz „W“ vor den Arbeitssätzen, entfernbar (die Übung merkt sich das). Vorgeschlagenes Gewicht: etwa 50 % des ersten Arbeitssatzes, gerundet auf 2,5 kg (unter 20 kg auf 1 kg); zieht mit, solange er nicht bewusst geändert wurde. Ein-/Ausschalten auch auf der Seite „Übung bearbeiten“. Gespeichert als Satz mit `warmup: true`; `workingSets()` filtert ihn überall heraus. Aufwärmsätze zählen nicht für Volumen, Rekorde, Vorschläge, „Letztes Mal“.
5. ✅ **Progressive Overload (doppelte Progression)** (erledigt, Logik in `js/progress.js`): Pro Übung Wiederholungsbereich (Standard 6–10) und Steigerung (Standard 2,5 kg; Beine, Gesäß, Waden 5 kg; z.B. Maschinen mit 5er-Platten auf 5 kg stellen), beides änderbar. Vorschlag auf der Übungsseite aus dem letzten Training:
   - Alle Arbeitssätze am oberen Ende → „Vorschlag: +2,5 kg“ mit Knopf zum Übernehmen, Ziel wieder unteres Ende.
   - Sonst → gleiches Gewicht, Ziel 1 Wiederholung mehr (als grauer Hinweis in den Feldern).
   - Zweimal hintereinander unter dem Bereich (erster Arbeitssatz) → „… kg probieren?“ (etwa 10 % weniger, in den Schritten der Übung gerundet).
   - Ohne Gewicht (z.B. Klimmzüge): nur Wiederholungen; am oberen Ende Hinweis auf Zusatzgewicht.
   - Bereich und Steigerung auf der Seite „Übung bearbeiten“ (Steigerung in Stufen 0,5/1/1,25/2/2,5/5/10 kg).
   Grundlage: Gewicht oder Wiederholungen steigern wirkt für Muskelaufbau etwa gleich (Plotkin et al. 2022); doppelte Progression kombiniert beides.
6. ✅ **Rekorde** (erledigt): kompakt im Verlauf der Übung bei den Kennzahlen unter dem Diagramm („🏆 102,5 × 5“), keine eigene Seite. Bester Satz = höchstes Gewicht, bei Gleichstand mehr Wiederholungen. Beim Abhaken mit neuem Rekord: Einblendung „Neuer Rekord!“ und Etikett „Rekord“ in der Liste. Pokal und Rekord-Etikett in Gold (Gold = Erfolge: Streak und Rekorde).
7. ✅ **Trainingsprotokoll** (erledigt, Seite `#einstellungen/tag/<datum>`): In den Einstellungen im Kalender einen Trainingstag antippen → Übersicht dieses Trainings (Dauer, Übungen, Sätze, bewegte kg, Rekorde) und die Übungen mit Sätzen. Dort Werte ändern, Übungen entfernen, Training löschen. Die Seite bleibt übersichtlich: im Normalzustand eine Zeile pro Übung, Eingabefelder erst im Modus „Bearbeiten“. Beendete Trainings speichern zusätzlich `planName`/`unitName`, damit das Protokoll auch nach Umbenennen oder Löschen lesbar bleibt. Aufgeklappte Monate bleiben beim Zurückkommen offen.
8. ✅ **Eigene Pläne** (erledigt): In „Pläne“ eigene Pläne anlegen (Name), Trainingstage hinzufügen, umbenennen, sortieren, löschen. Trainingstage auch bei den vorgegebenen Plänen ergänzen/umbenennen. Namen werden über das eingebaute Eingabefenster (`prompt`) abgefragt. Gelöschte Pläne/Trainingstage lassen gespeicherte Trainings unberührt.

Bewusst NICHT umsetzen (vorerst): App online stellen (Schritt 10, später), Übungen archivieren statt löschen (ich lösche keine Übungen), Bildschirm im Training anlassen, Sätze einzeln abhaken bzw. Timer automatisch starten.

## Spätere Ideen (noch nicht bauen)

- Cloud-Speicherung mit Accounts, damit wir die App zusammen nutzen können (z.B. gemeinsame Pläne, Verlauf der anderen sehen). Vorbereitet: Alle Daten laufen über `storage.js`, alle Einträge haben eindeutige ids, das Datenformat hat eine Versionsnummer. Die Daten sollen dann zusätzlich lokal bleiben (offline im Studio nutzbar), beim ersten Anmelden werden die lokalen Daten hochgeladen.
- Geschätztes Maximalgewicht (1RM) im Verlauf
- Körpergewicht erfassen
- Monats-Rückblick
- Plan als Datei mit anderen teilen
- Hantelscheiben-Rechner, kg/lb, alle Daten löschen
