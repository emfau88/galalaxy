# Galalaxy – verbindliche Umsetzungsroadmap

Stand: 24.09.2026

Diese Datei ist die verbindliche Source of Truth für die weitere Entwicklung.
Bulk-Nummern oder Inhalte dürfen nicht stillschweigend umgedeutet werden.

## Arbeitsregeln

- [ ] Vor Beginn eines Bulks diese Datei lesen.
- [ ] Nur Aufgaben des ausdrücklich beauftragten Bulks bearbeiten.
- [ ] Zusätzliche Arbeiten unter `Ungeplant / neu entdeckt` dokumentieren, statt sie als anderen Bulk auszugeben.
- [ ] Eine Checkbox erst nach Umsetzung **und** Prüfung abhaken.
- [ ] Einen Bulk erst auf `ABGESCHLOSSEN` setzen, wenn sämtliche Pflichtpunkte und Abnahmekriterien erfüllt sind.
- [ ] Nach jedem Bulk Testresultate, Screenshots und bekannte Restpunkte direkt in dieser Datei ergänzen.
- [ ] Änderungen am Plan werden mit Datum unter `Änderungsprotokoll` festgehalten.
- [ ] Bestehende, nicht zum Bulk gehörende Nutzeränderungen bleiben unangetastet.

## Statuslegende

- `[ ]` offen
- `[x]` umgesetzt und geprüft
- `TEILWEISE` einzelne Punkte erledigt, Bulk nicht abgeschlossen
- `OFFEN` noch nicht begonnen oder keine Pflichtpunkte abgeschlossen
- `ABGESCHLOSSEN` alle Pflichtpunkte und Abnahmekriterien erfüllt

## Bisheriger Soll-/Ist-Stand

| Ursprünglicher Bulk | Inhalt | Verbindlicher Status |
|---|---|---|
| Bulk 0 | Messbare Ausgangsbasis | TEILWEISE |
| Bulk 1 | HUD und ruhiger Einstieg | TEILWEISE |
| Bulk 2 | Begegnungsrhythmus und Sektorprofile | OFFEN |
| Bulk 3 | Sektorbezogene Map-Identität | TEILWEISE |
| Bulk 4 | Torpedo- und Support-Schiffe | OFFEN |
| Bulk 5 | Pickups und Build-Progression | TEILWEISE |
| Bulk 6 | Individuelle Bosse und echtes Finale | OFFEN |
| Bulk 7 | Professioneller Polish und Wiederspielwert | TEILWEISE |

> Wichtig: Der zuvor als „Bulk 2“ umgesetzte Pickup-Teil gehört inhaltlich zum
> ursprünglichen Bulk 5. Der ursprüngliche Bulk 2 wurde dadurch nicht erledigt.

---

# Verbindlicher Restplan

Die neuen IDs A–G ersetzen keine alten Inhalte, sondern ordnen alle offenen
Arbeiten in einer ausführbaren Reihenfolge. Die Zuordnung zum ursprünglichen
Plan steht bei jedem Bulk.

## Bulk A – Steuerung, Pickup-Assets und unmittelbare Balance

**Priorität:** P0
**Status:** TEILWEISE
**Bezug:** neue Anforderung + offener Teil aus Bulk 5

### Steuerung

- [x] WASD als gehaltene Richtungssteuerung implementieren.
- [x] Diagonale Bewegung normalisieren, damit sie nicht schneller ist.
- [x] Maussteuerung unverändert erhalten.
- [x] Touchsteuerung unverändert erhalten.
- [x] Während eines Runs nahtlos zwischen Maus und Tastatur wechseln können.
- [x] Tastatureingaben bei Pause, Upgrade-Auswahl und Run-Ende korrekt sperren.
- [x] Steuerungshinweise im Titelbild und in der README aktualisieren.
- [x] Automatisierte Tests für W, A, S, D und diagonale Bewegung ergänzen.

### Pickup-Assets

