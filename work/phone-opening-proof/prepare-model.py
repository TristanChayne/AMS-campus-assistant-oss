"""Run with official Blender, --background --disable-autoexec <source.blend> --python this.py -- --output <dir>.
Only the downloaded model's derived copy is changed. No source blend is saved.
"""
import argparse, hashlib, json, os, sys
import bpy
from mathutils import Vector

p = argparse.ArgumentParser()
p.add_argument('--output', required=True)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
os.makedirs(a.output, exist_ok=True)
source = bpy.data.filepath
with open(source, 'rb') as f:
    source_sha = hashlib.sha256(f.read()).hexdigest()
if source_sha != '9538eee7dce8de3f4789d10fe62e6e1e0f6ffd300d850c96dab0d9ccd32ae3e7':
    raise RuntimeError('This conversion recipe was reviewed for the downloaded CGTrader blend only.')

def bounds(o):
    points = [o.matrix_world @ Vector(c) for c in o.bound_box]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    return dict(low=low, high=high, size=[high[i]-low[i] for i in range(3)])

original_body = bounds(bpy.data.objects['Body'])
screen = bpy.data.objects['Screen']
index = next(i for i,m in enumerate(screen.data.materials) if m.name == 'Display')
polygons = [p for p in screen.data.polygons if p.material_index == index]
vertex_ids = sorted({i for p in polygons for i in p.vertices})
points = [screen.matrix_world @ screen.data.vertices[i].co for i in vertex_ids]
low_x, high_x = min(v.x for v in points), max(v.x for v in points)
low_z, high_z = min(v.z for v in points), max(v.z for v in points)

# Split all three Screen material groups so display replacement cannot erase the glass or border.
new_screen_parts = []
for slot, material in enumerate(screen.data.materials):
    polys = [poly for poly in screen.data.polygons if poly.material_index == slot]
    ids = sorted({i for poly in polys for i in poly.vertices})
    remap = {v:i for i,v in enumerate(ids)}
    faces = [[remap[i] for i in poly.vertices] for poly in polys]
    mesh = bpy.data.meshes.new('PhoneScreen.'+material.name)
    mesh.from_pydata([screen.data.vertices[i].co[:] for i in ids], [], faces)
    mesh.materials.append(material.copy())
    obj = bpy.data.objects.new('PhoneDisplay' if slot == index else 'PhoneScreen.'+material.name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.matrix_world = screen.matrix_world.copy()
    if slot == index:
        uv = mesh.uv_layers.new(name='ScreenProjection')
        for poly in mesh.polygons:
            # Front of the Blender model faces -Y. The FBX display winding was reversed.
            if (obj.matrix_world.to_3x3() @ poly.normal).y > 0:
                poly.flip()
            for loop_index in poly.loop_indices:
                world = obj.matrix_world @ mesh.vertices[mesh.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = ((world.x-low_x)/(high_x-low_x), (world.z-low_z)/(high_z-low_z))
        display = obj
    else:
        for poly in mesh.polygons: poly.use_smooth = True
    new_screen_parts.append(obj)
bpy.data.objects.remove(screen, do_unlink=True)

# Preserve the original PBR metal nodes. Use a clear optical cover for the replaceable display.
glass = bpy.data.objects['PhoneScreen.Glass'].data.materials[0]
glass_node = next(n for n in glass.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
glass_node.inputs['Base Color'].default_value = (1,1,1,1)
glass_node.inputs['Metallic'].default_value = 0
glass_node.inputs['Roughness'].default_value = .025
glass_node.inputs['Transmission Weight'].default_value = 1
glass_node.inputs['IOR'].default_value = 1.5

model_root = bpy.data.objects.new('PhoneOpeningModel', None)
bpy.context.collection.objects.link(model_root)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    matrix = o.matrix_world.copy()
    o.parent = model_root
    o.matrix_world = matrix

# Small measured corrections: width and height to the Apple specification;
# glass-to-back-glass planes from +/-4.5mm to +/-4.375mm. Camera bump is separate.
model_root.scale = (78/77.6, 8.75/9, 163.4/163)
bpy.context.view_layer.update()
derived_body = bounds(bpy.data.objects['Body'])
display_bounds = bounds(display)
for o in bpy.context.selected_objects: o.select_set(False)
for o in meshes + [model_root]: o.select_set(True)
bpy.context.view_layer.objects.active = model_root
glb = os.path.join(a.output, 'iphone17pm-calibrated.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_animations=False, export_yup=True, export_apply=True)
with open(glb,'rb') as f: digest=hashlib.sha256(f.read()).hexdigest()
review = dict(
    modelSha256=digest, commercialUseConfirmed=True,
    licence='CGTrader Royalty Free (no AI); seller-selected licence applies to free downloads; rendered incorporated products permitted',
    licenceSource='https://www.cgtrader.com/pages/terms-and-conditions',
    acquiredSource='https://www.cgtrader.com/free-3d-models/electronics/phone/iphone-17-pro-max-f0b2fff3-c049-4853-bc80-e9d97eb835de',
    author='bhatowais786', originalBlendSha256=source_sha, blender=bpy.app.version_string,
    originalBodyMm=[v*1000 for v in original_body['size']], calibratedBodyMm=[v*1000 for v in derived_body['size']],
    scaleCorrection=list(model_root.scale), screenMesh='PhoneDisplay',
    screenProjection='Continuous world X/Z front-plane UV; full native image is scaled/padded before mapping, no atlas UV reuse',
    screenBoundsMm=[v*1000 for v in display_bounds['size']],
    materials='Original Blender metallic/roughness preserved; optical cover adapted independently from display',
    originalFileChanged=False, productAppearanceAccepted=False, handAvailable=False,
    limitations=['Corrected dimensions are not proof of every corner/button/camera detail matching Apple drawings.',
                 'This is a look-development model; commercial studio appearance and hand composition require visual acceptance.',
                 'Geometry/material conversion is ordinary rendering, no model or image-generation training. Raw asset is not redistributed.'])
with open(os.path.join(a.output,'model-review.json'),'w',encoding='utf8') as f: json.dump(review,f,indent=2)
print(json.dumps(review))
