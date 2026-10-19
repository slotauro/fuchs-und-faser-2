"""Gemeinsames Rig, Werkzeuge und Animationen aller Tierfiguren.

Alle Tiere nutzen dieselben Knochen und Aktionsnamen (Idle, Walk, Dig), damit das
Spiel jede Figur gleich behandeln kann. Teile werden starr an Knochen gebunden.
"""

import ff_common as ff

# Gleiche Proportionen für alle Tiere: ca. 0,85 m hoch, Blick nach -Y.
BONES = [
    ("root", (0, 0, 0), (0, 0, 0.12), None),
    ("body", (0, 0, 0.2), (0, 0, 0.46), "root"),
    ("head", (0, 0, 0.47), (0, 0, 0.8), "body"),
    ("arm.L", (0.15, 0, 0.43), (0.17, 0, 0.26), "body"),
    ("arm.R", (-0.15, 0, 0.43), (-0.17, 0, 0.26), "body"),
    ("leg.L", (0.075, 0, 0.2), (0.075, 0, 0.02), "root"),
    ("leg.R", (-0.075, 0, 0.2), (-0.075, 0, 0.02), "root"),
    ("tail", (0, 0.12, 0.24), (0, 0.3, 0.36), "body"),
    ("tool", (-0.17, -0.02, 0.26), (-0.17, -0.02, 0.36), "arm.R"),
]


class Builder:
    """Sammelt Teile je Knochen und bindet sie am Ende starr an das Rig."""

    def __init__(self, coll_name, prefix):
        self.c = ff.reset_collection(coll_name)
        self.prefix = prefix
        self.arm = ff.armature(self.c, f"{prefix}_rig", BONES)
        self.parts = {}

    def add(self, bone, obj):
        self.parts.setdefault(bone, []).append(obj)
        return obj

    def finish(self):
        for bone, objs in self.parts.items():
            ff.apply_transforms(objs)
            merged = ff.join(objs, f"{self.prefix}_{bone.replace('.', '_')}")
            ff.parent_to_bone(merged, self.arm, bone)
        return self.arm


def helmet(b, band_color):
    """Gelber Bauhelm mit Krempe, Kamm, Lampe und Band in der Teamfarbe des Tiers."""
    c = b.c
    yellow = ff.pmat("helmet", roughness=0.35)
    lamp = ff.material("ff_lamp", (1.0, 0.95, 0.7), emission=(1.0, 0.9, 0.6), emission_strength=2.0)
    b.add("head", ff.sphere(c, "helmet", (0, 0.0, 0.69), (0.15, 0.145, 0.13), yellow, rings=12))
    b.add("head", ff.sphere(c, "brim", (0, -0.035, 0.69), (0.165, 0.175, 0.018), yellow, rings=8))
    b.add("head", ff.box(c, "helmet_ridge", (0, 0.0, 0.8), (0.028, 0.22, 0.03), yellow, bevel=0.01))
    b.add("head", ff.torus(c, "helmet_band", (0, 0.0, 0.71), 0.148, 0.009, band_color))
    b.add("head", ff.sphere(c, "helmet_lamp", (0, -0.15, 0.735), (0.03, 0.018, 0.026), lamp))


def eyes(b, x, y, z, size=1.0):
    c = b.c
    eye = ff.pmat("eye", roughness=0.25)
    cream = ff.pmat("cream", roughness=0.8)
    for side, sx in (("L", x), ("R", -x)):
        b.add("head", ff.sphere(c, f"eye.{side}", (sx, y, z), (0.032 * size, 0.02 * size, 0.042 * size), eye))
        b.add("head", ff.sphere(c, f"eye_hi.{side}", (sx + 0.01 * size, y - 0.017 * size, z + 0.016 * size), (0.01 * size, 0.006, 0.011 * size), cream))


def limbs(b, fur, paw, leg, foot=None, arm_radius=0.042, paw_scale=1.0):
    c = b.c
    for side, x in (("L", 1), ("R", -1)):
        b.add(f"arm.{side}", ff.capsule(c, f"arm.{side}", (0.15 * x, 0, 0.42), (0.175 * x, -0.01, 0.29), arm_radius, fur))
        b.add(f"arm.{side}", ff.sphere(c, f"paw.{side}", (0.178 * x, -0.012, 0.265), (0.05 * paw_scale, 0.05 * paw_scale, 0.05 * paw_scale), paw))
        b.add(f"leg.{side}", ff.capsule(c, f"leg.{side}", (0.075 * x, 0, 0.19), (0.075 * x, 0, 0.06), 0.05, leg))
        b.add(f"leg.{side}", ff.sphere(c, f"foot.{side}", (0.075 * x, -0.03, 0.035), (0.058, 0.08, 0.04), foot or leg))