- [x] Per ImageGen eine rote Reparaturkapsel als transparentes Pixel-Art-Asset erzeugen.
- [x] Per ImageGen eine blaue Schildbatterie als transparentes Pixel-Art-Asset erzeugen.
- [x] Per ImageGen einen orangefarbenen Overdrive-Kern als transparentes Pixel-Art-Asset erzeugen.
- [x] Alle drei Assets auf klare Lesbarkeit in tatsächlicher Spielgröße prüfen.
- [x] Einheitliche Perspektive, Pixelgröße, Lichtquelle und Silhouette sicherstellen.
- [x] Generischen Kreisrahmen vollständig entfernen.
- [x] Text über den Pickup-Objekten entfernen oder nur verwenden, wenn ein Lesbarkeitstest ihn verlangt.
- [x] Finale Assets im Projekt speichern und im Asset-Manifest registrieren.

### Pickup-Balance

- [x] Maximal ein aktives Kampf-Pickup gleichzeitig zulassen.
- [x] Mindestabstand zunächst auf 26–30 Sekunden setzen.
- [x] Grund-Dropchance reduzieren.
- [x] Repair von aktuell 28 auf einen Testwert von 15–18 Hull reduzieren.
- [x] Shield auf einen Testwert von 25–30 Schild abstimmen.
- [x] Overdrive-Dauer mit 6–8 Sekunden testen.
- [x] Bedarfsgerechte Gewichtung für Repair und Shield beibehalten.
- [ ] Pickupanzahl und tatsächliche Heilung in normalen Test-Runs protokollieren.

### Abnahme Bulk A

- [x] WASD, Maus und Touch funktionieren ohne gegenseitige Blockade.
- [x] Pickups sind ohne Kreisrahmen innerhalb eines kurzen Blicks unterscheidbar.
- [ ] In drei normalen Runs entsteht kein Eindruck von Pickup-Konfetti.
- [x] Reliability-, Asset- und Browserprüfungen bestehen.
- [x] Ergebnis und Screenshots sind unter `docs/qa/` dokumentiert.

---

## Bulk B – Begegnungsrhythmus und echte Sektorprofile

**Priorität:** P0
**Status:** TEILWEISE
**Bezug:** ursprünglicher Bulk 2

### Encounter-Director

- [x] Kontinuierlichen Zufallsdruck in kuratierte Begegnungsblöcke überführen.
- [x] Begegnungen mit ungefähr 8–12 Sekunden aktiver Gefahr definieren.
- [x] Zwischen Begegnungen 3–5 Sekunden geringeren Druck ermöglichen.
- [x] Gleichzeitige Gegnerzahl und Projektilbudget pro Begegnung begrenzen.
- [x] Mindestens fünf wiederverwendbare Wave Cards implementieren.
- [x] Begegnungen dürfen niemals sämtliche Fluchtwege gleichzeitig sperren.

### Sektor I – Kla'ed Frontier

- [x] Einfache Scouts/Fighter und klar lesbare Formationen verwenden.
- [x] Viel freie Bewegungsfläche erhalten.
- [x] Nach der Einführungsphase kontrolliert auf normale Intensität ansteigen.
- [ ] Zeitpunkt des ersten Upgrade-Drafts messen und auf etwa 20–25 Sekunden abstimmen.

### Sektor II – Nairan Expanse

- [x] Schnelle Seitenangriffe als Hauptmotiv etablieren.
- [x] Präzise Schüsse und spätes, gezieltes Ausweichen verlangen.
- [x] Weniger Masse, dafür höhere Geschwindigkeit und klarere Zielmarkierungen einsetzen.

### Sektor III – Nautolan Depths

- [x] Langsame, robuste Gegner und Raumkontrolle als Hauptmotiv etablieren.
- [x] Sichere Korridore lesbar halten.
- [x] Druck durch Positionierung statt bloß durch höhere Gegnerzahl erzeugen.

### Sektor IV – Void Core

