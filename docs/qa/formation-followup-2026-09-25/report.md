# Galalaxy – P0 Formationsflüge

Stand: 25.09.2026

## Anlass

Im vollständigen menschlichen Run waren die wenigen Zwei-/Dreiergruppen zu
klein und zu schnell. Gewünscht waren komplexere Verbände mit mehr Schiffen,
die langsamer und als klar erkennbare Einheit durch den Sektor fliegen. Die
bereits verbesserte Begrenzung von Homing- und Rückangriffen sollte erhalten
bleiben.

## Umsetzung

Vier Formationsgeometrien verwenden feste, flugrichtungsrelative Slots. Alle
Mitglieder eines Verbands teilen sich einen geraden Flugvektor; individueller
Sinusdrift ist deaktiviert. Damit bleibt die Silhouette über den vollständigen
Pass erhalten.

| Sektor | Formation | Schiffe | Rollen | reale Geschwindigkeit |
|---|---|---:|---|---:|
| I | Chevron | 5 | 5× leicht | 82,8 px/s |
| II | seitliches Split-V | 6 | 4× leicht, 2× Skirmisher | 104 px/s |
| III | Eskorte | 5 | Shooter, 2× leicht, 2× Skirmisher | 84 px/s |
| IV | Speerspitze | 7 | Shooter, 4× leicht, 2× Skirmisher | 88 px/s |

Die Karten warten auf eine weitgehend freie Arena mit höchstens einem
Altgegner. Während der ersten vier bis fünfeinhalb Sekunden pausiert der
Hintergrunddruck, danach setzt er innerhalb derselben Karte wieder ein. So ist
der Verband beim Eintritt lesbar, ohne dass die Sektoren anschließend leer
wirken. Die Karten ersetzen Teile der bisherigen Lane-Decks und erhöhen nicht
zusätzlich den maximalen Gegnerdruck.

## Balancewirkung

Die Dichteprüfung bleibt für Sektor I und II im bisherigen 80–90-Prozent-Band.
Sektor III liegt mit 121 modellierten Gegnern bei 64,4 Prozent der historischen
Referenz und damit praktisch an der vorherigen 65-Prozent-Grenze; diese minimale
Verschiebung ist der gezielte Tausch von Kleindruck gegen den größeren
Fünferverband. Sektor IV bleibt im bisherigen Band.

Die Regeln für Angriffsrichtungen bleiben bestehen: aktive Verfolger starten
nicht hinter dem Spieler, schwere Homing-Schiffe bleiben aus dem Dauerstrom,
und Sektor III/IV enthalten weiterhin mehr als doppelt so viel Lane-Druck wie
Pursuit-Druck.

| Kennzahl | vorher | nach Formations-P0 |
|---|---:|---:|
| Minimum | 66.472 | 61.424 |
| P10 | 69.495 | 64.772 |
| Median | 71.703 | 67.151 |
| P90 | 74.403 | 69.343 |
| Maximum | 78.151 | 72.094 |

Die Formationen bewegen die Punktzahl deutlich in Richtung des Zielkorridors,
ohne die separate finale Scorekalibrierung vorwegzunehmen. Ein menschlicher
Vollrun bleibt für die Abnahme erforderlich.

## Verifikation

- Reliability-Suite einschließlich 500 Seeds: bestanden.
- Vier dedizierte Browser-Formationsszenen: 5/6/5/7 Schiffe, vollständige und
  eindeutige Slotfolgen, jeweils genau eine Gruppen-ID und ein gemeinsamer
  Flugvektor.
- Browser-Vollrun, Steuerung, HUD, Rollen- und Boss-Szenen: bestanden.
- Visuelle Prüfung aller vier Formationen bei 390×844: klare Silhouetten,
  vollständig im Spielfeld und ausreichend Abstand zum Spieler.
- Keine Browser-, Konsolen- oder Assetfehler.
