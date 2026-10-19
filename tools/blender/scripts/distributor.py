"""Netzverteiler (Glasfaser-Verteilerschrank) auf einer Kachel. Front nach -Y."""

import ff_common as ff

COLL = "ff_distributor"


def build():
    c = ff.reset_collection(COLL)
    body = ff.pmat("cabinet", roughness=0.55)
    trim = ff.material("ff_cabinet_dark", (0.2, 0.36, 0.28), roughness=0.5)
    concrete = ff.material("ff_concrete", (0.72, 0.71, 0.68), roughness=0.95)
    fiber = ff.pmat("fiber", roughness=0.35)
    led = ff.material("ff_led_green", (0.3, 1.0, 0.45), emission=(0.3, 1.0, 0.45), emission_strength=3.0)
    sticker = ff.material("ff_sticker", (0.98, 0.97, 0.93), roughness=0.5)

    ff.box(c, "plinth", (0, 0, 0.06), (0.78, 0.5, 0.12), concrete, bevel=0.02)
    ff.box(c, "cabinet", (0, 0, 0.12 + 0.42), (0.66, 0.4, 0.84), body, bevel=0.03)
    ff.box(c, "cap", (0, 0, 0.12 + 0.86), (0.74, 0.48, 0.06), trim, bevel=0.02)
    # Zwei Türen mit Fuge und Griffen.
    ff.box(c, "seam", (0, -0.202, 0.54), (0.012, 0.01, 0.76), trim)
    for x in (-0.06, 0.06):
        ff.box(c, f"handle_{x}", (x, -0.215, 0.6), (0.02, 0.025, 0.12), ff.pmat("steel", roughness=0.3, metallic=0.8), bevel=0.005)
    # Lüftungsschlitze.
    for i in range(4):
        ff.box(c, f"vent_{i}", (-0.18, -0.203, 0.25 + i * 0.04), (0.18, 0.01, 0.015), trim)
        ff.box(c, f"vent_r_{i}", (0.18, -0.203, 0.25 + i * 0.04), (0.18, 0.01, 0.015), trim)
    # Aufkleber mit Glasfaser-Symbol und LED-Leiste.
    ff.box(c, "sticker", (-0.17, -0.205, 0.76), (0.2, 0.01, 0.14), sticker, bevel=0.005)
    ff.cylinder(c, "logo_ring", (-0.17, -0.212, 0.76), 0.045, 0.008, fiber, vertices=24, rotation=(1.5708, 0, 0))
    ff.cylinder(c, "logo_dot", (-0.17, -0.217, 0.76), 0.022, 0.006, sticker, vertices=16, rotation=(1.5708, 0, 0))
    for i in range(3):
        ff.sphere(c, f"led_{i}", (0.1 + i * 0.07, -0.205, 0.8), (0.018, 0.01, 0.018), led, segments=10, rings=6)
    # Orangefarbene Leerrohre verschwinden im Boden.
    for x in (-0.22, 0.0, 0.22):
        ff.torus(c, f"duct_{x}", (x, -0.22, 0.02), 0.09, 0.028, fiber, rotation=(0, 1.5708, 0), major_segments=20, minor_segments=8)
    ff.join_all(c, "distributor")


def main(export=True):
    build()
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "infrastructure/distributor.glb")
