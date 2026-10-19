"""Kabelschacht in der Straße: Betonrahmen mit gusseisernem Deckel, 0,7 m breit, sehr flach."""

import ff_common as ff

COLL = "ff_manhole"


def build():
    c = ff.reset_collection(COLL)
    concrete = ff.material("ff_concrete", (0.72, 0.71, 0.68), roughness=0.95)
    iron = ff.pmat("dark_steel", roughness=0.55, metallic=0.5)
    fiber = ff.pmat("fiber", roughness=0.35)
    ff.box(c, "frame", (0, 0, 0.02), (0.72, 0.72, 0.04), concrete, bevel=0.015)
    ff.box(c, "lid", (0, 0, 0.045), (0.58, 0.58, 0.025), iron, bevel=0.01)
    for i in range(-2, 3):
        ff.box(c, f"rib_x{i}", (i * 0.1, 0, 0.06), (0.025, 0.5, 0.012), iron)
        ff.box(c, f"rib_y{i}", (0, i * 0.1, 0.06), (0.5, 0.025, 0.012), iron)
    ff.box(c, "marker", (0, -0.27, 0.06), (0.3, 0.035, 0.014), fiber)
    ff.join_all(c, "manhole")


def main(export=True):
    build()
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "infrastructure/manhole.glb")
