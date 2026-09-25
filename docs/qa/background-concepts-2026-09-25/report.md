# Galalaxy – Vergleichsmotive für Sektor II–IV

Stand: 25.09.2026

Status: **Noch nicht ins Spiel eingebunden. Motivabnahme offen.**

Die drei Motive wurden mit dem integrierten ImageGen-Werkzeug als originale,
transparente Pixel-Art-Overlays erzeugt. Sie dienen ausschließlich der
Stil- und Kompositionsabnahme. Nach Freigabe werden die gewählten Motive in
eine entfernte Drift-Ebene und eine separate Randebene aufgeteilt, auf die
420×760-Renderfläche optimiert und erst dann in die Assetgruppen eingebaut.

## Vergleichsmotive

1. `sector-2-nairan-expanse.png` – violette Ionenschleifen, zerbrochener Mond,
   diagonale Energieströme; ruhige zentrale Kampfzone.
2. `sector-3-nautolan-depths.png` – smaragdgrüne Ruinen, gebrochene Ringe,
   organisch-technische Randstrukturen; ruhige zentrale Kampfzone.
3. `sector-4-void-core.png` – versetzter Void Core, Gravitationsbögen, rote
   Trümmermonolithen und verzerrte Sternspuren; ruhige zentrale Kampfzone.

Die Rohkonzepte sind bewusst noch nicht für mobile Laufzeitkosten optimiert
(0,9–1,4 MB je PNG). Diese Kosten gelangen nicht ins Spiel, solange die
Abnahme offen ist.

## Überarbeitete Vergleichsmotive V2

Nach der ersten Sichtung wurde die geschlossene Rahmenwirkung verworfen. Die
V2-Motive verwenden die erste Serie nur als Themenreferenz und reduzieren
Sättigung, Kontrast und Detaildichte. Alle drei Kompositionen sind bewusst
asymmetrisch; die zentrale Kampfzone bleibt transparent.

1. `sector-2-nairan-expanse-v2.png` – kleinerer Mond, breite diagonale
   Energieströme und wenige Ionenschleifen ohne umlaufenden Rahmen.
2. `sector-3-nautolan-depths-v2.png` – entfernter Ring, ein großer
   Ruinenanker rechts und eine kleinere organisch-technische Gruppe links.
3. `sector-4-void-core-v2.png` – kleinerer, dunklerer Void Core, dünne Bögen
   und nur wenige große Monolithsilhouetten.

Die V2-Rohdateien liegen bei ungefähr 0,43–0,82 MB. Sie sind weiterhin reine
Abnahmemotive und noch nicht in Laufzeitassets oder Parallax-Ebenen zerlegt.

Für Nairan wurde zusätzlich `sector-2-nairan-expanse-v3.png` als bevorzugte
Fassung erzeugt. Gegenüber V2 sind ausschließlich die diagonalen
Energieströme dünner, dunkler und stärker unterbrochen, damit sie nicht wie
Kollisionshindernisse wirken. Mond, Palette und transparente Mitte bleiben
erhalten. Die aktuelle Abnahmeauswahl ist damit Nairan V3, Nautolan V2 und
Void V2.

## Verwendetes Prompt-Set

Gemeinsame Vorgaben: `stylized-concept`, transparentes vertikales
Shoot-'em-up-Overlay, hochwertige handgesetzte 32-Bit-Pixel-Art, klare
Pixelcluster, 420×760-Komposition, zentrale 65–70 % dunkel und frei, Motive an
Rand beziehungsweise oberer Peripherie, kein HUD/Text/Schiff/Gegner/Projektil,
kein vollflächiger Farbnebel und Eignung für langsames Parallax-Driften.

- **Nairan:** violette Ionenschleifen, entfernter zerbrochener Mond, diagonale
  Energieströme; tiefviolett, gedämpftes Magenta und elektrische Lavendeltöne.
- **Nautolan:** smaragdgrüne Weltraumruinen, entfernte gebrochene Ringstrukturen,
  organisch-technische Randformen; Teal-Schwarz, Smaragd und oxidiertes Aqua.
- **Void:** hochwertiger entfernter Void Core, dünne Gravitationsbögen, rote
  Trümmermonolithen und verzerrte Sternspuren; Weinrot, Crimson und sparsame
  Violettakzente, kein heller zentraler Portal-Fokus.

### V2-Ergänzungen

Gemeinsame Vorgaben: gröberes Pixelraster passend zu den Spielsprites,
limitierte Palette, ungefähr 40 % weniger Sättigung und Kontrast, echte
Alpha-Transparenz, höchstens rund 15 % Randbelegung, keine Symmetrie und kein
durchgehender Bilderrahmen. Nairan nutzt zwei breite Energieströme, Nautolan
trennt entfernten Ring und zwei ungleich große Ruinencluster, Void hält
Warnfarben durch dunkles Burgund und sparsame rote Highlights lesbar.