- [x] Kuratierte Kombinationen bereits gelernter Rollen verwenden.
- [x] Deutliche, kurze Intensitätsspitzen statt permanenten Maximaldrucks bauen.
- [x] Erholungsfenster zwischen Finalbegegnungen einplanen.
- [x] Sektor IV darf nicht nur „Sektor III, aber länger“ sein.

### Abnahme Bulk B

- [x] Jeder Sektor ist anhand seines Spielrhythmus beschreibbar.
- [ ] Drei normale Runs zeigen erkennbare Druck- und Erholungsphasen.
- [ ] Langsame Builds behalten erreichbare Fluchtwege.
- [x] Vollrun und Reliability-Tests bestehen.

---

## Bulk C – Torpedo- und Support-Schiffe

**Priorität:** P1
**Status:** OFFEN
**Bezug:** ursprünglicher Bulk 4

### Nairan Torpedo Ship

- [ ] Vorhandene Basis-, Engine-, Weapon-, Shield- und Destruction-Assets registrieren.
- [ ] Sichtbares Ziel-Lock oder einen Zielkorridor anzeigen.
- [ ] Zielrichtung vor dem Abschuss fixieren.
- [ ] Verständliche Verzögerung zwischen Warnung und Abschuss einbauen.
- [ ] Seitliches Ausweichen als klaren Gegenzug ermöglichen.
- [ ] In der Einführung maximal ein Torpedoschiff gleichzeitig zulassen.
- [ ] Keine Torpedos aus unsichtbaren Bildschirmbereichen abfeuern.

### Nautolan Support Ship

- [ ] Vorhandene Basis-, Engine-, Weapon-, Shield- und Destruction-Assets registrieren.
- [ ] Maximal zwei nahe Gegner schützen oder verstärken.
- [ ] Sichtbare Verbindung zwischen Support und Zielschiffen darstellen.
- [ ] Support selbst relativ verwundbar halten.
- [ ] Wirkung sofort beenden, wenn der Support zerstört wird.
- [ ] Zielpriorisierung trotz Auto-Fire über Positionierung ermöglichen.

### Abnahme Bulk C

- [ ] Spieler können nach einer Begegnung den Gegenzug beider Rollen erklären.
- [ ] Torpedo- und Supporteffekte sind auch auf kleinen Displays lesbar.
- [ ] Kein unsichtbarer Buff und kein unfairer Offscreen-Angriff tritt auf.
- [ ] Eigene QA-Szenen und automatisierte Tests für beide Rollen bestehen.

---

## Bulk D – Sektor 4 und individuelle Bosse

**Priorität:** P1
**Status:** OFFEN
**Bezug:** Rest aus Bulk 3 + ursprünglicher Bulk 6

### Sektor-4-Umgebung

- [ ] Aktuelles niedrig aufgelöstes Void-Core-/Black-Hole-Objekt ersetzen.
- [ ] Per ImageGen ein hochwertiges transparentes Pixel-Art-Void-Core-Asset erzeugen.
- [ ] Asset als entfernte Landmarke im oberen Spielfeld platzieren.
- [ ] Kontrast so reduzieren, dass keine Verwechslung mit Projektilen entsteht.
- [ ] Sektor-4-Debris und Randatmosphäre liebevoller, aber zurückhaltend gestalten.
- [ ] Rund 70 % der zentralen Kampffläche visuell ruhig halten.

### Kla'ed-Boss

- [ ] Bestehende Torpedo- und Wave-Mechaniken beibehalten.
- [ ] Reihenfolge, Telegraphen und Übergänge prüfen und gegebenenfalls glätten.

### Nairan-Boss

- [ ] Eigenes Ziel-Lock-Muster implementieren.
- [ ] Präzisionssalve oder Beam-Sweep implementieren.
- [ ] Generisches Salvenmuster als alleinige Bossidentität entfernen.

### Nautolan-Boss in Sektor III

