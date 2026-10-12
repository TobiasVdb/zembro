"""Blender/Cycles product family still life. Approximate exterior models, not CAD.

Run through Blender MCP with the approved Silver Shield scene available.
All devices, cloth and shadows are geometry; no product image planes.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path('Y:/Zembro/landing/artwork/products')
ROOT.mkdir(parents=True, exist_ok=True)
source = bpy.data.scenes.get('Silver Shield - approved reverse detail')
if source is None:
    raise RuntimeError('Load the approved Silver Shield source before building')
bpy.ops.scene.new(type='NEW')
scene = bpy.context.scene
scene.name = 'Zembro - sunny product family on linen'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.cycles.device = 'GPU'
scene.render.resolution_x = 2000
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = 1.6
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.unit_settings.system = 'METRIC'
scene.world = bpy.data.worlds.new('Products - white studio daylight')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.88,.93,1,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35

def mat(name, color, rough=.5, metal=0):
    m = bpy.data.materials.new('Products - '+name)
    m.use_nodes = True
    s = m.node_tree.nodes['Principled BSDF']
    s.inputs['Base Color'].default_value = (*color,1)
    s.inputs['Roughness'].default_value = rough
    s.inputs['Metallic'].default_value = metal
    return m

white = mat('warm white ABS',(.89,.90,.88),.34)
cloth = mat('washed white linen',(.91,.90,.87),.92)
chalk = mat('white backdrop',(.94,.94,.93),.9)
black = mat('graphite silicone',(.006,.008,.009),.5)
case = mat('charcoal housing',(.013,.016,.018),.32)
glass = mat('smoked display glass',(.006,.009,.012),.16)
silver = mat('brushed dark metal',(.17,.19,.20),.28,.72)
orange = mat('Wander orange inner strap',(.85,.27,.025),.7)
ink = mat('printed charcoal',(.025,.065,.065),.7)
blue = mat('display pale blue',(.33,.68,.79),.35)
lit = mat('display white',(.9,.94,.94),.35)
shader = lit.node_tree.nodes['Principled BSDF']
shader.inputs['Emission Color'].default_value = (.7,.85,.85,1)
shader.inputs['Emission Strength'].default_value = .25
nodes = cloth.node_tree.nodes
tex = nodes.new('ShaderNodeTexNoise')
tex.inputs['Scale'].default_value = 1500
tex.inputs['Detail'].default_value = 2
bump = nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = .18
bump.inputs['Distance'].default_value = .00016
cloth.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height'])
cloth.node_tree.links.new(bump.outputs['Normal'],nodes['Principled BSDF'].inputs['Normal'])

def finish(o,name,m,bevel=0):
    o.name = name
    o.data.materials.append(m)
    if bevel:
        mod = o.modifiers.new('Manufactured edge radii','BEVEL')
        mod.width = bevel
        mod.segments = 6
        o.modifiers.new('Surface normals','WEIGHTED_NORMAL')
    return o

def box(name,loc,dims,m,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object
    o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,m,bevel)

def cylinder(name,loc,radius,depth,m,axis=(0,-1,0),bevel=.0006):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=radius,depth=depth,location=loc)
    o=bpy.context.object
    o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    finish(o,name,m,bevel)
    for p in o.data.polygons: p.use_smooth=len(p.vertices)==4
    return o

def label(name,body,loc,size,m):
    c=bpy.data.curves.new(name,'FONT')
    c.body=body
    c.size=size
    c.align_x='CENTER'
    c.align_y='CENTER'
    o=bpy.data.objects.new(name,c)
    scene.collection.objects.link(o)
    o.location=loc
    o.rotation_euler=(math.pi/2,0,0)
    c.materials.append(m)
    return o

Z=.742
box('White table',(0,.12,.712),(.95,.55,.055),chalk,.012)
box('White cyclorama floor',(0,0,-.025),(6,6,.04),chalk)
box('White studio backdrop',(0,.7,1.2),(6,.04,3),chalk)
# Continuous linen surface and hanging front: real folds in a dense mesh.
verts=[]
faces=[]
nx,ny=180,100
for j in range(ny+1):
    t=j/ny
    for i in range(nx+1):
        x=-.49+.98*i/nx
        if t<.72:
            y=.40-.55*(t/.72)
            z=Z+.00025*math.sin(22*x+3*y)*math.sin(29*y)
        else:
            u=(t-.72)/.28
            y=-.15-.022*math.sin(min(u*4,math.pi/2))-.014*u*math.sin(65*x)
            z=Z-.30*u+.003*u*math.sin(65*x)
        verts.append((x,y,z))
for j in range(ny):
    for i in range(nx):
        a=j*(nx+1)+i
        faces.append((a,a+1,a+nx+2,a+nx+1))
mesh=bpy.data.meshes.new('Draped linen with hem folds')
mesh.from_pydata(verts,[],faces)
mesh.update()
o=bpy.data.objects.new('White tablecloth - continuous drape',mesh)
scene.collection.objects.link(o)
finish(o,o.name,cloth)
for p in mesh.polygons:p.use_smooth=True
mod=o.modifiers.new('Linen thickness','SOLIDIFY')
mod.thickness=.0005

# Reuse the approved sensor and its integrated wedge, preserving the source.
prefixes=('Silver Shield tapered','Housing cap seam','Smooth opaque','Integrated rounded',
          'Recessed lower','Micro USB socket','Round reset','Status LED','Printed Micro')
sensor=[]
for original in source.objects:
    if original.name.startswith(prefixes):
        copy=original.copy()
        copy.data=original.data.copy()
        scene.collection.objects.link(copy)
        copy.name='Lineup - '+original.name
        sensor.append(copy)
rotation=Matrix.Rotation(math.radians(-135),4,'Z')
transform=Matrix.Translation(Vector((-.245,0,Z))) @ rotation @ Matrix.Translation(Vector((0,0,-2.482)))
for o in sensor:o.matrix_world=transform @ o.matrix_world

# Mini in its charging cradle; rounded shell, SOS ring, speaker and side controls.
x=-.115
box('Mini charging cradle',(x,0,Z+.010),(.071,.058,.020),case,.007)
box('Mini cradle top',(x,0,Z+.020),(.066,.053,.004),black,.006)
box('Mini pendant',(x,0,Z+.055),(.039,.022,.078),case,.015)
box('Mini front',(x,-.0105,Z+.055),(.035,.003,.072),case,.012)
cylinder('Mini SOS button',(x,-.0125,Z+.039),.0095,.001,case)
bpy.ops.mesh.primitive_torus_add(major_radius=.0097,minor_radius=.00065,
    major_segments=96,minor_segments=12,location=(x,-.0133,Z+.039),rotation=(math.pi/2,0,0))
finish(bpy.context.object,'Mini illuminated SOS ring',lit)
for i in range(3):
    for j in range(2):
        box('Mini speaker aperture',(x+.007+i*.0028,-.0128,Z+.074+j*.003),(.0013,.0005,.002),black,.0005)
box('Mini side volume',(x-.020,0,Z+.067),(.0015,.008,.011),silver,.0007)
box('Mini side power',(x-.020,0,Z+.049),(.0015,.006,.007),case,.0007)
cylinder('Mini lanyard opening',(x,0,Z+.094),.003,.002,black,axis=(0,0,1))
box('Mini dock status LED',(x,-.0295,Z+.009),(.0013,.0006,.005),lit,.0006)

def strap(name,x,height,width,inner=None):
    # Elliptical wrist loop, thickness and actual casting geometry.
    vs=[];fs=[];n=128
    for i in range(n):
        a=2*math.pi*i/n
        for side,thick in ((-1,0),(1,0),(-1,1),(1,1)):
            vs.append((x+side*width/2, (.027-thick*.0028)*math.sin(a),
                       Z+height/2+(height/2-thick*.0028)*math.cos(a)))
    for i in range(n):
        a=i*4;b=((i+1)%n)*4
        fs.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),
                   (a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
    me=bpy.data.meshes.new(name+' loop');me.from_pydata(vs,[],fs);me.update()
    ob=bpy.data.objects.new(name+' silicone wristband',me);scene.collection.objects.link(ob)
    finish(ob,ob.name,black)
    if inner:
        me.materials.append(inner)
        for i,p in enumerate(me.polygons):
            if i%4==1:p.material_index=1
    for p in me.polygons:p.use_smooth=True

def watch(name,x,height,square=True,wander=False):
    strap(name,x,height,.022,orange if wander else None)
    center=Z+height*.59
    if square:
        w=.044 if wander else .039
        box(name+' rounded metal case',(x,-.025,center),(w,.013,.047 if wander else .043),case,.008)
        box(name+' display',(x,-.032,center),(w-.005,.002,.041 if wander else .037),glass,.007)
    else:
        cylinder(name+' round bezel',(x,-.025,center),.022,.012,silver)
        cylinder(name+' round screen',(x,-.032,center),.0195,.0015,glass)
    cylinder(name+' crown',(x+.023,-.024,center),.0024,.004,silver,axis=(1,0,0))
    if wander:
        label(name+' time','16:57',(x,-.0335,center+.005),.010,lit)
        label(name+' SOS','SOS >',(x,-.0335,center-.008),.005,lit)
        label(name+' Sony','SONY',(x,-.0335,center-.016),.003,lit)
        label(name+' strap mark','SAFETRX',(x,-.024,Z+.011),.003,orange)
    elif square:
        for i in range(12):
            a=i*math.pi/6
            box(name+' clock marker',(x+math.sin(a)*.013,-.0335,center+math.cos(a)*.013),(.0007,.0003,.002),lit,.0002)
        hand=box(name+' hour hand',(x-.003,-.034,center+.003),(.001,.0004,.010),blue,.0003)
        hand.rotation_euler.y=math.radians(-40)
        hand=box(name+' minute hand',(x+.004,-.034,center+.002),(.001,.0004,.014),lit,.0003)
        hand.rotation_euler.y=math.radians(65)
    else:
        label(name+' date','TUE 15',(x,-.0335,center+.008),.0035,blue)
        label(name+' time','10:09',(x,-.0335,center-.002),.009,lit)
    return center

watch('Wander Alert',.002,.078,True,True)
watch('Oktave',.098,.070)
watch('Comfort',.188,.062,False)
# Four individual white SafeTrx beacons, smallest devices at the right end.
for i in range(4):
    x=.264+(i%2)*.027
    y=.012+(i//2)*.034
    cylinder('SafeTrx beacon housing',(x,y,Z+.0155),.0155,.012,white)
    cylinder('SafeTrx beacon face',(x,y-.0065,Z+.0155),.014,.0015,white)
    label('SafeTrx beacon logo','Zembro',(x,y-.0075,Z+.016),.0027,ink)

# Low-angle sun outside the composition, with sky fill and physical contact shadows.
bpy.ops.object.light_add(type='SUN',location=(-3,-4,6))
sun=bpy.context.object
sun.name='Off-camera afternoon sun'
sun.rotation_euler=Vector((.75,.55,-1.25)).to_track_quat('-Z','Y').to_euler()
sun.data.energy=2.2
sun.data.angle=math.radians(3)
sun.data.color=(1,.95,.86)
bpy.ops.object.light_add(type='AREA',location=(0,-.45,1.6))
fill=bpy.context.object
fill.name='Broad white studio bounce'
fill.data.energy=1.2
fill.data.size=1.5
fill.rotation_euler=(Vector((0,0,.78))-fill.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.30,-1.30,1.24))
camera=bpy.context.object
camera.name='Products lineup editorial camera'
camera.rotation_euler=(Vector((.01,0,.783))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=.76
camera.data.clip_start=.01
scene.camera=camera
scene.render.filepath=str(ROOT/'products-sunny-table.png')
bpy.context.preferences.filepaths.save_version=0
bpy.data.libraries.write(str(ROOT/'products-sunny-table.blend'),{scene},fake_user=True)
result={'scene':scene.name,'objects':len(scene.objects),'render':scene.render.filepath}
