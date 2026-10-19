"""Fuchs – der clevere Planer. Orangefarbenes Fell, weiße Brust, buschiger Schwanz, Bauhelm und Werkzeugtasche."""

import ff_character as ch
import ff_common as ff

COLL = "ff_fox"


def build():
    b = ch.Builder(COLL, "fox")
    c = b.c
    orange = ff.pmat("fox_orange", roughness=0.75)
    cream = ff.pmat("cream", roughness=0.8)
    dark = ff.pmat("dark_brown", roughness=0.8)
    eye = ff.pmat("eye", roughness=0.25)

    b.add("body", ff.sphere(c, "body", (0, 0, 0.33), (0.16, 0.14, 0.17), orange))
    b.add("body", ff.sphere(c, "belly", (0, -0.065, 0.31), (0.11, 0.08, 0.13), cream))
    ch.belt(b)

    b.add("head", ff.sphere(c, "head", (0, -0.01, 0.6), (0.19, 0.17, 0.16), orange))
    b.add("head", ff.sphere(c, "cheek.L", (0.085, -0.1, 0.55), (0.085, 0.07, 0.065), cream))
    b.add("head", ff.sphere(c, "cheek.R", (-0.085, -0.1, 0.55), (0.085, 0.07, 0.065), cream))
    b.add("head", ff.sphere(c, "snout", (0, -0.165, 0.555), (0.06, 0.075, 0.05), cream))
    b.add("head", ff.sphere(c, "nose", (0, -0.235, 0.57), (0.026, 0.022, 0.02), eye))
    ch.eyes(b, 0.072, -0.143, 0.618)
    for side, ex, tilt in (("L", 0.13, 0.55), ("R", -0.13, -0.55)):
        # Spitze Ohren stehen seitlich schräg aus dem Helm heraus.
        b.add("head", ff.cone(c, f"ear.{side}", (ex, 0.0, 0.76), 0.06, 0.0, 0.17, orange, rotation=(0.1, tilt, 0)))
        b.add("head", ff.cone(c, f"ear_tip.{side}", (ex * 1.3, 0.0, 0.825), 0.03, 0.0, 0.06, dark, rotation=(0.1, tilt, 0)))
        b.add("head", ff.cone(c, f"ear_in.{side}", (ex * 0.98, -0.03, 0.75), 0.033, 0.0, 0.11, cream, rotation=(0.3, tilt, 0)))
    ch.helmet(b, ff.pmat("fiber", roughness=0.4))

    ch.limbs(b, orange, dark, dark)

    b.add("tail", ff.sphere(c, "tail_base", (0, 0.17, 0.26), (0.07, 0.1, 0.07), orange))
    b.add("tail", ff.sphere(c, "tail_mid", (0, 0.27, 0.33), (0.1, 0.12, 0.1), orange))
    b.add("tail", ff.sphere(c, "tail_tip", (0, 0.35, 0.42), (0.075, 0.08, 0.08), cream))

    ch.tool(b, "shovel")
    return b.finish()


def main(export=True):
    arm = build()
    ch.animate(arm)
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "characters/fox.glb")
    return None
