"""Hausanschlusskasten vor dem Haus. Die LED nutzt `ff_socket_led`, das Spiel färbt sie beim Anschluss grün."""

import ff_common as ff

COLL = "ff_socket"


def build():
    c = ff.reset_collection(COLL)
    post = ff.material("ff_post", (0.9, 0.9, 0.88), roughness=0.5)
    fiber = ff.pmat("fiber", roughness=0.35)
    led = ff.material("ff_socket_led", (1.0, 0.75, 0.15), emission=(1.0, 0.7, 0.1), emission_strength=2.5)
    concrete = ff.material("ff_concrete", (0.72, 0.71, 0.68), roughness=0.95)

    ff.cylinder(c, "base", (0, 0, 0.025), 0.17, 0.05, concrete, vertices=20)
    ff.box(c, "post", (0, 0, 0.25), (0.08, 0.08, 0.42), post, bevel=0.015)
    ff.box(c, "box", (0, -0.01, 0.5), (0.26, 0.14, 0.26), post, bevel=0.03)
    ff.box(c, "stripe", (0, -0.082, 0.55), (0.22, 0.01, 0.04), fiber)
    ff.sphere(c, "led", (0, -0.085, 0.45), (0.035, 0.02, 0.035), led, segments=12, rings=8)
    ff.box(c, "roof", (0, -0.01, 0.645), (0.3, 0.18, 0.03), ff.material("ff_cabinet_dark", (0.2, 0.36, 0.28), roughness=0.5), bevel=0.01)
    ff.cylinder(c, "duct", (0, 0.06, 0.15), 0.025, 0.3, fiber, vertices=12)
    ff.join_all(c, "socket")


def main(export=True):
    build()
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "infrastructure/socket.glb")
