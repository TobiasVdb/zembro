"""Illustrative Silver Shield corner installation, built through Blender MCP.

References: Pontosense Workshop installation guide, supplied Silver Shield Intro Deck.
Approximate exterior geometry; not manufacturer CAD or an installation drawing.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path('Y:/Zembro/landing/artwork/silver-shield')
ROOT.mkdir(parents=True, exist_ok=True)
bpy.ops.scene.new(type='NEW')
scene = bpy.context.scene
scene.name = 'Zembro - Silver Shield corner'
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.device = 'GPU'
scene.cycles.use_denoising = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = 0.3
scene.world = bpy.data.worlds.new('Soft daylight')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.91, 0.94, 1.0, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35

def material(name, color, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat

plastic = material('Warm white matte ABS', (0.88, 0.89, 0.88), 0.32)
front = material('White radar face - no lens', (0.94, 0.945, 0.93), 0.4)
seam = material('Fine casing seam', (0.57, 0.60, 0.59), 0.6)
dark = material('Micro USB recess', (0.012, 0.016, 0.016), 0.45)
led = material('Unlit status indicator', (0.73, 0.77, 0.75), 0.35)
wall = material('Soft chalk white plaster', (0.87, 0.86, 0.83), 0.9)
ceiling = material('White ceiling', (0.95, 0.945, 0.93), 0.9)
# Fine plaster texture, visible only in the contact-shadow areas.
nodes = wall.node_tree.nodes
noise = nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 450
noise.inputs['Detail'].default_value = 2
bump = nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 0.1
bump.inputs['Distance'].default_value = 0.00012
wall.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
wall.node_tree.links.new(bump.outputs['Normal'], nodes['Principled BSDF'].inputs['Normal'])

def finish(obj, name, mat, bevel=0):
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 5
    if obj.type == 'MESH':
        for face in obj.data.polygons:
            face.use_smooth = len(face.vertices) == 4
        if bevel:
            obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return obj

def box(name, loc, dimensions, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)

# Two intersecting walls and a ceiling. Room is in positive X/Y.
box('Left wall', (-0.012, 0.8, 1.75), (0.024, 1.65, 2.1), wall)
box('Right wall', (0.8, -0.012, 1.75), (1.65, 0.024, 2.1), wall)
box('Ceiling', (0.8, 0.8, 2.672), (1.65, 1.65, 0.024), ceiling)

# Match the reference casing's inclined opaque face, never a camera lens.
# The manufacturer specifies the sensing module's internal 30-degree installation.
normal = Vector((math.cos(math.radians(30))/math.sqrt(2),
                 math.cos(math.radians(30))/math.sqrt(2), 0.5))
rotation = normal.to_track_quat('Z', 'Y')
center = Vector((0.064, 0.064, 2.557))

def cylinder(name, radius, depth, offset, mat, bevel=0.0015):
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=radius, depth=depth,
        location=center + normal * offset)
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = rotation
    return finish(obj, name, mat, bevel)

# The casing is a single tapered shell: round at the front, angled at the rear.
# The rear cut follows the corner mount rather than a separate rectangular plate.
verts = []
count = 128
for ring in range(2):
    for i in range(count):
        angle = 2 * math.pi * i / count
        x, y = math.cos(angle) * 0.034, math.sin(angle) * 0.034
        if ring == 0:
            z = 0.019
        else:
            x *= 0.98
            y *= 0.98
            z = -0.045 + y * 0.15
        verts.append(tuple(center + rotation @ Vector((x,y,z))))
faces = [tuple(reversed(range(count))), tuple(range(count, count*2))]
faces += [(i, (i+1)%count, (i+1)%count+count, i+count) for i in range(count)]
mesh = bpy.data.meshes.new('Tapered casing mesh')
mesh.from_pydata(verts, [], faces)
mesh.update()
shell = bpy.data.objects.new('Silver Shield tapered housing', mesh)
scene.collection.objects.link(shell)
finish(shell, shell.name, plastic, 0.002)
cylinder('Housing cap seam', 0.0341, 0.00045, -0.043, seam, 0.00015)
cylinder('Smooth opaque radar face', 0.034, 0.007, 0.024, front, 0.0028)
# Rounded wedge enclosure follows the corner, rather than a flat mounting plate.
# Loft the curved front between rounded, narrower lower and upper ends.
# Narrow wall-contact wings with a projecting curved front, not a thin pad.
outline = [(.001,.001),(.041,.001)]
for i in range(1,25):
    t = i/24
    outline.append(((1-t)**2*.041+2*(1-t)*t*.070+t*t*.050,
                    (1-t)**2*.001+2*(1-t)*t*.025+t*t*.050))
for i in range(1,25):
    t = i/24
    outline.append(((1-t)**2*.050+2*(1-t)*t*.025+t*t*.001,
                    (1-t)**2*.050+2*(1-t)*t*.070+t*t*.041))
levels = [(2.482,.55),(2.486,.80),(2.493,.95),(2.510,1.0),
          (2.557,.95),(2.571,.85),(2.577,.70)]
verts = [(x*scale,y*scale,z) for z,scale in levels for x,y in outline]
ring_size = len(outline)
faces = [tuple(reversed(range(ring_size))),
         tuple(range((len(levels)-1)*ring_size,len(levels)*ring_size))]
for j in range(len(levels)-1):
    for i in range(ring_size):
        next_i = (i+1)%ring_size
        faces.append((j*ring_size+i,j*ring_size+next_i,
                      (j+1)*ring_size+next_i,(j+1)*ring_size+i))
mesh = bpy.data.meshes.new('Rounded wedge enclosure mesh')
mesh.from_pydata(verts, [], faces)
mesh.update()
saddle = bpy.data.objects.new('Integrated rounded corner enclosure', mesh)
scene.collection.objects.link(saddle)
finish(saddle, saddle.name, plastic, .004)
# Two small recessed fastener marks on the lower curved enclosure.
for position, direction in (
    ((.0478,.0240,2.493),(.984,-.18,0)),
    ((.0240,.0478,2.493),(-.18,.984,0))):
    direction = Vector(direction).normalized()
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.0008,depth=.00015,
        location=Vector(position)+direction*.00005)
    screw = bpy.context.object
    screw.rotation_mode='QUATERNION'
    screw.rotation_quaternion=direction.to_track_quat('Z','Y')
    finish(screw,'Recessed lower fastener',seam,.00005)

# Visible lower rim details, based on the supplied device photographs.
right = rotation @ Vector((1, 0, 0))
down = rotation @ Vector((0, -1, 0))
lower_center = center + down * 0.032
port = box('Micro USB socket', lower_center + down * .002 + normal * (-0.030),
           (0.008, 0.0003, 0.0035), dark, 0.001)
port.rotation_mode = 'QUATERNION'
port.rotation_quaternion = rotation
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=.0033, depth=.0006,
    location=lower_center + right*(-.014) + normal*(-.030) + down*.001)
button = bpy.context.object
button.rotation_mode = 'QUATERNION'
button.rotation_quaternion = down.to_track_quat('Z','Y')
finish(button, 'Round reset button rim', seam, .0002)
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=.003, depth=.0007,
    location=lower_center + right*(-.014) + normal*(-.030) + down*.0014)
button = bpy.context.object
button.rotation_mode = 'QUATERNION'
button.rotation_quaternion = down.to_track_quat('Z','Y')
finish(button, 'Round reset button', plastic, .0002)
indicator = box('Status LED - off', lower_center + right * 0.013 + normal * (-.030),
                (0.0018, 0.001, 0.0018), led, 0.0007)
indicator.rotation_mode = 'QUATERNION'
indicator.rotation_quaternion = rotation

# Small printed port legend, aligned with the underside controls.
label_curve = bpy.data.curves.new('Micro USB legend', 'FONT')
label_curve.body = 'Micro USB'
label_curve.align_x = 'CENTER'
label_curve.size = .0016
label_curve.extrude = 0
label = bpy.data.objects.new('Printed Micro USB legend', label_curve)
scene.collection.objects.link(label)
label.location = lower_center + down*.003 + normal*(-.037)
label.rotation_mode = 'QUATERNION'
label.rotation_quaternion = Matrix((right, -normal, down)).transposed().to_quaternion()
label_curve.materials.append(seam)

# Power is routed behind the corner enclosure in this editorial installation.

def area(name, location, energy, size, target, color):
    bpy.ops.object.light_add(type='AREA', location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.energy = energy
    obj.data.shape = 'DISK'
    obj.data.size = size
    obj.data.color = color
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()

area('Large window softbox', (0.25,0.9,2.65), 25, 0.8, (0,0,2.5), (0.98,0.99,1.0))
area('Gentle fill', (0.9,0.25,2.4), 8, 0.8, (0,0,2.5), (1.0,1.0,1.0))
bpy.ops.object.camera_add(location=(0.08,0.95,2.65))
camera = bpy.context.object
camera.name = 'Editorial corner camera'
target = Vector((0.05,0.05,2.535))
camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'PERSP'
camera.data.ortho_scale = 0.48
camera.data.lens = 70
camera.data.clip_start = .001
scene.camera = camera
scene.render.filepath = str(ROOT / 'silver-shield-corner.png')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'silver-shield-corner-revised.blend'))
result = {'scene':scene.name, 'objects':len(scene.objects),
          'blend':bpy.data.filepath, 'render':scene.render.filepath}
