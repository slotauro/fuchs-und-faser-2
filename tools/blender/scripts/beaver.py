"""Biber – der Baumeister. Braunes Fell, Schneidezähne, flacher Kellenschwanz und Hammer."""

import math

import ff_character as ch
import ff_common as ff

COLL = "ff_beaver"


def build():
    b = ch.Builder(COLL, "beaver")
    c = b.c
    fur = ff.material("ff_beaver_fur", (0.55, 0.33, 0.17), roughness=0.85)
    tan = ff.material("ff_beaver_tan", (0.82, 0.64, 0.45), roughness=0.85)
    dark = ff.pmat("dark_brown", roughness=0.8)
    tooth = ff.material("ff_tooth", (1.0, 0.97, 0.9), roughness=0.3)
    tail = ff.material("ff_beaver_tail", (0.32, 0.27, 0.25), roughness=0.7)
    tail_line = ff.material("ff_beaver_tail_line", (0.24, 0.2, 0.19), roughness=0.7)
    team = ff.material("ff_team_beaver", (0.18, 0.6, 0.84), roughness=0.4)

    b.add("body", ff.sphere(c, "body", (0, 0, 0.33), (0.17, 0.15, 0.18), fur))
    b.add("body", ff.sphere(c, "belly", (0, -0.07, 0.31), (0.12, 0.08, 0.13), tan))
    ch.belt(b)

    b.add("head", ff.sphere(c, "head", (0, -0.01, 0.6), (0.18, 0.165, 0.16), fur))
    b.add("head", ff.sphere(c, "muzzle", (0, -0.14, 0.545), (0.1, 0.075, 0.065), tan))
    b.add("head", ff.sphere(c, "nose", (0, -0.205, 0.575), (0.035, 0.024, 0.024), dark))
    for x in (-0.017, 0.017):
        b.add("head", ff.box(c, f"tooth_{x}", (x, -0.19, 0.5), (0.03, 0.016, 0.05), tooth, bevel=0.006))
    ch.eyes(b, 0.07, -0.14, 0.625)
    for side, x in (("L", 1), ("R", -1)):
        b.add("head", ff.sphere(c, f"ear.{side}", (0.14 * x, 0.02, 0.7), (0.045, 0.03, 0.045), dark))
    ch.helmet(b, team)

    ch.limbs(b, fur, dark, dark)

    # Flacher, breiter Kellenschwanz mit Schuppenmuster.
    b.add("tail", ff.sphere(c, "tail_paddle", (0, 0.27, 0.14), (0.11, 0.17, 0.03), tail, rotation=(math.radians(-20), 0, 0)))
    for k in range(3):
        b.add("tail", ff.box(c, f"tail_line{k}", (0, 0.2 + k * 0.06, 0.168 - k * 0.022), (0.16 - k * 0.03, 0.008, 0.006), tail_line, rotation=(math.radians(-20), 0, 0)))

    ch.tool(b, "hammer")
    return b.finish()


def main(export=True):
    arm = build()
    ch.animate(arm)
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "characters/beaver.glb")
    return None
