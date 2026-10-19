# Fuchs und Faser 2

Ein 3D-Browsergame: Tierische Bauarbeiter schließen unter Zeitdruck Häuser ans Glasfasernetz an. Ihr grabt Gräben, holt Kabel von der Trommel, verlegt es vom Netzverteiler bis zum Hausanschluss und schaltet das Haus online, allein oder im Online-Koop mit 2–4 Spielern.

Alle zentralen 3D-Modelle (Tiere, Haus, Verteiler, Bodenkacheln usw.) sind mit Blender über Blender MCP entstanden und liegen als GLB im Projekt. Siehe [tools/blender/README.md](tools/blender/README.md).

## Schnellstart

Voraussetzung: Node.js 20+ und npm.

```bash
npm install
npm run dev
```

Danach <http://localhost:5173> öffnen. `npm run dev` startet den Client (Vite, Port 5173) und den Multiplayer-Server (Port 3001) zusammen. Für den Singleplayer wird der Server nicht benötigt.

Koop testen: Im Hauptmenü **Online-Koop erstellen**, dann den Raumcode oder den Einladungslink in einem zweiten Browserfenster (oder einem privaten Fenster) öffnen.

## Steuerung

| Taste | Aktion |
| --- | --- |
| W A S D / Pfeiltasten | laufen |
| E / Leertaste | arbeiten: graben, Fels brechen, Schacht setzen, Kabel holen, Kabel verlegen, Haus anschließen |
| F | Spezialfähigkeit |
| Esc | Pause (im Koop: Menü, die Zeit läuft weiter) |

Ein Rahmen auf dem Boden zeigt die Zielkachel, unten in der Mitte steht, was `E` gerade tun würde.

## So läuft eine Runde

1. Ein Graben muss an den Verteiler oder an schon verlegtes Kabel anschließen.
2. An der Kabeltrommel Kabel holen (höchstens 6 Stück, mit Kabel läuft man etwas langsamer).
3. Kabel in den Graben legen, Kachel für Kachel bis zum gepflasterten Hausanschlusspunkt.
4. Am Anschlusspunkt (oder am Haus) `E`: Das Haus geht online, die Fenster leuchten, ein Lichtimpuls läuft durchs Kabel.

Hindernisse: Felsen erst brechen, Wurzeln brauchen länger, Straßen brauchen einen Kabelschacht, Wasser ist tabu. Vorhandene Leerrohre sparen das Graben, manche sind verborgen (Fuchs-Spürnase oder einfach darauf graben).

| Tier | Fähigkeit |
| --- | --- |
| Fuchs | Spürnase: deckt Leerrohre in der Nähe auf und zeigt eine günstige Trasse (einmal pro Auftrag) |
| Maulwurf | Schnellbuddeln: 6 s lang fast dreimal so schnell graben |
| Biber | Express-Schacht: nächster Kabelschacht in 0,5 s |
| Dachs | Felsenknacker: nächster Fels in 0,6 s |

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklung: Client und Server mit Hot Reload |
| `npm test` | Unit- und Integrationstests (Vitest) |
| `npm run test:e2e` | Browsertests (Playwright; startet `npm run dev`, falls nicht schon laufend) |
| `npm run typecheck` | TypeScript-Prüfung aller Pakete |
| `npm run build` | Client für den Produktivbetrieb bauen |
| `npm start` | Produktivserver: Client und Socket.IO auf einem Port (`PORT`, Standard 3001) |

Vor dem ersten E2E-Lauf einmalig: `npx playwright install chromium`.

Hilfsseiten im Entwicklungsmodus:

- <http://localhost:5173/?view=assets>: alle GLB-Modelle auf einem 1×1-Raster mit Maßen und Animationen
- <http://localhost:5173/?map=test&animal=fox>: direkt in eine Karte starten (`map` = `erste-baustelle`, `wurzelweg`, `bachsiedlung`, `test`)

## Projektstruktur

```
shared/   Spielregeln in reinem TypeScript (kein DOM, kein three):
          Kacheln, Bewegung, Arbeiten, Kabel, Netzprüfung, Fähigkeiten, Wertung, Karten, Protokoll
client/   Vite + Three.js + HTML/CSS
          src/rendering  Szene, Kamera, Gelände, Kabel, Figuren, Effekte
          src/assets     GLB-Laden (AssetManager)
          src/controller Singleplayer (LocalController) und Koop (NetworkController)
          src/ui         Menü, Lobby, HUD, Ergebnis
          public/models  aus Blender exportierte GLB-Dateien
server/   Node.js + Socket.IO: Räume, maßgebliche Simulation, Validierung
tools/    blender/ (Asset-Skripte, .blend, Workflow), inspect/ (GLB- und Screenshot-Helfer)
e2e/      Playwright-Tests
docs/     Designentscheidungen
```

Spielregeln, Darstellung und Assets sind getrennt. `shared/src/simulation.ts` enthält `step(state, inputs, dt)` und `applyAction(state, action)`. Im Singleplayer laufen sie im Browser, im Koop nur auf dem Server. Three.js stellt nur den Zustand dar und entscheidet nichts. Modelle lassen sich deshalb in Blender überarbeiten, ohne die Spielmechanik anzufassen.

## Tests

- `shared/test`: Bewegung, Eckenhilfe, Graben, Kabelbestand ohne Doppelverbrauch, Straßen und Leerrohre, Netzprüfung, Punkte genau einmal, Zeitablauf, Pause, alle vier Fähigkeiten. Dazu ein Bot, der jede Karte allein und ohne Fähigkeiten über die echten Regeln löst.
- `server/test`: Raumcodes, Raumgröße, Tierwahl, Host-Rechte, Synchronisation, doppelte Aktionen, Wiederbeitritt, Aufräumen, Validierung, Rate-Limit sowie ein echter Socket.IO-Durchlauf mit zwei Clients.
- `e2e`: Asset-Seite, Menüstart, eine komplette Singleplayer-Runde per Tastatur, Pause, zwei Browser im Koop (inklusive Neuladen und Wiederbeitritt).

## Bekannte Einschränkungen

- Räume liegen nur im Arbeitsspeicher des Servers; ein Neustart beendet alle Räume. Neue Spieler können erst in der nächsten Runde dazukommen.
- Bodenverformung ist vereinfacht: Ein Graben ist eine eigene Bodenkachel, keine echte Verformung.
- Im Koop wird nur die eigene Bewegung vorhergesagt; bei hoher Latenz können fremde Figuren leicht nachlaufen.
- Bei sehr niedriger Bildrate läuft die Spielzeit langsamer als die Echtzeit (Schutz vor Sprüngen). Für schwache Rechner gibt es in den Einstellungen „Schonende Grafik“.
- Nur Tastatursteuerung; Touch und Gamepad sind nicht umgesetzt.
- Soundeffekte werden per WebAudio erzeugt; es gibt keine Musik.
