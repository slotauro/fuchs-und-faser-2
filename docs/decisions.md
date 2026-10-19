# Designentscheidungen

Wo das PRD Spielraum ließ, wurde die einfachste gut spielbare Lösung gewählt. Die Zahlen stehen zentral in `shared/src/terrain.ts`, `abilities.ts` und `scoring.ts`.

## Welt und Kamera

- Raster aus Kacheln mit 1 Welteinheit Kantenlänge. Figuren bewegen sich frei, Arbeiten beziehen sich immer auf ganze Kacheln.
- Feste, schräge Orthokamera von vorne (36° über dem Horizont, keine Drehung). Dadurch zeigen W/A/S/D genau nach oben, links, unten und rechts auf dem Bildschirm.
- Bäume und Häuser, die eine Figur verdecken, werden halbtransparent.

## Interaktion

- Ziel ist die Nachbarkachel der eigenen Kachel in Blickrichtung (kachelbasiert, nicht positionsbasiert, damit die Markierung berechenbar ist).
- Steht die Figur mit Kabel in einem Graben ohne Kabel, wird zuerst dort verlegt.
- Ist vorne gar nichts zu tun (oder schon alles erledigt), wirkt `E` auf die eigene Kachel; so kann man auf der Stelle graben.
- Eckenhilfe: Ist der Weg nur knapp blockiert, weil die Figur seitlich versetzt steht, rutscht sie zur Spurmitte.
- Ein kurzes Antippen einer Richtung dreht die Figur immer. Die Eingabe wirkt mindestens einen Simulationsschritt lang und wird vor einer Aktion angewendet.

## Regeln

| Kachel | Regel |
| --- | --- |
| Wiese | 1 s graben |
| Wurzeln | 2,5 s graben |
| Fels | erst 3 s brechen (wird zu Schotter), dann 0,8 s graben |
| Straße | nicht grabbar; Kabelschacht 3 s, dann Kabel darauf |
| Leerrohr | Kabel ohne Graben; verborgene Leerrohre werden durch Graben oder die Fuchs-Spürnase sichtbar |
| Wasser, Bäume, Gebäude | gesperrt |

- Kabel muss an den Verteiler oder an schon verlegtes Kabel angrenzen. Eine Netzprüfung (Breitensuche vom Verteiler) entscheidet beim Anschluss.
- Höchstens 6 Kabel tragen, Kartenbestand begrenzt. Doppelte Aktionen (gleiche `actionId`) wirken nur einmal; eine schon verkabelte Kachel lässt sich nicht noch einmal belegen.
- Arbeiten werden beim Abschluss erneut geprüft, weil Mitspieler den Zustand inzwischen geändert haben können.
- Wertung: 100 Punkte je Haus (genau einmal), bei Sieg zusätzlich 2 Punkte je Restsekunde und 5 je übrigem Kabel.
- Jede Karte ist allein und ohne Fähigkeiten in höchstens 75 % der Zeit lösbar (Bot-Test in `shared/test`).

## Fähigkeiten

Die Fähigkeiten sind unterschiedlich, aber keine ist nötig.

| Tier | Umsetzung |
| --- | --- |
| Fuchs | Einmal pro Auftrag: Leerrohre im Umkreis von 4 Kacheln aufdecken, günstigste Trasse (Dijkstra nach Arbeitszeit) 10 s als Spur zeigen |
| Maulwurf | 6 s Grabdauer × 0,35, Abklingzeit 25 s |
| Biber | Scharf schalten; der nächste Kabelschacht dauert 0,5 s. Abklingzeit 25 s |
| Dachs | Scharf schalten; der nächste Fels dauert 0,6 s. Abklingzeit 25 s |

## Multiplayer

- Der Server ist maßgeblich und führt dieselbe `step()`-Funktion mit 20 Hz aus. Kacheln werden nur bei Änderung mitgeschickt.
- Clients schicken Laufrichtung und Aktionen (mit `actionId` und der aktuellen Blickrichtung). Die eigene Bewegung wird lokal vorhergesagt und sanft zur Serverposition korrigiert.
- Raumcodes: 6 Zeichen ohne verwechselbare Zeichen, erzeugt mit `crypto.randomInt`. Jedes Tier gibt es pro Raum einmal; ist das gewünschte vergeben, gibt es das erste freie.
- Der Host startet ab zwei verbundenen Spielern. Fällt der Host weg, übernimmt ein anderer.
- Wiederbeitritt per Token in `sessionStorage`. Lobby-Plätze bleiben 60 s reserviert, leere Räume werden nach 5 Minuten gelöscht.
- Schutz: Validierung aller Nutzdaten, Rate-Limit (Aktionen 10/s, Eingaben 40/s), maximale Nachrichtengröße 32 kB.

## Grafik

- Alle zentralen Modelle stammen aus Blender (siehe `tools/blender/README.md`). Die Glasfaser selbst wird zur Laufzeit als Röhre zwischen den Kachelmitten erzeugt, weil ihre Form vom Spielstand abhängt.
- Bodenkacheln sind Blender-Geometrie und werden in Three.js instanziert.
- Die HUD ist HTML/CSS über der Szene. Die Tierporträts in Menü und Lobby werden beim Start aus den echten 3D-Modellen gerendert.
- „Animationen reduzieren“ schaltet Partikel, Überblendungen und Pulsieren ab; „Schonende Grafik“ schaltet Schatten und Kantenglättung ab.
