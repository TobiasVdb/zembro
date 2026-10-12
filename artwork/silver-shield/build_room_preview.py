"""Separate light-only review scene. Does not replace the website artwork."""
import bpy
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path('Y:/Zembro/landing/artwork/silver-shield')
source = sorted((s for s in bpy.data.scenes if s.render.filepath.endswith('silver-shield-corner.png')), key=lambda s:s.name)[-1]
bpy.context.window.scene = source
bpy.ops.scene.new(type='FULL_COPY')
scene = bpy.context.scene
scene.name = 'Silver Shield - reverse room preview'
scene.render.resolution_x = 1800
scene.render.resolution_y = 1350
scene.cycles.samples = 64
scene.view_settings.exposure = .45

def mat(name, color, roughness=.7, fabric=False):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    if fabric:
        noise = m.node_tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 240
        bump = m.node_tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .22
        bump.inputs['Distance'].default_value = .001
        m.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        m.node_tree.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    return m

chalk = mat('Preview - whitewashed plaster', (.88,.875,.855))
white = mat('Preview - ceiling white', (.95,.945,.925))
oak = mat('Preview - pale oak', (.65,.53,.39))
floor = mat('Preview - washed oak flooring', (.79,.73,.63))
linen = mat('Preview - warm ivory boucle', (.73,.69,.61), fabric=True)
cushion = mat('Preview - linen cushion', (.87,.85,.79), fabric=True)
ceramic = mat('Preview - chalk ceramic', (.77,.75,.70))
soil = mat('Preview - pot soil', (.07,.055,.035))
stem_mat = mat('Preview - olive stems', (.19,.23,.095))
leaves = [mat('Preview - leaf '+str(i), c) for i,c in enumerate([
    (.15,.23,.11),(.23,.31,.15),(.32,.38,.21),(.20,.28,.13)])]
curtain = mat('Preview - sheer ivory linen', (.94,.93,.90), fabric=True)
book_mat = mat('Preview - muted teal book', (.24,.39,.39))

def box(name, loc, size, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        b = o.modifiers.new('Soft edges', 'BEVEL'); b.width=bevel; b.segments=6
        o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return o

def cone(name, loc, r1, r2, depth, material):
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=r1, radius2=r2, depth=depth, location=loc)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    b=o.modifiers.new('Rounded rim','BEVEL'); b.width=.008; b.segments=3
    for p in o.data.polygons: p.use_smooth=True
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def rod(name, points, radius, material):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=radius; c.bevel_resolution=3
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points):
        p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); scene.collection.objects.link(o); c.materials.append(material)
    return o

# Expand the existing room; retain the original sensor geometry unchanged.
for o in scene.objects:
    if o.name.startswith('Left wall'):
        o.location=(-.02,2,1.33); o.dimensions=(.04,4,2.66); o.data.materials.clear(); o.data.materials.append(chalk)
    elif o.name.startswith('Right wall'):
        o.location=(2,-.02,1.33); o.dimensions=(4,.04,2.66); o.data.materials.clear(); o.data.materials.append(chalk)
    elif o.name.startswith('Ceiling'):
        o.location=(2,2,2.68); o.dimensions=(4,4,.04); o.data.materials.clear(); o.data.materials.append(white)
box('Preview - floor',(2,2,-.035),(4,4,.07),floor)
box('Preview - skirting along rear wall',(2,.015,.045),(4,.026,.09),white,.005)
box('Preview - skirting along side wall',(.015,2,.045),(.026,4,.09),white,.005)
for i in range(16):
    box('Preview - floor plank joint',(.12+i*.24,2,.001),(.0015,4,.001),oak)

# An inviting upholstered easy chair, with a reclined back and tapered oak feet.
chair_x,chair_y=.68,.68
for x in (-.29,.29):
    for y in (-.23,.23):
        leg=cone('Preview - chair oak leg',(chair_x+x,chair_y+y,.16),.026,.021,.30,oak)
        leg.rotation_euler=(y*.18,x*-.18,0)
box('Preview - chair lower frame',(chair_x,chair_y,.35),(.76,.70,.21),linen,.10)
box('Preview - chair seat cushion',(chair_x,chair_y+.025,.49),(.62,.61,.17),linen,.075)
back=box('Preview - chair curved back',(chair_x,chair_y-.235,.80),(.77,.23,.75),linen,.11)
back.rotation_euler.x=math.radians(12)
for x in (-.35,.35):
    arm=box('Preview - chair upholstered arm',(chair_x+x,chair_y,.64),(.15,.72,.36),linen,.074)
    arm.rotation_euler.x=math.radians(3)
pillow=box('Preview - loose linen pillow',(chair_x-.025,chair_y-.07,.73),(.41,.13,.36),cushion,.065)
pillow.rotation_euler=(math.radians(17),math.radians(-9),math.radians(-7))
# Fine piping gives the seat a soft upholstered edge.
rod('Preview - seat piping',[(chair_x-.25,chair_y+.30,.49),(chair_x,chair_y+.33,.49),
    (chair_x+.25,chair_y+.30,.49)],.0025,cushion)

