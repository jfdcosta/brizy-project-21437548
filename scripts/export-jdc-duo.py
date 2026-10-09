"""Export the assembled JDC Duo print parts as a browser display model.

Run with Blender 5: blender -b "JDC Duo - editable assembly.blend" --python
scripts/export-jdc-duo.py -- --galaxy "Galaxy retained insert R2.blend" --params
"Dock parameters.json" --output storefront/public/models/jdc-duo.glb
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


parser = argparse.ArgumentParser()
parser.add_argument("--galaxy", type=Path, required=True)
parser.add_argument("--params", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])

params = json.loads(args.params.read_text())
body = params["body"]
names = (
    "Pixel Watch 3 — left entry shell",
    "Pixel Watch 3 — interchangeable insert",
    "Galaxy Watch 4 — right entry shell",
    "Galaxy Watch 4 — interchangeable insert",
)

with bpy.data.libraries.load(str(args.galaxy)) as (source, target):
    target.objects = [name for name in source.objects if name == "Galaxy retained insert revision 2"]
if len(target.objects) != 1 or target.objects[0] is None:
    raise RuntimeError("The fitted Galaxy R2 insert is missing")

current = target.objects[0]
old = bpy.data.objects[names[3]]
mesh = current.data.copy()
rotation = Matrix.Rotation(math.radians(body["incline_degrees"]), 4, "X")
origin = Vector((0, 30, body["puck_center_height"]))
destination = Vector((0, body["cradle_center_forward"], 48))
for vertex in mesh.vertices:
    vertex.co = rotation @ (vertex.co - origin) + destination
old.data = mesh

shell_material = bpy.data.materials.new("Printed black PLA")
shell_material.diffuse_color = (0.052, 0.059, 0.054, 1)
shell_material.use_nodes = True
shell_material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = shell_material.diffuse_color
shell_material.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = 0.72
insert_material = bpy.data.materials.new("Removable black inserts")
insert_material.diffuse_color = (0.105, 0.115, 0.105, 1)
insert_material.use_nodes = True
insert_material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = insert_material.diffuse_color
insert_material.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = 0.67

bpy.ops.object.select_all(action="DESELECT")
for name in names:
    part = bpy.data.objects[name]
    part.data.materials.clear()
    part.data.materials.append(insert_material if "insert" in name else shell_material)
    part.hide_set(False)
    part.hide_render = False
    part.select_set(True)

args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(args.output.resolve()),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
)
print("EXPORTED", args.output, "PARTS", len(names))
