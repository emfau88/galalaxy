# Galalaxy – HUD- und Telemetrie-Follow-up

Stand: 25.09.2026

## Anlass

Ein vollständiger menschlicher Run endete ohne Tod bei 74.058 Punkten. Auf dem
Handy saß die HUD-Leiste erneut deutlich unter dem oberen Bildschirmrand. Der
bisherige automatische Volltrefferwert von 60.070 Punkten verwendete nur einen
festen Zufallswert und bildete die tatsächliche Gegner- und Punktevarianz nicht
ab.

## Umsetzung

- Die HUD-Leiste wird auf jedem Seitenverhältnis exakt vier Viewport-Pixel
  unterhalb der Safe Area verankert.
- Pause-, Fullscreen- und Bossleiste verwenden weiterhin dieselbe
  Designraum-Transformation.
- Run-Telemetrie Version 4 speichert pro Sektor:
  - aktive Kampfzeit und daraus entstandene Zeitpunkte,
  - reguläre Spawns, Verfolger, Kills und entkommene Gegner,
  - reguläre und Boss-Killpunkte,
  - Bossstart und Bosskampfzeit,
  - daraus berechnete Sektorpunktzahl.
- Die Punkteprüfung simuliert 500 reproduzierbare Seeds statt eines einzelnen
  fest verdrahteten Niedrigwert-Runs.

## Punkte-Baseline

| Kennzahl | Punkte |
|---|---:|
| Minimum | 66.472 |
| P10 | 69.495 |
| Median | 71.703 |
| P90 | 74.403 |
| Maximum | 78.151 |

Der menschliche Wert von 74.058 liegt damit unmittelbar am modellierten P90.
Die Punktebalance bleibt bewusst unverändert und wird erst nach dem geplanten
Formationsumbau final kalibriert.

## Browserprüfung

Geprüfte Viewports: 390×844, 360×800, 360×900, 320×740, 430×932,
390×1000 mit 44 Pixel Safe Area sowie 900×420 Landscape.

- HUD-Oberkante in allen Fällen bei `safeTop + 4 px`.
- Bossleistenabstand in allen Fällen zwölf Design-Pixel.
- Pause-Schalter in allen Fällen innerhalb der HUD-Leiste.
- Vollrun, Steuerung, Encounter-, Rollen- und Boss-Szenen bestanden.
- Keine Browser-, Konsolen- oder Assetfehler.
