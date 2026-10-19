"""Kabeltrommel als Materialstation: Holztrommel mit orangem Kabel auf einer Palette."""

import math

import ff_common as ff

COLL = "ff_cable_spool"


def build():
    c = ff.reset_collection(COLL)
    wood = ff.pmat("wood", roughness=0.8)
    wood_dark = ff.material("ff_wood_dark", (0.4, 0.25, 0.13), roughness=0.85)
    fiber = ff.pmat("fiber", roughness=0.35)
    steel = ff.pmat("steel", roughness=0.35, metallic=0.7)
    sign = ff.material("ff_sticker", (0.98, 0.97, 0.93), roughness=0.5)

    # Palette.
    for y in (-0.3, 0.0, 0.3):
        ff.box(c, f"pallet_board_{y}", (0, y, 0.09), (0.86, 0.16, 0.03), wood, bevel=0.008)
    for x in (-0.35, 0.0, 0.35):
        ff.box(c, f"pallet_block_{x}", (x, 0, 0.04), (0.12, 0.76, 0.07), wood_dark, bevel=0.008)

    # Trommel liegt mit der Achse entlang X.
    r_flange, axle_z = 0.36, 0.11 + 0.36
    for x in (-0.24, 0.24):
        ff.cylinder(c, f"flange_{x}", (x, 0, axle_z), r_flange, 0.05, wood, vertices=28, rotation=(0, math.pi / 2, 0))
        ff.cylinder(c, f"hub_{x}", (x * 1.12, 0, axle_z), 0.06, 0.03, steel, vertices=16, rotation=(0, math.pi / 2, 0))
        for k in range(6):
            a = k * math.pi / 3
            ff.cylinder(c, f"bolt_{x}_{k}", (x * 1.1, math.cos(a) * 0.2, axle_z + math.sin(a) * 0.2), 0.015, 0.02, steel, vertices=8, rotation=(0, math.pi / 2, 0))
    ff.cylinder(c, "core", (0, 0, axle_z), 0.2, 0.44, wood_dark, vertices=24, rotation=(0, math.pi / 2, 0))
    # Kabelwicklungen.
    for i in range(7):
        x = -0.18 + i * 0.06
        ff.torus(c, f"wind_{i}", (x, 0, axle_z), 0.26, 0.032, fiber, rotation=(0, math.pi / 2, 0), major_segments=28, minor_segments=8)
    # Loses Kabelende.
    ff.capsule(c, "loose_end", (0.1, -0.27, axle_z - 0.08), (0.18, -0.4, 0.13), 0.025, fiber, segments=10)
    # Schild.
    ff.box(c, "sign_post", (0.42, -0.3, 0.3), (0.03, 0.03, 0.5), wood_dark)
    ff.box(c, "sign", (0.42, -0.31, 0.56), (0.2, 0.02, 0.14), sign, bevel=0.01)
    ff.box(c, "sign_stripe", (0.42, -0.323, 0.56), (0.16, 0.01, 0.04), fiber)
    ff.join_all(c, "cable_spool")


def main(export=True):
    build()
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "infrastructure/cable-spool.glb")
