"""Gemeinsame Bausteine für die Fuchs-und-Faser-2-Assets.

Konventionen (siehe tools/blender/README.md):
- 1 Blender-Meter = 1 Kachel = 1 Welteinheit in Three.js.
- Modelle schauen nach -Y (Blender-Frontansicht). Der glTF-Export macht daraus +Z.
- Ursprung unten mittig auf dem Boden (z = 0).
- Nur Principled-BSDF-Grundfarben, keine Bildtexturen.
"""

import contextlib
import io
import math
import os

import bpy
from mathutils import Vector

PROJECT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MODELS = os.path.join(PROJECT, "client", "public", "models")

# Gemeinsame Farbpalette, damit alle Assets zusammenpassen.
PALETTE = {
    "fox_orange": (0.95, 0.42, 0.10),
    "cream": (0.98, 0.93, 0.82),
    "dark_brown": (0.16, 0.09, 0.06),
    "eye": (0.03, 0.03, 0.04),
    "helmet": (1.0, 0.76, 0.08),
    "leather": (0.45, 0.25, 0.12),
    "fiber": (1.0, 0.45, 0.05),
    "steel": (0.55, 0.58, 0.62),
    "dark_steel": (0.22, 0.24, 0.27),
    "wood": (0.55, 0.36, 0.2),
    "roof": (0.78, 0.25, 0.18),
    "wall": (0.96, 0.89, 0.74),
    "window": (0.55, 0.78, 0.92),
    "door": (0.42, 0.27, 0.16),
    "rock": (0.52, 0.5, 0.48),
    "rock_dark": (0.38, 0.37, 0.36),
    "green": (0.22, 0.6, 0.3),
    "cabinet": (0.33, 0.55, 0.42),
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(name, color, roughness=0.7, metallic=0.0, emission=None, emission_strength=0.0):
    """Principled-Material; Farben werden als sRGB angegeben."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    linear = tuple(srgb_to_linear(c) for c in color) + (1.0,)
    bsdf.inputs["Base Color"].default_value = linear
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = tuple(srgb_to_linear(c) for c in emission) + (1.0,)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat.diffuse_color = linear
    return mat


def pmat(key, **kw):
    return material("ff_" + key, PALETTE[key], **kw)


def reset_collection(name):
    """Leert bzw. erzeugt eine Collection, damit ein Skript beliebig oft laufen kann."""
    coll = bpy.data.collections.get(name)
    if coll:
        for obj in list(coll.all_objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    else:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    # Ausgeblendete Objekte lassen sich weder auswählen noch zusammenfügen oder exportieren.
    coll.hide_viewport = False
    coll.hide_render = False
    layer = bpy.context.view_layer.layer_collection.children.get(name)
    if layer:
        layer.exclude = False
        layer.hide_viewport = False
    for block in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
    return coll


def _link(obj, coll):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def _finish(obj, coll, mat, smooth=True):
    if mat is not None:
        obj.data.materials.append(mat)
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return _link(obj, coll)


def sphere(coll, name, loc, scale, mat, segments=24, rings=14, smooth=True, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation
    return _finish(obj, coll, mat, smooth)


def cylinder(coll, name, loc, radius, depth, mat, vertices=24, rotation=(0, 0, 0), smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    return _finish(obj, coll, mat, smooth)


def cone(coll, name, loc, r1, r2, depth, mat, vertices=16, rotation=(0, 0, 0), smooth=True):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rotation
    )
    obj = bpy.context.active_object
    obj.name = name
    return _finish(obj, coll, mat, smooth)


def box(coll, name, loc, size, mat, bevel=0.0, rotation=(0, 0, 0), segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    if bevel > 0:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
    obj = _finish(obj, coll, mat, smooth=False)
    if bevel > 0:
        # Weiche Kanten, flache Seiten.
        for poly in obj.data.polygons:
            poly.use_smooth = False
    return obj


def torus(coll, name, loc, major, minor, mat, rotation=(0, 0, 0), major_segments=32, minor_segments=10):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=loc,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    return _finish(obj, coll, mat)


def mesh(coll, name, verts, faces, mat, smooth=False):
    """Objekt aus eigenen Vertices und Flächen."""
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    coll.objects.link(obj)
    return _finish(obj, coll, mat, smooth)


def prism(coll, name, width, depth, base, rise, mat):
    """Dreiecksprisma entlang X, z. B. für Giebel."""
    hw, hd = width / 2, depth / 2
    verts = [(-hw, -hd, base), (-hw, hd, base), (-hw, 0, base + rise), (hw, -hd, base), (hw, hd, base), (hw, 0, base + rise)]
    faces = [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (0, 3, 5, 2), (1, 2, 5, 4)]
    return mesh(coll, name, verts, faces, mat)


def capsule(coll, name, a, b, radius, mat, segments=16):
    """Zylinder mit Kugelenden zwischen den Punkten a und b, als ein Objekt."""
    a, b = Vector(a), Vector(b)
    mid = (a + b) / 2
    direction = b - a
    length = direction.length
    rot = direction.to_track_quat("Z", "Y").to_euler()
    parts = [cylinder(coll, name, mid, radius, length, mat, vertices=segments, rotation=rot)]
    parts.append(sphere(coll, name + "_a", a, (radius,) * 3, mat, segments=segments, rings=8))
    parts.append(sphere(coll, name + "_b", b, (radius,) * 3, mat, segments=segments, rings=8))
    return join(parts, name)


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def join_all(coll, name):
    """Fasst alle Meshes einer Collection zu einem Objekt zusammen (ein Mesh, mehrere Materialien)."""
    meshes = [o for o in coll.objects if o.type == "MESH"]
    for o in meshes:
        for mod in list(o.modifiers):
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=mod.name)
    obj = join(meshes, name)
    # Ursprung auf den Weltnullpunkt (unten mittig) legen, Transformationen in die Geometrie übernehmen.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def apply_transforms(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def armature(coll, name, bones):
    """bones: Liste aus (name, head, tail, parent)."""
    data = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, data)
    coll.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, head, tail, parent in bones:
        eb = data.edit_bones.new(bname)
        eb.head = head
        eb.tail = tail
        eb.roll = 0.0
        if parent:
            eb.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def parent_to_bone(obj, arm, bone):
    """Starre Bindung an einen Knochen; die Weltlage bleibt erhalten."""
    world = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = world


def new_action(arm, name, frames):
    """Legt eine Aktion an, aktiviert sie und behält sie per Fake-User."""
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = action
    action.frame_range = (1, frames)
    action.use_frame_range = True
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return action


def key(arm, bone, frame, rot=None, loc=None, scale=None):
    """Schlüsselbild für einen Knochen; Rotation in Grad (lokale Achsen)."""
    pb = arm.pose.bones[bone]
    if rot is not None:
        pb.rotation_euler = tuple(math.radians(r) for r in rot)
        pb.keyframe_insert("rotation_euler", frame=frame)
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert("location", frame=frame)
    if scale is not None:
        pb.scale = scale
        pb.keyframe_insert("scale", frame=frame)


def stage():
    """Prüfbühne: 1-m-Kachelraster, Sonne und Ortho-Kamera im Spielwinkel."""
    coll = reset_collection("ff_stage")
    grass = material("ff_stage_grass", (0.47, 0.72, 0.32), roughness=0.9)
    grass_alt = material("ff_stage_grass_alt", (0.42, 0.66, 0.29), roughness=0.9)
    for ix in range(-3, 4):
        for iy in range(-3, 4):
            m = grass if (ix + iy) % 2 == 0 else grass_alt
            box(coll, f"tile_{ix}_{iy}", (ix, iy, -0.05), (0.98, 0.98, 0.1), m)
    sun_data = bpy.data.lights.get("ff_sun") or bpy.data.lights.new("ff_sun", "SUN")
    sun_data.energy = 3.5
    sun_data.angle = math.radians(8)
    sun = bpy.data.objects.new("ff_sun", sun_data)
    coll.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(30))
    cam_data = bpy.data.cameras.get("ff_cam") or bpy.data.cameras.new("ff_cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 4.0
    cam = bpy.data.objects.new("ff_cam", cam_data)
    coll.objects.link(cam)
    # Gleicher Winkel wie im Spiel: von schräg vorne oben (Spiel-+Z entspricht Blender -Y).
    cam.location = (0, -8, 8.5)
    cam.rotation_euler = (math.radians(43), 0, 0)
    scene = bpy.context.scene
    scene.camera = cam
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.55, 0.65, 0.75, 1.0)
    bg.inputs["Strength"].default_value = 0.8
    for name in ("Cube", "Light", "Camera"):
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    return coll


def export_glb(coll, relpath):
    """Exportiert genau die Objekte einer Collection als GLB unter client/public/models."""
    path = os.path.join(MODELS, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in coll.all_objects:
        obj.select_set(True)
    if not any(obj.select_get() for obj in coll.all_objects):
        raise RuntimeError(f"{coll.name}: nichts auswählbar, Collection ausgeblendet?")
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        _export(path)
    return path, os.path.getsize(path)


def _export(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_texcoords=False,
        export_cameras=False,
        export_lights=False,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_reset_pose_bones=True,
    )


def hide_others(keep):
    """Blendet für die Vorschau alle Asset-Collections außer `keep` und der Bühne aus."""
    for coll in bpy.context.scene.collection.children:
        visible = coll.name in (keep, "ff_stage")
        coll.hide_viewport = not visible
        coll.hide_render = not visible
