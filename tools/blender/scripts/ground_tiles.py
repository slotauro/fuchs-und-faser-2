"""Bodenkacheln (1 × 1 m, Oberkante bei z = 0) als ein GLB mit benannten Objekten.

Das Spiel nutzt jede Kachel als Vorlage für InstancedMesh. Jede Kachel ist ein
eigenes Objekt mit Ursprung in der Kachelmitte; die Objekte liegen im Export
nebeneinander, das Spiel liest nur Geometrie und Material.
"""

import math
import random

import ff_common as ff

COLL = "ff_ground"
DEPTH = 0.25


def slab(c, name, mat, top=0.0, size=1.0):
    return ff.box(c, name, (0, 0, top - DEPTH / 2), (size, size, DEPTH), mat, bevel=0.03, segments=1)


def tile(c, name, parts):
    """Fügt Teile zu einer Kachel zusammen und legt den Ursprung in die Mitte."""
    obj = ff.join(parts, name)
    for mod in list(obj.modifiers):
        ff.bpy.context.view_layer.objects.active = obj
        ff.bpy.ops.object.modifier_apply(modifier=mod.name)
    ff.bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def tufts(c, prefix, mat, rng, count, height=0.07):
    parts = []
    for i in range(count):
        x, y = rng.uniform(-0.38, 0.38), rng.uniform(-0.38, 0.38)
        parts.append(ff.cone(c, f"{prefix}_{i}", (x, y, height / 2), 0.035, 0.0, height, mat, vertices=5, smooth=False))
    return parts


def build():
    c = ff.reset_collection(COLL)
    rng = random.Random(7)
    grass = ff.material("ff_grass", (0.47, 0.73, 0.33), roughness=0.95)
    grass_alt = ff.material("ff_grass_alt", (0.43, 0.68, 0.3), roughness=0.95)
    blade = ff.material("ff_grass_blade", (0.36, 0.62, 0.25), roughness=0.9)
    earth = ff.material("ff_earth", (0.55, 0.38, 0.24), roughness=0.95)
    earth_dark = ff.material("ff_earth_dark", (0.36, 0.24, 0.15), roughness=0.95)
    root = ff.material("ff_root", (0.5, 0.33, 0.2), roughness=0.85)
    gravel = ff.material("ff_gravel", (0.66, 0.62, 0.56), roughness=0.95)
    pebble = ff.pmat("rock", roughness=0.9)
    asphalt = ff.material("ff_asphalt", (0.3, 0.31, 0.34), roughness=0.9)
    line = ff.material("ff_road_line", (0.97, 0.95, 0.88), roughness=0.7)
    curb = ff.material("ff_curb", (0.78, 0.77, 0.74), roughness=0.9)
    water = ff.material("ff_water", (0.25, 0.6, 0.85), roughness=0.08)
    bank = ff.material("ff_bank", (0.6, 0.52, 0.38), roughness=0.95)
    paving = ff.material("ff_paving", (0.82, 0.78, 0.7), roughness=0.9)
    steel = ff.pmat("dark_steel", roughness=0.5, metallic=0.5)
    fiber = ff.pmat("fiber", roughness=0.35)

    tile(c, "tile_grass", [slab(c, "g", grass)] + tufts(c, "gt", blade, rng, 3))
    tile(c, "tile_grass_alt", [slab(c, "ga", grass_alt)] + tufts(c, "gat", blade, rng, 2))

    # Wurzelzone: dunklere Erde, freiliegende Wurzelbögen.
    parts = [slab(c, "r", ff.material("ff_roots_ground", (0.42, 0.5, 0.27), roughness=0.95))]
    for i, (x, y, rot) in enumerate(((-0.15, -0.2, 0.3), (0.2, 0.1, -0.5), (-0.1, 0.25, 1.2))):
        parts.append(ff.torus(c, f"root_{i}", (x, y, -0.12), 0.18, 0.04, root, rotation=(math.pi / 2, 0, rot), major_segments=16, minor_segments=6))
    parts += tufts(c, "rt", blade, rng, 2)
    tile(c, "tile_roots", parts)

    # Schotter nach gebrochenem Fels.
    parts = [slab(c, "gr", gravel)]
    for i in range(9):
        parts.append(ff.sphere(c, f"pb_{i}", (rng.uniform(-0.38, 0.38), rng.uniform(-0.38, 0.38), 0.0), (0.05, 0.045, 0.03), pebble, segments=5, rings=3, smooth=False))
    tile(c, "tile_gravel", parts)

    # Straße mit Mittellinie entlang X; das Spiel dreht senkrechte Straßen.
    parts = [slab(c, "rd", asphalt, top=-0.02)]
    for x in (-0.3, 0.1):
        parts.append(ff.box(c, f"dash_{x}", (x, 0, -0.012), (0.24, 0.05, 0.02), line))
    for y in (-0.5, 0.5):
        parts.append(ff.box(c, f"curb_{y}", (0, y * 0.94, 0.0), (1.0, 0.06, 0.05), curb))
    tile(c, "tile_road", parts)
    tile(c, "tile_road_plain", [slab(c, "rp", asphalt, top=-0.02)])

    # Wasser liegt tiefer, mit Uferkante.
    tile(c, "tile_water", [slab(c, "wb", bank, top=-0.12), ff.box(c, "ws", (0, 0, -0.07), (1.0, 1.0, 0.04), water)])

    # Graben: Erdrand, dunkle Rinne in der Mitte, kleine Erdhaufen.
    parts = [slab(c, "tr", earth, top=-0.03)]
    parts.append(ff.box(c, "tr_pit", (0, 0, -0.05), (0.42, 0.42, 0.06), earth_dark))
    for i, (x, y) in enumerate(((-0.33, -0.33), (0.34, 0.3), (-0.3, 0.32))):
        parts.append(ff.sphere(c, f"tr_m{i}", (x, y, -0.01), (0.12, 0.1, 0.07), earth, segments=8, rings=5))
    tile(c, "tile_trench", parts)

    # Aufgedecktes Leerrohr: Wiese mit Abdeckplatte und orangem Markierer.
    parts = [slab(c, "co", grass_alt)]
    parts.append(ff.box(c, "co_plate", (0, 0, 0.005), (0.44, 0.44, 0.03), steel, bevel=0.01))
    parts.append(ff.box(c, "co_mark", (0, 0, 0.024), (0.3, 0.08, 0.01), fiber))
    tile(c, "tile_conduit", parts)

    # Pflaster für Anschlusspunkte und Wege.
    parts = [slab(c, "pv", paving)]
    for i in range(4):
        x, y = (i % 2 - 0.5) * 0.5, (i // 2 - 0.5) * 0.5
        parts.append(ff.box(c, f"pv_{i}", (x, y, 0.004), (0.46, 0.46, 0.012), paving, bevel=0.01))
    tile(c, "tile_paving", parts)

    # Im Export nebeneinander, damit die Vorschau lesbar bleibt (das Spiel nutzt nur die Geometrie).
    for i, obj in enumerate(sorted(c.objects, key=lambda o: o.name)):
        obj.location.x = (i % 5) * 1.2
        obj.location.y = (i // 5) * 1.2


def main(export=True):
    build()
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "environment/ground-tiles.glb")