# Low woven rug and a simple side table with a book and ceramic cup.
rug=box('Preview - ivory woven rug',(.85,.95,.012),(1.55,1.35,.018),cushion,.035)
cone('Preview - side table top',(1.29,.60,.48),.235,.235,.04,oak)
cone('Preview - side table pedestal',(1.29,.60,.25),.085,.055,.44,oak)
box('Preview - book',(1.29,.59,.515),(.22,.16,.022),book_mat,.004)
cone('Preview - small ceramic cup',(1.36,.68,.56),.032,.038,.08,ceramic)

random.seed(18)
def plant(name, origin, height, pot_radius):
    x,y,z=origin
    pot_h=pot_radius*1.6
    cone(name+' ceramic pot',(x,y,z+pot_h/2),pot_radius*.73,pot_radius,pot_h,ceramic)
    cone(name+' soil',(x,y,z+pot_h-.008),pot_radius*.91,pot_radius*.91,.008,soil)
    base=Vector((x,y,z+pot_h))
    for branch in range(7):
        angle=branch*2.4
        end=base+Vector((math.cos(angle)*height*.18,math.sin(angle)*height*.18,height*(.65+random.random()*.35)))
        mid=base.lerp(end,.55)+Vector((.03*math.cos(angle),.03*math.sin(angle),0))
        rod(name+' curved stem',[base,mid,end],.003 if height>.8 else .0018,stem_mat)
        for j in range(7):
            t=.25+j*.105
            start=base.lerp(end,t)
            a=angle+j*2.3
            length=height*(.15+random.random()*.065)*(1-.35*t)
            direction=Vector((math.cos(a),math.sin(a),.3)).normalized()
            side=Vector((-math.sin(a),math.cos(a),0))
            verts=[]
            for k in range(13):
                u=k/12
                center=start+direction*length*u+Vector((0,0,math.sin(u*math.pi)*length*.18))
                w=math.sin(math.pi*u)**.8*length*.22
                for s in (-1,0,1):
                    verts.append(tuple(center+side*w*s+Vector((0,0,-abs(s)*w*.15))))
            faces=[]
            for k in range(12):
                for q in range(2): faces.append((k*3+q,k*3+q+1,(k+1)*3+q+1,(k+1)*3+q))
            mesh=bpy.data.meshes.new(name+' leaf mesh'); mesh.from_pydata(verts,[],faces); mesh.update()
            o=bpy.data.objects.new(name+' leaf',mesh); scene.collection.objects.link(o)
            o.data.materials.append(random.choice(leaves))
            for p in mesh.polygons:p.use_smooth=True
            rod(name+' leaf vein',[start,start+direction*length*.48+Vector((0,0,length*.18)),start+direction*length],.00065,stem_mat)

plant('Preview - tall olive plant',(.40,1.58,0),1.43,.17)
plant('Preview - small leafy plant',(1.48,.24,0),.65,.12)

# Soft window light and restrained, floor-length linen curtains on the side wall.
window=mat('Preview - luminous window',(.96,.98,1))
p=window.node_tree.nodes['Principled BSDF']; p.inputs['Emission Color'].default_value=(.96,.98,1,1); p.inputs['Emission Strength'].default_value=.5
box('Preview - window glow',(.012,2.44,1.53),(.018,1.30,1.85),window,.008)
for y in (1.78,3.10):
    box('Preview - window vertical frame',(.04,y,1.53),(.06,.035,1.90),white,.004)
for z in (.59,2.47):
    box('Preview - window horizontal frame',(.04,2.44,z),(.06,1.34,.04),white,.004)
box('Preview - window centre mullion',(.04,2.44,1.53),(.06,.035,1.90),white,.004)
for edge in (1.64,3.17):
    verts=[]
    for row,z in enumerate((.04,2.53)):
        for i in range(33):
            y=edge+(i/32-.5)*.40
            verts.append((.11+math.cos(i/32*math.pi*8)*.035,y,z))
    faces=[(i,i+1,i+34,i+33) for i in range(32)]
    mesh=bpy.data.meshes.new('Preview - linen folds');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Preview - sheer curtain',mesh);scene.collection.objects.link(o);mesh.materials.append(curtain)
    for p in mesh.polygons:p.use_smooth=True

for o in scene.objects:
    if o.type=='LIGHT':
        if o.name.startswith('Large window'):
            o.location=(.55,2.7,2.2); o.data.energy=180; o.data.size=2.3
            o.data.color=(1,.98,.94)
        else:
            o.location=(3,2.5,2.4); o.data.energy=65; o.data.size=3
        o.rotation_euler=(Vector((.4,.5,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
camera=scene.camera
camera.data.type='PERSP'
# Reverse the original side view: sensor face now points toward the right-hand copy.
camera.location=(3.6,1.3,2.15)
target=Vector((.08,.85,1.50))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.lens=36
camera.data.clip_start=.01
camera.data.dof.use_dof=False
detail=camera.copy()
detail.data=camera.data.copy()
detail.name='Preview - reverse sensor detail camera'
scene.collection.objects.link(detail)
detail.location=(.95,.08,2.65)
detail.rotation_euler=(Vector((.05,.05,2.535))-detail.location).to_track_quat('-Z','Y').to_euler()
detail.data.lens=55
scene.render.filepath=str(ROOT/'silver-shield-room-preview.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'silver-shield-room-preview.blend'))
result={'scene':scene.name,'objects':len(scene.objects),'blend':bpy.data.filepath,'render':scene.render.filepath}
