"""Dachs – der Kraftprotz. Schwarz-weiße Gesichtsmaske, robuster grauer Körper, Spitzhacke."""

import ff_character as ch
import ff_common as ff

COLL = "ff_badger"


def build():
    b = ch.Builder(COLL, "badger")
    c = b.c
    grey = ff.material("ff_badger_grey", (0.6, 0.6, 0.6), roughness=0.85)
    white = ff.material("ff_badger_white", (0.97, 0.96, 0.94), roughness=0.8)
    black = ff.material("ff_badger_black", (0.12, 0.12, 0.13), roughness=0.8)
    team = ff.material("ff_team_badger", (0.88, 0.28, 0.42), roughness=0.4)

    # Breiter, kräftiger Rumpf.
    b.add("body", ff.sphere(c, "body", (0, 0, 0.33), (0.19, 0.16, 0.18), grey))
    b.add("body", ff.sphere(c, "chest", (0, -0.075, 0.31), (0.12, 0.08, 0.13), ff.material("ff_badger_chest", (0.8, 0.8, 0.79), roughness=0.85)))
    ch.belt(b)

    # Weißer Kopf, zwei schwarze Streifen von der Nase über die Augen bis hinter die Ohren.
    b.add("head", ff.sphere(c, "head", (0, -0.01, 0.59), (0.185, 0.17, 0.155), white))
    b.add("head", ff.sphere(c, "snout", (0, -0.165, 0.55), (0.065, 0.09, 0.052), white))
    b.add("head", ff.sphere(c, "nose", (0, -0.25, 0.563), (0.032, 0.024, 0.024), black))
    b.add("head", ff.sphere(c, "jaw", (0, -0.05, 0.5), (0.15, 0.12, 0.07), grey))
    for side, x in (("L", 1), ("R", -1)):
        b.add("head", ff.capsule(c, f"stripe.{side}", (0.042 * x, -0.2, 0.585), (0.07 * x, -0.07, 0.725), 0.034, black, segments=14))
        b.add("head", ff.sphere(c, f"ear.{side}", (0.155 * x, 0.03, 0.68), (0.04, 0.028, 0.038), black))
        b.add("head", ff.sphere(c, f"ear_rim.{side}", (0.158 * x, 0.022, 0.703), (0.03, 0.02, 0.016), white))
    # Augen sitzen im Streifen; nur der Glanzpunkt hebt sich ab.
    ch.eyes(b, 0.072, -0.165, 0.615, size=0.85)
    ch.helmet(b, team)

    ch.limbs(b, grey, black, black, arm_radius=0.05, paw_scale=1.15)

    b.add("tail", ff.sphere(c, "tail", (0, 0.17, 0.25), (0.06, 0.08, 0.05), grey))

    ch.tool(b, "pickaxe")
    return b.finish()


def main(export=True):
    arm = build()
    ch.animate(arm)
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "characters/badger.glb")
    return None