- [ ] Raumkontrollmechanik mit klar erkennbarem sicheren Korridor implementieren.
- [ ] Support- oder Schutzphase integrieren.
- [ ] Geschwindigkeit nicht als primäre Schwierigkeit verwenden.

### Finalboss in Sektor IV

- [ ] Eigenen Bossnamen und eigenen Introtext definieren.
- [ ] Eigenes Bossprofil statt Wiederverwendung des Sektor-3-Profils anlegen.
- [ ] Eigene Werte und mindestens zwei zusätzliche Phasen definieren.
- [ ] Phasenwechsel beispielsweise bei 60 % und 30 % HP klar inszenieren.
- [ ] Ziel-Lock und Raumkontrolle kombinieren, ohne alle Fluchtwege zu sperren.
- [ ] Eigene Aura beziehungsweise klar unterscheidbare Silhouette verwenden.
- [ ] Eigenen Todeseffekt und eine kurze Siegespause implementieren.

### Abnahme Bulk D

- [ ] Sektor 4 wirkt visuell hochwertig und spielerisch wie ein Finale.
- [ ] Sektor 3 und 4 besitzen nicht mehr denselben Bosskampf.
- [ ] Jeder Boss verlangt eine unterscheidbare Bewegung vom Spieler.
- [ ] Boss-QA-Szenen und kompletter Vollrun bestehen.

---

## Bulk E – Build-Progression fertigstellen

**Priorität:** P1
**Status:** OFFEN
**Bezug:** offener Teil aus ursprünglichem Bulk 5

- [ ] Erster Draft bietet garantiert mindestens zwei offensive Optionen.
- [ ] Bis Ende Sektor I ist eine erkennbare Hauptwaffenrichtung erreichbar.
- [ ] Angebote ab Sektor II stärker an die gewählte Waffenfamilie binden.
- [ ] Passenden Keystone spätestens zu Beginn von Sektor III anbieten.
- [ ] Höchstens einen Keystone pro Run beibehalten.
- [ ] Magnet, HP und Schild dürfen offensive Entwicklung nicht regelmäßig verdrängen.
- [ ] Unbegrenzte Stat-Upgrades begrenzen oder mit abnehmendem Nutzen versehen.
- [ ] Upgradezeitpunkte, Angebote und Picks im Run-Telemetrieprotokoll erfassen.
- [ ] Zielstruktur prüfen:
  - [ ] Sektor I: Hauptwaffe finden.
  - [ ] Sektor II: Waffenfamilie aufbauen.
  - [ ] Sektor III: Keystone und Synergie erreichen.
  - [ ] Sektor IV: fertigen Build ausspielen.

### Abnahme Bulk E

- [ ] Drei unterschiedliche Builds erreichen zuverlässig eine erkennbare Identität.
- [ ] Keystone ist erreichbar, aber nicht automatisch unabhängig vom Build passend.
- [ ] Kein Draft besteht ausschließlich aus unattraktiven defensiven Fülloptionen.
- [ ] Upgrade- und Vollrun-Tests bestehen.

---

## Bulk F – Professioneller Polish und Wiederspielwert

**Priorität:** P2
**Status:** OFFEN
**Bezug:** ursprünglicher Bulk 7

### Kampf- und Navigationsfeedback

- [x] Eigene Sounds für Schildtreffer, Schildbruch und Pickup vorhanden.
- [x] Hulltreffer, Kill, Upgrade und Bosswarnung besitzen Sounds.
- [ ] Spawn-Telegraphen an Bildschirmrändern verbessern.
- [ ] Torpedo- und Support-Schiffe akustisch ankündigen.
- [ ] Schwere Treffer mit klarerem, kurzem Impact versehen.
- [ ] Sektorübergänge visuell und akustisch verfeinern.

### Run-Abschluss

