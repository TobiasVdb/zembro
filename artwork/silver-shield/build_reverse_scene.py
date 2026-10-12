"""Publish the approved reverse detail composition and a matching dark scene.

Run through Blender MCP with silver-shield-room-preview.blend open.
The review scene and previous production artwork remain unchanged.
"""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path('Y:/Zembro/landing/artwork/silver-shield')
sources = [s for s in bpy.data.scenes if s.render.filepath.endswith('silver-shield-room-preview.png')]
bpy.context.window.scene = sorted(sources, key=lambda s: s.name)[-1]
bpy.ops.scene.new(type='FULL_COPY')
scene = bpy.context.scene
scene.name = 'Silver Shield - approved reverse detail'
scene.camera = next(o for o in scene.objects if o.name.startswith('Preview - reverse sensor detail camera'))
scene.render.resolution_x = 1200
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.cycles.samples = 64
scene.render.filepath = str(ROOT / 'silver-shield-reverse-detail-preview.png')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'silver-shield-reverse.blend'))

bpy.ops.scene.new(type='FULL_COPY')
scene = bpy.context.scene
scene.name = 'Silver Shield - approved reverse detail dark'
scene.view_settings.exposure = 0
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.10, .15, .18, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .15
for obj in scene.objects:
    if obj.name.startswith(('Left wall', 'Right wall', 'Ceiling')):
        mat = obj.active_material
        color = (.012, .035, .042, 1) if not obj.name.startswith('Ceiling') else (.018, .045, .053, 1)
        mat.diffuse_color = color
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = color
    elif obj.name.startswith('Large window softbox'):
        obj.data.energy = 75
        obj.data.color = (.73, .84, 1)
    elif obj.name.startswith('Gentle fill'):
        obj.data.energy = 20
        obj.data.color = (.88, .94, 1)
    elif obj.name.startswith('Preview - window glow'):
        shader = obj.active_material.node_tree.nodes['Principled BSDF']
        shader.inputs['Emission Strength'].default_value = 0
bpy.ops.object.light_add(type='AREA', location=(1.2, .6, 2.9))
key = bpy.context.object
key.name = 'Reverse detail - soft moonlight key'
key.data.energy = 12
key.data.size = 1.4
key.data.color = (.82, .90, 1)
key.rotation_euler = (Vector((.08, .08, 2.55))-key.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(ROOT / 'silver-shield-reverse-dark.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'silver-shield-reverse-dark.blend'))
result = {'scene': scene.name, 'blend': bpy.data.filepath, 'render': scene.render.filepath}
