"""Create a matching dark-room variant of the existing light scene via Blender MCP.

Run build_scene.py first, or open silver-shield-corner.blend before this script.
Geometry, camera and the white sensor finish remain identical in both variants.
"""
import bpy
from pathlib import Path

ROOT = Path('Y:/Zembro/landing/artwork/silver-shield')
sources = [scene for scene in bpy.data.scenes
           if scene.render.filepath.endswith('silver-shield-corner.png')]
if not sources:
    raise RuntimeError('Open the light Silver Shield scene before building the dark variant')
bpy.context.window.scene = sorted(sources, key=lambda scene: scene.name)[-1]
bpy.ops.scene.new(type='FULL_COPY')
scene = bpy.context.scene
scene.name = 'Zembro - Silver Shield dark corner'
scene.view_settings.exposure = 0.0
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.10, .15, .18, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .15

for obj in scene.objects:
    if obj.name.startswith(('Left wall', 'Right wall', 'Ceiling')):
        mat = obj.active_material
        color = (.012, .035, .042, 1) if not obj.name.startswith('Ceiling') else (.018, .045, .053, 1)
        mat.diffuse_color = color
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = color
    elif obj.name.startswith('Large window softbox'):
        obj.data.energy = 10
        obj.data.color = (.73, .84, 1.0)
    elif obj.name.startswith('Gentle fill'):
        obj.data.energy = 2
        obj.data.color = (.88, .94, 1.0)

scene.render.filepath = str(ROOT / 'silver-shield-corner-dark.png')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'silver-shield-corner-dark-revised.blend'))
result = {'scene': scene.name, 'render': scene.render.filepath, 'blend': bpy.data.filepath}
