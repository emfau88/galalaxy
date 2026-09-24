# Galalaxy – Balance-Recovery D.5

Stand: 24.09.2026

## Anlass

Ein menschlicher Vollrun nach dem Encounter-Umbau erreichte nur rund 20.000
Punkte statt der früher möglichen knapp 60.000. Das Spiel wirkte dadurch zu
leer, zu einfach und zu ereignisarm.

## Historische Referenz

Verglichen wurde der kontinuierliche Spawner aus Commit `7f90d17` direkt vor
der Einführung der Encounter-Karten in `e0ca339`.

| Sektor | Historisch modelliert | Recovery-Modell | Wiederhergestellt |
|---|---:|---:|---:|
| I | 79,8 | 68–71 | ca. 85–89 % |
| II | 143,1 | 122–127 | ca. 85–89 % |
| III | 188,0 | 160–164 | ca. 85–87 % |
| IV | 221,9 | 189–191 | ca. 85–86 % |

Die kleinen Abweichungen entstehen aus Kartenauswahl und Intervall-Jitter. Die
automatische Abnahme akzeptiert ausschließlich 80–90 % pro Sektor.

## Umsetzung

- Kuratierte Wave Cards bleiben für lesbare Formationen, Torpedo-, Support-
  und Raumkontrollmuster erhalten.
- Parallel läuft wieder ein kontinuierlicher Druckstrom. Diese Gegner besitzen
  kein Flyby-Verhalten, sondern verfolgen den Spieler aktiv wie im früheren
  System.
- Der Verfolgeranteil liegt in jedem Sektor über 55 %.
- Gleichzeitige Gegnerbudgets eskalieren mit 8 / 10 / 12 / 14.
- Projektilbudgets eskalieren mit 12 / 16 / 19 / 23.
- Blockierte Karten-Spawns werden vorgemerkt und bei frei werdendem Platz
  nachgeholt. Verfolger sammeln während eines vollen Spielfelds keinen unfairen
  Burst an.
- Sektor I behält zehn Sekunden Orientierung und die Feuersperre bis Sekunde 15.

## Punkte und Progression

Reguläre Gegner erhalten sektorabhängig die Punktemultiplikatoren 1,00 / 1,08 /
1,12 / 1,20. Die Berechnung von XP und Kampf-Pickups nutzt weiterhin den
unveränderten Basiswert des Gegners. Mehr sichtbare Punkte beschleunigen daher
weder den Build noch die Pickupversorgung zusätzlich.

Deterministisches Modell eines vollständigen Clears:

| Sektor | Reguläre Gegner | Reguläre Punkte | Bosspunkte | Summe |
|---|---:|---:|---:|---:|
| I | 70 | 1.486 | 3.360 | 4.846 |
| II | 127 | 6.433 | 3.840 | 10.273 |
| III | 164 | 20.542 | 4.480 | 25.022 |
| IV | 191 | 12.135 | 7.200 | 19.335 |

Zusammen mit 912 Zeitpunkten ergibt das Modell **60.388 Punkte**. Dies ist ein
erreichbares Potenzial für einen sehr starken Clear und keine garantierte
Auszahlung: entkommene oder nicht zerstörte Gegner liefern weiterhin keine
Punkte.

## Telemetrie

Neue Run-Werte erfassen reguläre Spawns, Pursuit-Spawns, reguläre Kills,
entkommene Gegner sowie reguläre und Boss-Killpunkte getrennt. Damit lässt sich
der nächste menschliche Run ohne Schätzungen bewerten.

## Abnahme

- `node scripts/reliability-check.mjs`: bestanden
- `node scripts/verify-assets.mjs`: bestanden
- Browser-Vollrun: bestanden; keine Page-, Asset- oder Konsolenfehler
- Boss-, Rollen-, Pickup-, HUD- und vier Encounter-Szenen: bestanden
- Menschlicher Vollrun: ausstehend