def belt(b, with_bag=True):
    c = b.c
    leather = ff.pmat("leather", roughness=0.6)
    b.add("body", ff.torus(c, "belt", (0, 0, 0.24), 0.148, 0.018, leather))
    if with_bag:
        b.add("body", ff.box(c, "bag", (0.14, -0.02, 0.22), (0.06, 0.09, 0.07), leather, bevel=0.012))
        b.add("body", ff.box(c, "bag_flap", (0.172, -0.02, 0.245), (0.012, 0.092, 0.035), ff.pmat("dark_brown"), bevel=0.004))


def tool(b, kind="shovel"):
    """Werkzeug in der rechten Pfote; nur in der Dig-Aktion sichtbar."""
    c = b.c
    wood = ff.pmat("wood", roughness=0.7)
    steel = ff.pmat("steel", roughness=0.35, metallic=0.6)
    b.add("tool", ff.cylinder(c, "tool_handle", (-0.17, -0.02, 0.29), 0.012, 0.36, wood, vertices=10))
    if kind == "shovel":
        b.add("tool", ff.box(c, "shovel_blade", (-0.17, -0.02, 0.07), (0.1, 0.012, 0.11), steel, bevel=0.01))
        b.add("tool", ff.cylinder(c, "shovel_grip", (-0.17, -0.02, 0.47), 0.03, 0.02, wood, vertices=12, rotation=(1.5708, 0, 0)))
    elif kind == "pickaxe":
        b.add("tool", ff.cone(c, "pick_a", (-0.17, -0.1, 0.12), 0.025, 0.004, 0.18, steel, vertices=8, rotation=(1.5708, 0, 0)))
        b.add("tool", ff.cone(c, "pick_b", (-0.17, 0.06, 0.12), 0.025, 0.004, 0.14, steel, vertices=8, rotation=(-1.5708, 0, 0)))
        b.add("tool", ff.box(c, "pick_head", (-0.17, -0.02, 0.12), (0.04, 0.06, 0.05), steel, bevel=0.008))
    elif kind == "hammer":
        b.add("tool", ff.box(c, "hammer_head", (-0.17, -0.02, 0.12), (0.06, 0.15, 0.06), steel, bevel=0.01))
    elif kind == "claws":
        # Der Maulwurf gräbt mit den Pfoten; ein kleiner Spaten am Gürtel.
        b.add("tool", ff.box(c, "spade_blade", (-0.17, -0.02, 0.1), (0.08, 0.012, 0.08), steel, bevel=0.01))


def animate(arm):
    """Idle, Walk und Dig für das gemeinsame Rig."""
    hidden = (0.001, 0.001, 0.001)

    ff.new_action(arm, "Idle", 48)
    for f, bob, head, tail in ((1, 0, 0, -8), (13, 0.012, 4, 0), (25, 0, 0, 8), (37, 0.012, -4, 0), (48, 0, 0, -8)):
        ff.key(arm, "body", f, loc=(0, bob, 0))
        ff.key(arm, "head", f, rot=(0, head, 0))
        ff.key(arm, "tail", f, rot=(0, 0, tail))
        ff.key(arm, "tool", f, scale=hidden)

    ff.new_action(arm, "Walk", 16)
    for f, swing, bob in ((1, 1, 0), (5, 0, 0.03), (9, -1, 0), (13, 0, 0.03), (16, 1, 0)):
        ff.key(arm, "leg.L", f, rot=(35 * swing, 0, 0))
        ff.key(arm, "leg.R", f, rot=(-35 * swing, 0, 0))
        ff.key(arm, "arm.L", f, rot=(-30 * swing, 0, 0))
        ff.key(arm, "arm.R", f, rot=(30 * swing, 0, 0))
        ff.key(arm, "root", f, loc=(0, bob, 0))
        ff.key(arm, "body", f, rot=(0, 4 * swing, 0))
        ff.key(arm, "tail", f, rot=(0, 0, 12 * swing))
        ff.key(arm, "tool", f, scale=hidden)

    ff.new_action(arm, "Dig", 20)
    for f, arms, lean, head in ((1, -20, 0, 0), (6, -75, 18, 10), (11, -70, 22, 14), (16, 20, -4, -6), (20, -20, 0, 0)):
        ff.key(arm, "arm.L", f, rot=(arms, 0, 0))
        ff.key(arm, "arm.R", f, rot=(arms, 0, 0))
        ff.key(arm, "body", f, rot=(lean, 0, 0))
        ff.key(arm, "head", f, rot=(head, 0, 0))
        ff.key(arm, "tail", f, rot=(0, 0, 10 if f % 2 else -10))
        ff.key(arm, "tool", f, scale=(1, 1, 1))

    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
