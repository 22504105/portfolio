"""Re-cut the Stitch garments (drawn for human proportions) for the heroes' chibi body.

Each garment's "-flat" master (art/layers/<name>-flat.png, from scripts/extract-layers.mjs) is mapped
onto a grid; the grid's vertices move so the collar sits at the cat base's neck, the shoulders and
sleeves on its short arms and the hem just above its boots. Rows with details (collar, belt, hem
border) keep about their size and plain cloth between them is shortened. The grid is rendered unlit
(emission of the texture, Standard view transform, so colours are unchanged) with true alpha into the
cat base's 1024-px frame: blender/<name>.png, which extract-layers.mjs then takes as it is.

Run: blender -b --factory-startup --python blender/warp.py   (from questling/)
"""

import math
import os

import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def interp(knots, v):
    """Piecewise-linear through (src, dst) pairs; past the ends, the end segments' slopes."""
    k = sorted(knots)
    if v <= k[0][0]:
        (a, b), (c, d) = k[0], k[1]
        return b + (v - a) * (d - b) / (c - a)
    for (a, b), (c, d) in zip(k, k[1:]):
        if v <= c:
            return b + (v - a) * (d - b) / (c - a)
    (a, b), (c, d) = k[-2], k[-1]
    return d + (v - c) * (d - b) / (c - a)


def warp(name, size, cx_src, rows, widths, res=160):
    """rows: (source y, cat-frame y) knots; widths: (source y, horizontal scale) knots, per row.
    Columns are centred: cx_src on the master goes to x 512 in the cat frame."""
    src = os.path.join(ROOT, "art", "layers", f"{name}-flat.png")
    sc = bpy.data.scenes.get("Garment") or bpy.data.scenes.new("Garment")
    bpy.context.window.scene = sc
    for o in list(sc.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = 32
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 1024
    sc.render.filter_size = 0.6
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"

    w, h = size
    nx, ny = res, int(res * h / w)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new()
    grid = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            sx, sy = i / nx * w, j / ny * h
            tx = 512 + (sx - cx_src) * interp(widths, sy)
            ty = interp(rows, sy)
            row.append((bm.verts.new((tx / 1024 - 0.5, 0, 0.5 - ty / 1024)), (i / nx, 1 - j / ny)))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            quad = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
            face = bm.faces.new([v for v, _ in quad])
            for loop, (_, uv) in zip(face.loops, quad):
                loop[uv_layer].uv = uv
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    sc.collection.objects.link(obj)

    image = bpy.data.images.load(src, check_existing=True)
    image.reload()
    mat = bpy.data.materials.get("Warp_" + name) or bpy.data.materials.new("Warp_" + name)
    mat.use_nodes = True
    mat.surface_render_method = "BLENDED"
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    for n in list(nodes):
        nodes.remove(n)
    tex = nodes.new("ShaderNodeTexImage")
    tex.image, tex.interpolation, tex.extension = image, "Cubic", "CLIP"
    emit = nodes.new("ShaderNodeEmission")
    clear = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(tex.outputs["Color"], emit.inputs["Color"])
    links.new(tex.outputs["Alpha"], mix.inputs[0])
    links.new(clear.outputs[0], mix.inputs[1])
    links.new(emit.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs[0])
    mesh.materials.append(mat)

    cam_data = bpy.data.cameras.get("WarpCam") or bpy.data.cameras.new("WarpCam")
    cam_data.type, cam_data.ortho_scale = "ORTHO", 1.0
    cam = bpy.data.objects.new("WarpCam", cam_data)
    sc.collection.objects.link(cam)
    cam.location, cam.rotation_euler = (0, -5, 0), (math.radians(90), 0, 0)
    sc.camera = cam
    sc.render.filepath = os.path.join(ROOT, "blender", f"{name}.png")
    bpy.ops.render.render(write_still=True, scene=sc.name)
    print("rendered", sc.render.filepath)


# Measured on the -flat masters (896×1200) and the cat base (1024): its neck at y ≈ 560, shoulders'
# top at 576, its own belt at ≈ 690 and tunic hem at 800, boots from ≈ 840.
GARMENTS = {
    "violet-tunic": dict(
        cx_src=454,
        rows=[(280, 555), (360, 590), (585, 680), (665, 738), (820, 790), (940, 850)],
        widths=[(280, 0.75), (360, 0.71), (540, 0.66), (640, 0.8), (760, 0.68), (880, 0.63), (940, 0.63)],
    ),
    "violet-robe": dict(
        cx_src=448,
        rows=[(250, 540), (325, 572), (390, 612), (545, 678), (610, 722), (850, 800), (950, 858)],
        widths=[(250, 0.74), (330, 0.82), (450, 0.78), (575, 0.7), (640, 0.8), (750, 0.72), (900, 0.66), (950, 0.66)],
    ),
    "brown-coat": dict(
        cx_src=455,
        rows=[(250, 540), (350, 576), (540, 672), (610, 702), (830, 800), (925, 845)],
        widths=[(250, 0.8), (350, 0.86), (450, 0.8), (600, 0.7), (700, 0.76), (850, 0.7), (925, 0.7)],
    ),
    # The hood (everything above y 468) is folded to nothing: the cloak starts at the shoulders.
    "midnight-cloak": dict(
        cx_src=450,
        rows=[(0, 548), (468, 548), (470, 549), (510, 572), (700, 690), (975, 862)],
        widths=[(470, 1.0), (560, 1.05), (700, 0.78), (900, 0.6), (975, 0.6)],
    ),
}

if __name__ == "__main__":
    for garment, params in GARMENTS.items():
        warp(garment, (896, 1200), **params)
