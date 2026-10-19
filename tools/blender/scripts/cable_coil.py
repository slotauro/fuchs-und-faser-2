"""Getragene Glasfaser-Rolle (Bündel), ca. 0,3 m Durchmesser. Ursprung unten mittig."""

import ff_common as ff

COLL = "ff_cable_coil"


def build():
    c = ff.reset_collection(COLL)
    fiber = ff.pmat("fiber", roughness=0.35)
    tape = ff.material("ff_tape", (0.15, 0.15, 0.17), roughness=0.6)
    for i in range(4):
        ff.torus(c, f"loop_{i}", (0, 0, 0.15 + (i - 1.5) * 0.012), 0.12 + (i % 2) * 0.008, 0.022, fiber, rotation=(1.5708, 0, 0.05 * i))
    for angle in (0.0, 2.1, 4.2):
        import math
        x, z = math.cos(angle) * 0.125, math.sin(angle) * 0.125 + 0.15
        ff.box(c, f"tape_{angle}", (x, 0, z), (0.03, 0.08, 0.03), tape, rotation=(0, -angle, 0))
    ff.join_all(c, "cable_coil")


def main(export=True):
    build()
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "infrastructure/cable-coil.glb")