- [x] Spielzeit, Kills und Bestwert werden angezeigt.
- [x] Erreichter Sektor und abgeschlossene Sektoren werden angezeigt.
- [x] Keystone, Hauptmodule, Todesursache und fertiges Schiff werden angezeigt.
- [ ] Informationshierarchie und Lesbarkeit auf kleinen Displays abschließend prüfen.

### Wiederspielwert – erst nach stabiler Balance

- [ ] Alternative Startausrüstung als kontrollierten Test prüfen.
- [ ] Kosmetische Schiffseffekte prüfen.
- [ ] Einen kleinen Sektormodifikator pro Run prüfen.
- [ ] Eine Routenentscheidung nach Sektor II prototypisch testen.
- [ ] Keine permanente Schadens- oder HP-Steigerung durch Grind einführen.

### Abnahme Bulk F

- [ ] Wichtige Ereignisse sind visuell und akustisch eindeutig.
- [ ] Run-Ende beantwortet verständlich: Wie weit, womit und woran?
- [ ] Mobile und Desktop-QA bestehen.

---

## Bulk G – Abschlussprüfung und Rebalancing

**Priorität:** P0 vor Veröffentlichung
**Status:** OFFEN
**Bezug:** noch offener menschlicher Teil aus Bulk 0

### Testumfang

- [ ] Mindestens fünf normale vollständige Runs protokollieren.
- [ ] Mindestens einen neuen Spieler einbeziehen.
- [ ] Mindestens einen durchschnittlichen Spieler einbeziehen.
- [ ] Mindestens einen erfahrenen Spieler einbeziehen.
- [ ] Pro Run ersten Draft und Hauptwaffenzeitpunkt erfassen.
- [ ] Keystonezeitpunkt und verbleibende Spielzeit danach erfassen.
- [ ] Pickupanzahl, Pickup-Typen und tatsächliche Heilung erfassen.
- [ ] Bosskampfzeit für jeden Sektor erfassen.
- [ ] Todesursache und wahrgenommene Fairness erfassen.
- [ ] Freie Bewegungsfläche und Projektilverständlichkeit pro Sektor bewerten.

### Technische Abschlussprüfung

- [ ] Reliability-Check besteht.
- [ ] Asset-Manifest besteht.
- [ ] Browserprüfung ohne Fehler oder Warnungen besteht.
- [ ] Beschleunigter Vollrun besteht mehrfach hintereinander.
- [ ] WASD-, Maus- und Touchsteuerung bestehen gemeinsam.
- [ ] Alle dedizierten Pickup-, Gegner-, Sektor- und Boss-QA-Szenen bestehen.
- [ ] Vorher-/Nachher-Vergleich mit Bulk-0-Baseline dokumentieren.
- [ ] Offene Fehler nach Priorität klassifizieren.

### Abnahme Bulk G

- [ ] Keine P0- oder P1-Probleme offen.
- [ ] Sektorprogression ist in Messwerten und Spielerrückmeldung erkennbar.
- [ ] Finale Balancewerte sind dokumentiert.
- [ ] Releasekandidat ist eindeutig benannt und reproduzierbar testbar.

---

## Bereits umgesetzte, aber noch nicht endgültig abgenommene Arbeiten

### Bulk 0 – Baseline

- [x] Technische Baseline dokumentiert.
- [x] Referenzscreenshots für HUD, Upgrade-Auswahl und mehrere Sektoren erstellt.
- [x] Beschleunigten Vollrun ausgeführt.
- [x] Ungenutzte Torpedo- und Support-Assets inventarisiert.
- [ ] Menschliche Runs durchführen; wird in Bulk G abgeschlossen.

### Bulk 1 – HUD und Einstieg

