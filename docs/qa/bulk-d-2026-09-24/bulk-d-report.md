# Bulk D – Sektor 4 und individuelle Bosse

Stand: 24.09.2026

## Ergebnis

Bulk D ist vollständig umgesetzt und technisch sowie visuell abgenommen. Sektor IV
besitzt eine neue, zurückhaltende Void-Core-Landmarke und einen eigenen finalen
Bosskampf. Alle vier Bosse haben getrennte Namen, Werte, Bewegungen und Angriffsrollen.

## Sektor IV

- Die alte 96-Pixel-Ringgrafik wurde durch `assets/environment/runtime/void-core-v2.png`
  ersetzt.
- Die Landmarke liegt mit 24 Prozent Deckkraft im oberen Hintergrund.
- Asteroiden und neue Splitter werden an die äußeren rund 14 Prozent der Arena gedrückt.
- Die zentrale Kampffläche bleibt überwiegend frei und Projektilsilhouetten bleiben klar.
- Sektor IV verwendet einen eigenen `void`-Flottenmix statt das Sektor-III-Profil zu kopieren.

## Bossidentitäten

- **KLA'ED IRON DREAD:** breite Seitenbewegung, Torpedopaar und Wave-Gate mit breitem Fluchtkorridor.
- **NAIRAN LANCER:** schnelle seitliche Lancer-Bewegung, fixiertes Ziel-Lock und zeitlich gestaffelter Präzisions-Sweep.
- **ABYSSAL WARDEN:** langsamer Anker, schwere Zielsalve, Raumkontroll-Gate und bei 60/30 Prozent eine sichtbare Support-Schutzphase.
- **VOID SOVEREIGN:** eigener Name, Intro, 3120 HP, 520 Schild, Void-Orbit-Bewegung, rote Aura und drei Phasen. Bei 60/30 Prozent werden Phasenwechsel inszeniert; Lock-Korridor und Rift-Gate wechseln sich ab und lassen immer eine sichere Spur.
- Der Void Sovereign besitzt einen mehrteiligen Todeseffekt und vor dem Sieg eine Mindestpause von 2,4 Sekunden.

## ImageGen

Verwendet wurde der eingebaute ImageGen-Modus. Finale Projektdatei:
`assets/environment/runtime/void-core-v2.png` (320 × 320, transparente PNG).

Finaler Prompt:

> Use case: stylized-concept. Transparent pixel-art game environment landmark
> for a vertical space shooter. One premium distant Void Core singularity,
> perfectly top-down: deep black core, broad asymmetrical accretion disk and
> subtle fragmented orbital arcs. Crisp handcrafted 16-bit/32-bit pixel art,
> restrained deep crimson, wine-red, muted violet and dim copper highlights.
> Single centered object with generous transparent padding. No stars, ships,
> planet surface, UI, frame, text, watermark, neon ring or projectile look.

## Prüfungen

- `node scripts/reliability-check.mjs`: bestanden.
- `node scripts/verify-assets.mjs`: bestanden; 169 referenzierte Dateien, 3,03 MiB komprimiert.
- Vollständiger Browser-Vollrun mit allen Sektorübergängen: bestanden.
- Vier dedizierte Boss-QA-Szenen: bestanden.
- Vier eindeutige Bosstypen, Namen und Bewegungsprofile verifiziert.
- Sektor III schützt den Boss sichtbar mit genau einem Support.
- Sektor III und IV lassen in ihren Kontroll-Gates immer eine sichere Spur.
- Finale Assetgruppen werden vor Sektor IV geladen und nach dem Sieg freigegeben.
- Browserfehler und fehlgeschlagene Assetantworten: 0.

Maschinenlesbares Ergebnis: [report.json](./report.json)

## Visuelle Belege

- [Neue Sektor-4-Umgebung](./encounter-sector-4.png)
- [Kla'ed Iron Dread](./boss-sector-1-phase-1.png)
- [Nairan Lancer](./boss-sector-2-phase-1.png)
- [Abyssal Warden – Supportphase](./boss-sector-3-phase-2.png)
- [Void Sovereign – Phase 3](./boss-sector-4-phase-3.png)

## Direkte lokale QA-Szenen

- `http://127.0.0.1:8773/?test=boss&sector=1`
- `http://127.0.0.1:8773/?test=boss&sector=2`
- `http://127.0.0.1:8773/?test=boss&sector=3&phase=2`
- `http://127.0.0.1:8773/?test=boss&sector=4&phase=3`
