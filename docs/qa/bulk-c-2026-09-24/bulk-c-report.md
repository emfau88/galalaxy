# Bulk C – Torpedo- und Support-Schiffe

Stand: 24.09.2026

## Ergebnis

Das Nairan-Torpedoschiff und das Nautolan-Supportschiff sind als eigenständige
Gegnerrollen umgesetzt und über zwei kuratierte Wave Cards in die vorhandenen
Encounter-Decks integriert. Sie werden nicht ungeplant in den allgemeinen
Gegnerpool gemischt.

## Nairan Torpedo Ship

- Originale Basis-, Engine-, Weapon-, Shield- und Destruction-Layer registriert.
- `torpedo-lock` führt zunächst höchstens ein Torpedoschiff ein.
- Ein 36 Design-Pixel breiter violetter Zielkorridor bleibt 1,05 Sekunden sichtbar.
- Die Zielrichtung wird zu Beginn der Warnung fixiert; späteres seitliches
  Ausweichen ist dadurch der eindeutige Gegenzug.
- Der Schuss ist bewusst langsam, schwer und nicht nachlenkend.
- Ein Torpedoschiff darf den Angriff erst vollständig innerhalb des sichtbaren
  Spielfelds beginnen.

## Nautolan Support Ship

- Originale Basis-, Engine- und Destruction-Layer registriert.
- Das Quellpaket besitzt für Supportschiffe keine eigenen Weapon- oder
  Shield-PNGs. Es wurden deshalb keine unpassenden Torpedolayer wiederverwendet.
- `support-screen` kombiniert einen verwundbaren Support mit zwei robusteren
  Zielschiffen.
- Genau ein naher Verbündeter erhält 45 Prozent Schadensreduktion; robuste
  Schiffe werden bevorzugt.
- Eine gestrichelte grüne Verbindung und ein Ring machen den aktiven Schutz sichtbar.
- Beim Tod oder außerhalb der Reichweite endet der Schutz sofort.
- Der Support hält sich seitlich neben seiner Gruppe. Der Spieler kann sich
  unter ihm positionieren und ihn mit dem geradlinigen Auto-Fire priorisieren.

## Prüfungen

- `node scripts/reliability-check.mjs`: bestanden.
- `node scripts/verify-assets.mjs`: bestanden; 169 Dateien, 2,91 MiB komprimiert.
- Vollständiger Browser-Vollrun: bestanden.
- Browserfehler und fehlgeschlagene Assetantworten: 0.
- Torpedo: Offscreen-Sperre, Einzellimit, Warnverzögerung und fixierte Richtung getestet.
- Support: Ein-Ziel-Limit, robuste Zielpriorisierung, Schadensreduktion, sichtbare Quelle,
  Verwundbarkeit und sofortiges Wirkungsende getestet.

Maschinenlesbares Ergebnis: [report.json](./report.json)

## Visuelle Belege bei 320 × 740

- [Torpedo-Zielkorridor](./enemy-role-torpedo-small.png)
- [Support-Verbindungen](./enemy-role-support-small.png)

## Noch offen

Die technische und visuelle Abnahme ist vollständig. Für den formalen Abschluss
von Bulk C muss ein menschlicher Testspieler nach je einer Begegnung bestätigen,
dass „seitlich aus dem Korridor“ und „Support zuerst durch Positionierung“ ohne
zusätzliche Erklärung verstanden wurden.