- [x] Shield- und Hull-Balken vergrößert und eindeutig beschriftet.
- [x] Zahlen vereinfacht.
- [x] Mattere Grundgestaltung mit kräftigeren Balkenfarben umgesetzt.
- [x] Schildtreffer, Schildbruch, Hulltreffer und kritischen Hullzustand visualisiert.
- [x] Bossleiste vom Spieler-HUD getrennt.
- [x] Pause- und Fullscreen-Schalter in das HUD integriert.
- [x] Run startet mit vollem Schild.
- [x] Erste 12–15 Sekunden von Sektor I beruhigt.
- [x] Formationen in Sektor I bis Sekunde 25 verzögert.
- [ ] Wirkung in menschlichen Runs validieren; wird in Bulk G abgeschlossen.

### Bulk 3 – bisherige Map-Identität

- [x] Vier unterschiedliche Farb- und Atmosphärenprofile angelegt.
- [x] Sektorbezogene Landmarken, Sternfarben und Asteroidendichten eingebaut.
- [x] Zentrale Kampffläche frei von kollidierenden Hindernissen gehalten.
- [ ] Parallax- und Bewegungscharakter von Sektor II weiter differenzieren.
- [ ] Randatmosphäre von Sektor III hochwertiger ausarbeiten.
- [ ] Sektor-4-Landmark in Bulk D ersetzen.

### Bulk 5 – bisherige Pickups

- [x] Repair, Shield Cell und Overdrive funktional implementiert.
- [x] Bedarfsgerechte Dropgewichtung implementiert.
- [x] Pickup-Sound und Overdrive-HUD-Anzeige implementiert.
- [x] Separate Pickup-QA-Szene erstellt.
- [x] Dropdichte und Wirkungsstärke in Bulk A korrigieren.
- [x] Hochwertige zusammengehörige Assets in Bulk A erstellen.
- [ ] Upgrade-Dramaturgie in Bulk E umsetzen.

## Ungeplant / neu entdeckt

- [x] Sporadischen Timing-Ausreißer der Sektor-Cleanup-Prüfung reproduziert und den Test deterministisch gemacht.
- [x] Isolierten WASD-Kandidaten in einem normalen Desktop-Browser manuell abgenommen; der eingebettete Codex-Browser reicht physische WASD-Eingaben nicht zuverlässig weiter.
- [ ] Lokalen Entwicklungsserver nach manuellen Tests sauber beenden.

## Änderungsprotokoll

- **24.09.2026:** Verbindliche Roadmap aus dem ursprünglichen Bulk-Plan, dem tatsächlichen Repository-Stand und den neuen Anforderungen an WASD, Pickup-Assets, Pickup-Balance und Sektor 4 erstellt.
- **24.09.2026:** Bulk A technisch umgesetzt und geprüft. Menschliche Abnahme über drei normale Runs bleibt offen; Details unter `docs/qa/bulk-a-2026-09-24/bulk-a-report.md`.
- **24.09.2026:** Bulk B technisch umgesetzt: sieben Wave Cards, vier spielerische Sektorprofile, Begegnungsbudgets, Erholungsfenster, Nairan-Ziel-Lock und Run-Telemetrie. Drei normale Abnahmeruns bleiben offen; Details unter `docs/qa/bulk-b-2026-09-24/bulk-b-report.md`.
- **24.09.2026:** WASD-, Diagnose- und die damit verbundenen Start-/Ladepfadänderungen nach manueller Regression vollständig zurückgenommen. Maus/Touch sind wieder der verbindliche Steuerungsstand; WASD bleibt offen und muss später isoliert neu umgesetzt werden.
- **24.09.2026:** Neuen WASD-Kandidaten strikt opt-in hinter `?controls=wasd` ergänzt. Nur Eingabe und Spielerbewegung wurden geändert; Start-, Fokus-, HTML- und Ladepfade blieben unangetastet. Automatische Tastatur-, Maus-, Pause-, Standardmodus- und Vollrun-Prüfungen bestanden; manuelle Freigabe bleibt offen.
- **24.09.2026:** WASD in einem externen Desktop-Browser manuell bestätigt und als Standard aktiviert. `?controls=pointer` bleibt als sicherer Rückfallmodus; der Codex-Browser selbst fängt physische WASD-Eingaben ab.
