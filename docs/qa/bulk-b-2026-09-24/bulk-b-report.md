# Bulk B – Begegnungsrhythmus und Sektorprofile

Stand: 24.09.2026

## Ergebnis

Der frühere kontinuierliche Zufallsspawn wurde durch einen Encounter-Director
mit sieben kuratierten Wave Cards ersetzt. Eine Begegnung erzeugt 8–12 Sekunden
aktive Gefahr, danach folgen 3–5 Sekunden ohne neue Spawns. Lebende Gegner und
bereits abgefeuerte Projektile können in dieses Erholungsfenster hineinreichen,
es entsteht dort aber kein zusätzlicher Zufallsdruck.

## Sektorprofile

| Sektor | Eröffnung und Identität | Gegnerbudget | Projektilbudget | Erholung |
|---|---|---:|---:|---:|
| I – Kla'ed Frontier | `single-file`; leichte Schiffe, klare Folgen, viel Freiraum | 6 | 9 | 4,2–5,0 s |
| II – Nairan Expanse | `side-sweep`; schnelle Querangriffe und festes Ziel-Lock | 5 | 12 | 3,4–4,3 s |
| III – Nautolan Depths | `anchor-corridor`; robuste Randanker und freie Mitte | 6 | 13 | 4,1–5,0 s |
| IV – Void Core | `finale-relay`; kurze Kombination gelernter Muster | 8 | 16 | 3,5–4,5 s |

Die sieben Karten heißen `single-file`, `open-v`, `side-sweep`,
`precision-cross`, `anchor-corridor`, `hammer-wing` und `finale-relay`.
Mindestens fünf davon werden in mehreren Sektoren wiederverwendet, aber durch
Flotte, Geschwindigkeit, Rollenwahl und Sektorbudget anders gespielt.

## Fairness und Progression

- Jede Wave Card reserviert einen benannten Fluchtkorridor. Die Spawnpunkte
  lassen entweder die Mitte, eine Seite oder den unteren Raum frei.
- Sektor I verwendet vor Sekunde 25 ausschließlich die lesbare Einzelfolge.
  Gegner vor Sekunde 15 sind leichte Schiffe und dürfen vorher nicht feuern.
- Der achte XP-fähige Gegner erscheint im deterministischen Test zwischen
  Sekunde 17 und 19. Das lässt einige Sekunden für Abschuss und Einsammeln und
  zielt damit auf den ersten Draft um Sekunde 20–25.
- `firstDraftAt`, Begegnungsbeginn, aktive Dauer, Erholungsdauer und sicherer
  Korridor werden jetzt für normale Runs in der Run-Historie protokolliert.
- Nairan-Schützen markieren die festgeschriebene Zielposition 0,42 Sekunden
  vor dem Schuss mit einer violetten gestrichelten Linie. Spätes Ausweichen ist
  dadurch ein verständlicher Gegenzug.
- Das Begegnungsbudget begrenzt nicht die Schüsse des Spielers.

## Automatische Prüfung

- `node scripts/reliability-check.mjs`: bestanden.
- `node scripts/verify-assets.mjs`: bestanden; 161 Dateien, 2,89 MiB komprimiert.
- Beschleunigter Browser-Vollrun: bestanden.
- Browserprüfung der vier Eröffnungs-Waves und ihrer Budgets: bestanden.
- Maus-, Touch-, Pause-, HUD-, Pickup- und Asset-Prüfungen: bestanden.
- Browserfehler und fehlgeschlagene Asset-Requests: 0.

Maschinenlesbarer Bericht: [report.json](./report.json)

## Visuelle Belege

- [Sektor I – single-file](./encounter-sector-1.png)
- [Sektor II – side-sweep](./encounter-sector-2.png)
- [Sektor II – Ziel-Lock](./encounter-sector-2-target-lock.png)
- [Sektor III – anchor-corridor](./encounter-sector-3.png)
- [Sektor IV – finale-relay](./encounter-sector-4.png)

## Noch offen für die Abnahme

- Drei normale, nicht beschleunigte Runs müssen Druck- und Erholungsphasen
  subjektiv bestätigen.
- Dabei wird geprüft, ob der erste Draft tatsächlich ungefähr bei Sekunde
  20–25 liegt und ob langsame Builds jeden reservierten Korridor erreichen.
- Diese menschlichen Punkte bleiben in der Roadmap ungeprüft; Bulk B ist daher
  technisch umgesetzt, aber noch nicht vollständig abgenommen.

Torpedo-/Support-Schiffe, der individuelle Sektor-4-Boss und das neue
Void-Core-Asset gehören weiterhin ausschließlich zu Bulk C beziehungsweise D.

## Rücknahme nach manueller Prüfung

Die nach Bulk B ergänzten WASD-, Diagnose- und Start-/Ladepfadänderungen wurden
vollständig zurückgenommen, weil sie im eingebetteten lokalen Browser eine
Regression bis hin zu einer leeren Spielfläche verursacht haben. Bulk B selbst
und seine Encounter-, Sektor- und Telemetrieänderungen bleiben davon unberührt.
