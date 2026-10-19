# Blender-MCP-Workflow

Alle zentralen 3D-Assets von Fuchs und Faser 2 werden mit Python-Skripten im laufenden Blender gebaut. Claude Code steuert Blender dabei über Blender MCP. Die Skripte liegen hier, die exportierten GLB-Dateien unter `client/public/models/`, die Arbeitsdatei unter `scenes/fiber-frenzy-assets.blend`.

## Verfügbare Werkzeuge (geprüft)

Blender 5.2.2 LTS mit dem Add-on „Blender MCP“ 1.8. Genutzt wurden:

| Werkzeug | Zweck im Projekt |
| --- | --- |
| `get_addon_status` | Version und freigeschaltete Bibliotheken/Generatoren prüfen |
| `get_scene_info` | Objekte, Größen, Hierarchie kontrollieren |
| `execute_blender_code` | Skripte aus diesem Ordner ausführen, Exporteinstellungen prüfen, exportieren |
| `look` | Sichtprüfung: Ansichten von vorne, seitlich, schräg sowie Animations-Frames |

Nicht genutzt bzw. nicht verfügbar:

- Asset-Bibliotheken (Poly Haven, Sketchfab, Poly Pizza) und 3D-Generatoren waren im Add-on ausgeschaltet. Alle Modelle sind deshalb selbst modelliert. Das hat Vorteile: Die Modelle sind reproduzierbar, haben einen einheitlichen Stil, und es gibt keine Lizenzfragen.
- Es gibt keine `blender`-Kommandozeile im Pfad. Der Export läuft deshalb im laufenden Blender über `bpy.ops.export_scene.gltf`.

## Konventionen

- 1 Blender-Meter = 1 Kachel = 1 Welteinheit in Three.js.
- Modelle schauen nach −Y (Blender-Frontansicht); der glTF-Export macht daraus +Z, also zur Spielkamera.
- Ursprung unten mittig auf z = 0. Statische Assets werden zu einem Objekt zusammengefügt, ihre Transformationen werden übernommen.
- Nur Principled-BSDF-Grundfarben, keine Bildtexturen, keine UVs im Export. Farben zentral in `ff_common.PALETTE`.
- Materialien mit Sonderrolle im Spiel: `ff_window` (Fenster leuchten beim Anschluss) und `ff_socket_led` (Anschluss-LED wird grün).
- Figuren: gemeinsames Rig aus `ff_character.py` (Knochen `root`, `body`, `head`, `arm.L/R`, `leg.L/R`, `tail`, `tool`). Die Teile sind starr an Knochen gebunden. Aktionen `Idle`, `Walk` und `Dig`, das Werkzeug ist nur in `Dig` sichtbar (Skalierung des `tool`-Knochens).

## Ablauf

In Blender (über `execute_blender_code`):

```python
import sys, importlib
S = "/Pfad/zu/fiber frenzy/tools/blender/scripts"
sys.path.insert(0, S)
import ff_common, fox
ff_common.stage()      # Prüfbühne: Kachelraster, Sonne, Ortho-Kamera im Spielwinkel
fox.main(export=False) # bauen, dann mit `look` prüfen
fox.main(export=True)  # nach client/public/models/characters/fox.glb exportieren
```

Jedes Skript ist beliebig oft ausführbar: Es leert seine Collection und baut neu.

| Skript | Ausgabe |
| --- | --- |
| `fox.py`, `mole.py`, `beaver.py`, `badger.py` | `characters/*.glb` (mit Animationen) |
| `house.py` | `buildings/house.glb` (2×2 Kacheln) |
| `distributor.py`, `socket.py`, `manhole.py`, `cable_coil.py`, `cable_spool.py` | `infrastructure/*.glb` |
| `rock.py`, `tree.py`, `ground_tiles.py` | `environment/*.glb` |

Danach im Browser prüfen: <http://localhost:5173/?view=assets> zeigt alle Modelle mit gemessener Größe, Bodenlage und Animationsliste. `node tools/inspect/glb-info.mjs client/public/models/*/*.glb` listet Animationen, Materialien und Höhen ohne Browser.

Probleme werden im Skript behoben, nicht im Spiel durch Skalierung oder Verschiebung kaschiert.

## Erfahrungen

- Ausgeblendete Collections lassen sich weder auswählen noch zusammenfügen; der Export wäre leer. `reset_collection` blendet deshalb immer ein, und `export_glb` bricht ab, wenn nichts ausgewählt ist.
- Nach `join` liegt der Ursprung beim ersten Teil; `join_all` übernimmt deshalb die Transformationen.
- Mehrsegmentige Fasen und UV-Daten blähen GLBs stark auf. Bodenkacheln nutzen ein Fasensegment, UVs werden nicht exportiert (Bodenkacheln: 787 kB → 137 kB).
