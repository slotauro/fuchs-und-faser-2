"""Maulwurf – der Tunnelprofi. Kompakt, dunkles Samtfell, rosa Rüsselnase, große Grabpfoten."""

import ff_character as ch
import ff_common as ff

COLL = "ff_mole"


def build():
    b = ch.Builder(COLL, "mole")
    c = b.c
    fur = ff.material("ff_mole_fur", (0.32, 0.27, 0.3), roughness=0.9)
    fur_light = ff.material("ff_mole_belly", (0.48, 0.42, 0.44), roughness=0.9)
    pink = ff.material("ff_mole_pink", (0.98, 0.62, 0.66), roughness=0.6)
    team = ff.material("ff_team_mole", (0.54, 0.42, 0.82), roughness=0.4)

    # Rundlicher Körper, Kopf geht fast nahtlos in den Rumpf über.
    b.add("body", ff.sphere(c, "body", (0, 0, 0.32), (0.18, 0.16, 0.19), fur))
    b.add("body", ff.sphere(c, "belly", (0, -0.075, 0.3), (0.12, 0.08, 0.13), fur_light))
    ch.belt(b)

    b.add("head", ff.sphere(c, "head", (0, -0.01, 0.58), (0.18, 0.165, 0.155), fur))
    b.add("head", ff.sphere(c, "muzzle", (0, -0.15, 0.55), (0.075, 0.09, 0.06), fur_light))
    b.add("head", ff.sphere(c, "snout", (0, -0.235, 0.55), (0.04, 0.06, 0.035), pink))
    b.add("head", ff.sphere(c, "nose", (0, -0.29, 0.555), (0.034, 0.024, 0.03), pink))
    for side, x in (("L", 1), ("R", -1)):
        b.add("head", ff.sphere(c, f"whisker_pad.{side}", (0.035 * x, -0.21, 0.535), (0.028, 0.025, 0.022), fur_light))
    # Kleine Augen hinter runden Bauleiter-Brillengläsern.
    ch.eyes(b, 0.065, -0.15, 0.62, size=0.7)
    glass = ff.material("ff_glasses", (0.15, 0.15, 0.17), roughness=0.3, metallic=0.4)
    for side, x in (("L", 0.065), ("R", -0.065)):
        b.add("head", ff.torus(c, f"glasses.{side}", (x, -0.155, 0.62), 0.04, 0.008, glass, rotation=(1.5708, 0, 0), major_segments=20, minor_segments=6))
    b.add("head", ff.box(c, "glasses_bridge", (0, -0.16, 0.625), (0.05, 0.008, 0.008), glass))
    ch.helmet(b, team)

    # Große rosa Grabpfoten, kurze Beine.
    ch.limbs(b, fur, pink, fur, foot=pink, arm_radius=0.046, paw_scale=1.45)
    for side, x in (("L", 1), ("R", -1)):
        for k in range(3):
            b.add(f"arm.{side}", ff.cone(c, f"claw.{side}{k}", (0.178 * x + (k - 1) * 0.025, -0.06, 0.225), 0.012, 0.0, 0.05, ff.pmat("cream"), vertices=6, rotation=(2.6, 0, 0)))

    b.add("tail", ff.capsule(c, "tail", (0, 0.15, 0.24), (0, 0.22, 0.28), 0.022, pink, segments=10))

    ch.tool(b, "claws")
    return b.finish()


def main(export=True):
    arm = build()
    ch.animate(arm)
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "characters/mole.glb")
    return None
