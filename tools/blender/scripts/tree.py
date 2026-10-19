"""Stilisierter Laubbaum für Hinderniskacheln, ca. 1,5 m hoch."""

import ff_common as ff

COLL = "ff_tree"


def build():
    c = ff.reset_collection(COLL)
    bark = ff.material("ff_bark", (0.45, 0.29, 0.17), roughness=0.9)
    leaf = ff.pmat("green", roughness=0.85)
    leaf_light = ff.material("ff_leaf_light", (0.36, 0.7, 0.32), roughness=0.85)
    ff.cone(c, "trunk", (0, 0, 0.32), 0.11, 0.07, 0.64, bark, vertices=10)
    ff.cone(c, "root_flare", (0, 0, 0.04), 0.17, 0.1, 0.08, bark, vertices=10)
    for name, loc, s, m in (
        ("crown", (0, 0, 0.95), (0.44, 0.44, 0.4), leaf),
        ("crown_l", (-0.2, 0.08, 0.82), (0.3, 0.3, 0.27), leaf_light),
        ("crown_r", (0.22, -0.1, 0.86), (0.3, 0.3, 0.28), leaf_light),
        ("crown_top", (0.05, 0.02, 1.25), (0.28, 0.28, 0.25), leaf_light),
    ):
        ff.sphere(c, name, loc, s, m, segments=14, rings=9)
    ff.join_all(c, "tree")


def main(export=True):
    build()
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "environment/tree.glb")
