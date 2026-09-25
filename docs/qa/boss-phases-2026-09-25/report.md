# Galalaxy – Boss 2–4 Mehrphasen-P0

Stand: 25.09.2026

## Ergebnis

Boss 2–4 besitzen jetzt jeweils drei mechanisch getrennte Phasen. Der Wechsel
pausiert den Angriff für 1,35 bis 1,55 Sekunden, entfernt laufende gegnerische
Projektile, zeigt ein großes `PHASE II`/`PHASE III`, spielt einen eigenen
Soundimpuls und wechselt Aura sowie Farbe.

Ein großer Treffer wird exakt an der nächsten HP-Schwelle geklemmt. Während
der Übergangspause nimmt der Boss keinen weiteren Schaden. Dadurch kann auch
ein sehr starker Build keine Phase überspringen.

## Bossmuster

| Boss | Phase I | Phase II | Phase III |
|---|---|---|---|
| Nairan Lancer | fixierte Zielerfassung | gestaffelter seitlicher Beam-Sweep | Lock-Salve plus zwei Lane-Salven mit versetztem Fluchtfenster |
| Abyssal Warden | markierter Ankerbeschuss | einmaliger Support, Teilschild und Support-Fächer | dreistufig wandernder Kontrollkorridor |
| Void Sovereign | Ziel-Lanzen | Void-Rifts mit sicherer Spur | gleichzeitiger Ziel-Lock und Rift-Wand mit sicherer Spur |

Der Nautolan-Support wird genau einmal erzeugt und beim Eintritt in Phase III
beendet. Das verhindert eine Wiederholung der Schutzphase und trennt die
Entscheidung „Support zuerst“ klar vom anschließenden Bewegungstest.

## Zielzeiten

Die bestehenden HP-Werte wurden nicht erhöht. Das Modell setzt einen guten,
aber nicht maximalen Build mit 55/56/58 nachhaltigem DPS an und berücksichtigt
Startschilde, Übergangspausen sowie in Sektor III den einmaligen Support und
den Teilschild.

| Sektor | Modell | Ziel |
|---|---:|---:|
| II | 40,7 s | 35–45 s |
| III | 51,4 s | 45–55 s |
| IV | 65,9 s | 55–70 s |

## Verifikation

- Treffer über mehrere Schwellen: auf genau eine Phase begrenzt.
- Schaden während Übergang: vollständig blockiert.
- Zwei eigene Phasensounds pro Bosskampf verifiziert.
- Drei unterschiedliche Muster und Aura-Farben je Boss verifiziert.
- Alle flächigen Endphasenmuster besitzen mindestens eine angekündigte sichere Spur.
- Browser-Vollrun, zehn Boss-Szenen, sechs Übergangsszenen, HUD-, Rollen-,
  Formations- und Assettests bestanden.
- Keine Browser-, Konsolen- oder Assetfehler.

Die echte Zielzeit und Schwierigkeit bleibt über die neue sektorbezogene
Bosszeit-Telemetrie in einem menschlichen Vollrun abzunehmen.
