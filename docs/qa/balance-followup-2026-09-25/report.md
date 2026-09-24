# Galalaxy – Balance-Follow-up Sektor III/IV

Stand: 25.09.2026

## Anlass

Der erste menschliche Run nach der Dichtewiederherstellung zeigte in Sektor III
zu viele gleichzeitig zum Spieler steuernde Schiffe, schwere Homing-Gegner im
Dauerstrom und Bedrohungen hinter dem Spieler. Sektor IV wäre mit derselben
Kurve voraussichtlich noch stärker eskaliert.

## Korrektur

| Wert | Sektor III vorher | Sektor III jetzt | Sektor IV vorher | Sektor IV jetzt |
|---|---:|---:|---:|---:|
| Modellierte reguläre Gegner | 164 | 130 | 191 | 166 |
| Aktive Jäger | 137 | 31 | 151 | 38 |
| Lane-Verstärkungen | 0 | 72 | 0 | 88 |
| Gleichzeitige Gegner | 12 | 9 | 14 | 10 |
| Feindprojektile | 19 | 16 | 23 | 17 |

- Aktive Jäger starten nur noch von vorn oder aus dem oberen Seitenbereich.
- Ein Jäger bricht nach sechs Sekunden oder nach dem Kreuzen hinter dem Spieler
  ab und verlässt das Feld gerade, statt erneut zum Spieler zurückzukehren.
- Schwere Homing-Rollen sind aus dem Dauerstrom entfernt. Sie bleiben in den
  angekündigten Wave Cards und sind dadurch als besondere Gefahr lesbar.
- Der restliche Druckstrom folgt festen oberen und seitlichen Durchflug-Lanes.
- Sektor I und II bleiben bei ihrer zuvor bestätigten Dichte.

## Punkte

Die geringere Gegnerzahl wird ausschließlich über die sichtbare Sektorwertung
kompensiert. XP und Pickup-Chance verwenden weiterhin unveränderte Basiswerte.
Das deterministische vollständige Clear-Modell erreicht **60.070 Punkte**.

## Lesbare Elite-Kampfmomente

- Torpedo- und Support-Wellen warten, bis höchstens zwei Gegner aus der
  vorherigen Situation übrig sind.
- Während ihres neunsekündigen Elite-Fensters pausiert der normale
  Verstärkungsstrom vollständig.
- Beide Begegnungen haben ein eigenes Limit von vier gleichzeitigen Gegnern.
- Das Torpedoschiff besitzt jetzt 158 Hülle und 44 Schild statt 118/28, damit
  sein Zielkorridor nicht verschwindet, bevor der Spieler ihn lesen kann.
- Die Supportgruppe besteht nur noch aus dem Support, einem robusten
  Schutzpartner und einem Schützen. Dadurch ist das geschützte Ziel eindeutig.

## Prüfung

- Reliability-Check: bestanden
- Asset-Manifest: bestanden
- Browser-Vollrun: bestanden
- Sektor-III-Szene: 9 Gegner, 5 Projektile, Budgets 9/16
- Sektor-IV-Szene: 10 Gegner, 5 Projektile, Budgets 10/17
- Browser-, Konsolen- und Assetfehler: keine
- Menschlicher Folgerun: ausstehend
