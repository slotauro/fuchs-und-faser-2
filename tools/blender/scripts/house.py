"""Wohnhaus auf 2×2 Kacheln. Tür und Anschlussseite zeigen nach -Y.

Die Fensterscheiben nutzen das eigene Material `ff_window`, damit das Spiel sie
beim Anschluss leuchten lassen kann.
"""

import math

import ff_common as ff

COLL = "ff_house"


def build():
    c = ff.reset_collection(COLL)
    wall = ff.pmat("wall", roughness=0.85)
    roof = ff.pmat("roof", roughness=0.7)
    wood = ff.pmat("wood", roughness=0.7)
    door = ff.pmat("door", roughness=0.6)
    window = ff.material("ff_window", ff.PALETTE["window"], roughness=0.2)
    frame = ff.material("ff_frame", (0.98, 0.97, 0.94), roughness=0.6)
    stone = ff.pmat("rock", roughness=0.9)

    w, d, h = 1.5, 1.4, 0.9
    ff.box(c, "foundation", (0, 0, 0.05), (w + 0.08, d + 0.08, 0.1), stone, bevel=0.02)
    ff.box(c, "walls", (0, 0, 0.1 + h / 2), (w, d, h), wall, bevel=0.03)

    # Satteldach mit Überstand, First entlang X. Jede Dachfläche läuft vom First zur Traufe.
    rise = 0.55
    overhang = 0.16
    top = 0.1 + h + rise
    slope = math.atan2(rise, d / 2)
    run = d / 2 + overhang
    length = run / math.cos(slope)
    thickness = 0.07
    for side in (-1, 1):
        ff.box(
            c,
            f"roof_{side}",
            (
                0,
                side * (run / 2 + math.sin(slope) * thickness / 2),
                top - run / 2 * math.tan(slope) + math.cos(slope) * thickness / 2,
            ),
            (w + 0.3, length, thickness),
            roof,
            bevel=0.02,
            rotation=(-side * slope, 0, 0),
        )
    # Giebelwände als Dreiecksprisma unter dem Dach.
    ff.prism(c, "gable", w - 0.02, d, 0.1 + h, rise, wall)
    ff.box(c, "ridge", (0, 0, top + 0.06), (w + 0.34, 0.1, 0.08), roof, bevel=0.03)
    ff.box(c, "chimney", (0.42, 0.25, 0.1 + h + rise * 0.7), (0.18, 0.18, 0.5), ff.material("ff_brick", (0.66, 0.3, 0.22), roughness=0.9), bevel=0.015)

    # Tür mit Vordach, Stufe und Klinke.
    ff.box(c, "door", (-0.28, -d / 2 - 0.01, 0.1 + 0.3), (0.32, 0.04, 0.58), door, bevel=0.015)
    ff.sphere(c, "knob", (-0.17, -d / 2 - 0.04, 0.38), (0.022, 0.022, 0.022), ff.pmat("helmet", roughness=0.3, metallic=0.6))
    ff.box(c, "step", (-0.28, -d / 2 - 0.1, 0.06), (0.46, 0.2, 0.08), stone, bevel=0.015)
    ff.box(c, "canopy", (-0.28, -d / 2 - 0.12, 0.78), (0.5, 0.26, 0.04), roof, bevel=0.01, rotation=(-0.25, 0, 0))

    # Fenster: Scheibe, Rahmen, Kreuz und Blumenkasten.
    def window_at(name, loc, size, normal_axis):
        sx, sz = size
        if normal_axis == "y":
            ff.box(c, name + "_frame", loc, (sx + 0.07, 0.05, sz + 0.07), frame, bevel=0.01)
            pane_loc = (loc[0], loc[1] - 0.012 * (1 if loc[1] < 0 else -1), loc[2])
            ff.box(c, name, pane_loc, (sx, 0.04, sz), window)
            ff.box(c, name + "_bar_v", pane_loc, (0.025, 0.05, sz), frame)
            ff.box(c, name + "_bar_h", pane_loc, (sx, 0.05, 0.025), frame)
            if loc[1] < 0:
                ff.box(c, name + "_planter", (loc[0], loc[1] - 0.06, loc[2] - sz / 2 - 0.05), (sx + 0.06, 0.1, 0.07), wood, bevel=0.01)
                for i in range(4):
                    ff.sphere(c, f"{name}_flower{i}", (loc[0] - sx / 2 + 0.03 + i * sx / 3.4, loc[1] - 0.07, loc[2] - sz / 2 - 0.0), (0.035,) * 3, ff.material("ff_flower_" + str(i % 2), ((1.0, 0.45, 0.6) if i % 2 else (1.0, 0.85, 0.2)), roughness=0.6), segments=8, rings=6)
        else:
            ff.box(c, name + "_frame", loc, (0.05, sx + 0.07, sz + 0.07), frame, bevel=0.01)
            pane_loc = (loc[0] + 0.012 * (1 if loc[0] > 0 else -1), loc[1], loc[2])
            ff.box(c, name, pane_loc, (0.04, sx, sz), window)
            ff.box(c, name + "_bar_v", pane_loc, (0.05, 0.025, sz), frame)

    window_at("win_front", (0.33, -d / 2 - 0.005, 0.62), (0.4, 0.34), "y")
    window_at("win_back_l", (-0.35, d / 2 + 0.005, 0.6), (0.34, 0.32), "y")
    window_at("win_back_r", (0.35, d / 2 + 0.005, 0.6), (0.34, 0.32), "y")
    window_at("win_left", (-w / 2 - 0.005, 0.0, 0.6), (0.36, 0.32), "x")
    window_at("win_right", (w / 2 + 0.005, 0.0, 0.6), (0.36, 0.32), "x")

    # Kleiner Glasfaser-Hauseinführungspunkt an der Wand.
    ff.box(c, "ftth_box", (0.68, -d / 2 - 0.03, 0.3), (0.12, 0.05, 0.16), ff.material("ff_ftth", (0.92, 0.92, 0.9), roughness=0.5), bevel=0.01)
    ff.box(c, "ftth_stripe", (0.68, -d / 2 - 0.058, 0.3), (0.1, 0.01, 0.025), ff.pmat("fiber", roughness=0.4))
    ff.join_all(c, "house")


def main(export=True):
    build()
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "buildings/house.glb")
