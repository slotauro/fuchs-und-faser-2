"""Felsbrocken-Gruppe für eine Kachel. Deterministisch verformte Ikosphären mit flacher Schattierung."""

import random

import bmesh

import ff_common as ff

COLL = "ff_rock"


def boulder(c, name, loc, radius, squash, mat, seed):
    rng = random.Random(seed)
    ff.bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=loc)
    obj = ff.bpy.context.active_object
    obj.name = name
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for v in bm.verts:
        v.co *= 1 + rng.uniform(-0.14, 0.14)
        v.co.z *= squash
        if v.co.z < -radius * squash * 0.4:
            v.co.z = -radius * squash * 0.4
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    for coll in obj.users_collection:
        coll.objects.unlink(obj)
    c.objects.link(obj)
    return obj


def build():
    c = ff.reset_collection(COLL)
    light = ff.pmat("rock", roughness=0.9)
    dark = ff.pmat("rock_dark", roughness=0.9)
    moss = ff.material("ff_moss", (0.4, 0.58, 0.25), roughness=0.95)
    boulder(c, "big", (-0.04, 0.06, 0.2), 0.42, 0.85, light, 1)
    boulder(c, "mid", (0.28, -0.2, 0.1), 0.22, 0.8, dark, 2)
    boulder(c, "small", (-0.32, -0.27, 0.06), 0.13, 0.8, light, 3)
    boulder(c, "moss", (-0.08, 0.1, 0.5), 0.17, 0.35, moss, 4)
    ff.join_all(c, "rock")


def main(export=True):
    build()
    if export:
        return ff.export_glb(ff.bpy.data.collections[COLL], "environment/rock.glb")
