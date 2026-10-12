"""Second product hero: reference-led exterior geometry, not manufacturer CAD.

Run in Blender with products-sunny-table.blend available. Creates a separate
scene/file, retaining the original. Only the studio and approved Shield are reused.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path('Y:/Zembro/landing/artwork/products')
source = bpy.data.scenes.get('Zembro - sunny product family on linen')
if source is None:
    raise RuntimeError('Load products-sunny-table.blend first')
bpy.ops.scene.new(type='NEW')
scene = bpy.context.scene
scene.name = 'Zembro - reference-led product family v2'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.cycles.device = 'GPU'
scene.render.resolution_x = 2400
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = .85
scene.world = source.world.copy()
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .45
scene.unit_settings.system = 'METRIC'
Z = .742

# Copy objects and their data so materials/transforms in the original stay intact.
for original in source.objects:
    if original.name.startswith(('Lineup -', 'White ', 'Off-camera', 'Broad white', 'Products lineup')):
        o = original.copy()
        if original.data:
            o.data = original.data.copy()
        scene.collection.objects.link(o)
        if o.type == 'CAMERA':
            scene.camera = o
        if o.name.startswith('Lineup -'):
            for slot in o.material_slots:
                if slot.material:
                    slot.material = slot.material.copy()
                    bsdf = slot.material.node_tree.nodes.get('Principled BSDF')
                    if bsdf and max(bsdf.inputs['Base Color'].default_value[:3]) > .6:
                        bsdf.inputs['Base Color'].default_value = (.72,.73,.71,1)
                        bsdf.inputs['Roughness'].default_value = .42

def material(name, color, rough=.4, metal=0, emission=0):
    m = bpy.data.materials.new('Reference hero - ' + name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color,1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emission:
        b.inputs['Emission Color'].default_value = (*color,1)
        b.inputs['Emission Strength'].default_value = emission
    return m

body = material('Mini matte charcoal',(.035,.038,.040),.55)
rubber = material('black silicone',(.009,.011,.013),.56)
housing = material('black watch polymer',(.016,.019,.022),.32)
edge = material('Oktave fine metal edge',(.21,.23,.25),.28,.65)
bezel = material('Comfort charcoal bezel',(.025,.029,.031),.32,.35)
glass = material('black curved display',(.002,.004,.006),.2)
black = material('openings and seams',(.001,.0015,.002),.85)
orange = material('SafeTrx orange lining',(.85,.27,.025),.63)
white = material('beacon white ABS',(.77,.79,.77),.42)
seam = material('beacon cap seam',(.42,.44,.43),.55)
screenwhite = material('white screen marks',(.85,.91,.93),.55,emission=.25)
blue = material('blue watch numerals',(.27,.66,.85),.55,emission=.2)
green = material('green battery',(.18,.68,.15),.55,emission=.2)
logoink = material('Zembro beacon print',(.015,.055,.04),.7)

def finish(o,name,mat):
    o.name=name
    o.data.materials.append(mat)
    return o

def rounded_outline(w,h,r,n=20):
    r=min(r,w/2,h/2)
    points=[]
    for cx,cz,start in ((w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),
                         (-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)):
        for i in range(n):
            a=math.radians(start+i*90/n)
            points.append((cx+r*math.cos(a),cz+r*math.sin(a)))
    return points

def rounded(name,loc,w,h,d,r,mat,roll=.001):
    """Rounded silhouette with an independent soft front/back edge radius.

    Cube bevels clamp the silhouette radius to the thin case depth; explicitly
    building contour rings keeps the broad product corner curvature intact.
    """
    roll=min(roll,d*.49)
    profiles=[]
    for i in range(7):
        a=(math.pi/2)*i/6
        inset=roll*(1-math.sin(a))
        profiles.append((-d/2+roll*(1-math.cos(a)),inset))
    profiles.append((d/2-roll,0))
    for i in range(1,7):
        a=(math.pi/2)*i/6
        profiles.append((d/2-roll+roll*math.sin(a),roll*(1-math.cos(a))))
    verts=[]
    for y,inset in profiles:
        verts.extend((x,y,z) for x,z in rounded_outline(w-2*inset,h-2*inset,max(.0001,r-inset)))
    n=80
    faces=[tuple(reversed(range(n)))]
    for layer in range(len(profiles)-1):
        for j in range(n):
            a=layer*n+j;b=layer*n+(j+1)%n
            faces.append((a,b,b+n,a+n))
    faces.append(tuple(range((len(profiles)-1)*n,len(profiles)*n)))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o)
    o.location=loc
    finish(o,name,mat)
    # Recalculate normals for the closed, explicitly contoured mesh.
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    for p in mesh.polygons:p.use_smooth=len(p.vertices)==4
    return o

def box(name,loc,dims,mat,r=.0005):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,mat)
    if r:
        m=o.modifiers.new('Small molded edge','BEVEL');m.width=r;m.segments=4
        o.modifiers.new('Face normals','WEIGHTED_NORMAL')
    return o

def cylinder(name,loc,r,d,mat,axis=(0,-1,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=128,radius=r,depth=d,location=loc)
    o=bpy.context.object;o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    finish(o,name,mat)
    m=o.modifiers.new('Molded circular edge','BEVEL');m.width=min(.0006,d*.24);m.segments=4
    o.modifiers.new('Circular normals','WEIGHTED_NORMAL')
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return o

def ring(name,loc,r,t,mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=128,
        minor_segments=12,location=loc,rotation=(math.pi/2,0,0))
    o=bpy.context.object
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat)

def label(name,body,loc,size,mat):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.align_x='CENTER';c.align_y='CENTER'
    c.space_character=1.05;c.resolution_u=12
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o)
    o.location=loc;o.rotation_euler=(math.pi/2,0,0);c.materials.append(mat)
    return o

def group_since(before,name,pivot,angle=0,tilt=0):
    bpy.context.view_layer.update()
    members=[o for o in scene.objects if o not in before]
    transform=Matrix.Translation(Vector(pivot)) @ Matrix.Rotation(angle,4,'Z') @ Matrix.Rotation(tilt,4,'X') @ Matrix.Translation(-Vector(pivot))
    for o in members:o.matrix_world=transform @ o.matrix_world
    return members

# Mini: wider, shorter pebble body; deep rounded dock and recessed tilted slot.
before=set(scene.objects)
x=-.115
dock=rounded('Mini II - deep charging base',(x,0,Z+.015),.084,.068,.030,.012,body,.002)
dock.rotation_euler.x=math.pi/2
top=rounded('Mini II - inset dock top',(x,0,Z+.0302),.078,.062,.0015,.011,body,.0003)
top.rotation_euler.x=math.pi/2
slot=rounded('Mini II - recessed cradle slot',(x,.007,Z+.0312),.050,.024,.001,.010,black,.0002)
slot.rotation_euler.x=math.pi/2
button=cylinder('Mini II - dock top pairing key',(x,-.020,Z+.0318),.007,.0007,body,(0,0,1))
rounded('Mini II - dock front status LED',(x,-.0344,Z+.013),.0016,.007,.0004,.0008,screenwhite,.0001)
pendant_before=set(scene.objects)
center=Z+.059
rounded('Mini II - pebble shell',(x,.007,center),.047,.066,.019,.020,body,.004)
rounded('Mini II - rear housing seam',(x,.015,center),.0465,.0655,.001,.0198,black,.0003)
cylinder('Mini II - recessed help button',(x,-.003,center-.015),.0105,.0008,body)
ring('Mini II - illuminated help ring',(x,-.0037,center-.015),.0107,.00065,screenwhite)
# Six diagonal speaker slots, rather than the former square grille.
for col in range(2):
    for row in range(3):
        o=rounded('Mini II - diagonal speaker slot',(x+.008+col*.003,-.003,center+.012+row*.003),.0015,.0026,.0004,.0007,black,.0001)
        o.rotation_euler.y=math.radians(32)
for dz,height,name in ((.009,.011,'volume'),(-.008,.010,'power')):
    o=rounded('Mini II - side '+name,(x-.0237,.007,center+dz),.007,height,.0008,.003,body,.0002)
    o.rotation_euler.z=-math.pi/2
    label('Mini II - '+name+' marking','+' if name=='volume' else 'O',(x-.0243,.007,center+dz),.0025,black).rotation_euler=(math.pi/2,0,-math.pi/2)
# Lanyard slot lies in the upper face, not a protruding round peg.
o=rounded('Mini II - lanyard opening',(x,.007,center+.0324),.012,.0035,.0006,.0017,black,.0001)
o.rotation_euler.x=math.pi/2
group_since(pendant_before,'Mini II pendant',(x,.007,Z+.031),0,math.radians(-9))
group_since(before,'Mini II whole',(x,0,Z),math.radians(-8))

def wristband(name,x,height,width,lining=False):
    # A formed silicone loop with separate inner colour, rounded edges and holes.
    n=192;ry=.026;rz=height/2;cz=Z+rz
    vs=[];fs=[]
    for i in range(n):
        a=2*math.pi*i/n
        for side,inner in ((-1,False),(1,False),(-1,True),(1,True)):
            vs.append((x+side*width/2,-(ry-(.0028 if inner else 0))*math.cos(a),
                       cz+(rz-(.0028 if inner else 0))*math.sin(a)))
    for i in range(n):
        a=i*4;b=((i+1)%n)*4
        fs.extend(((a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)))
    mesh=bpy.data.meshes.new(name+' formed band');mesh.from_pydata(vs,[],fs);mesh.update()
    ob=bpy.data.objects.new(name+' formed silicone band',mesh);scene.collection.objects.link(ob)
    finish(ob,ob.name,rubber)
    if lining:
        mesh.materials.append(orange)
        for i,p in enumerate(mesh.polygons):
            if i%4==1:p.material_index=1
    for p in mesh.polygons:p.use_smooth=True
    # Slots cut through the strap, with orange lining visible around their edges.
    if lining:
        for a in (-.57,-.78,-.99,-1.20):
            cut=rounded(name+' temporary strap slot',(x,-ry*math.cos(a),cz+rz*math.sin(a)),.010,.0035,.014,.0017,black,.0002)
            cut.rotation_euler.x=-a
            mod=ob.modifiers.new('Actual buckle hole','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut
            bpy.context.view_layer.objects.active=ob
            bpy.ops.object.modifier_apply(modifier=mod.name)
            # Only remove the temporary cutter created in this run.
            bpy.data.objects.remove(cut,do_unlink=True)
    mod=ob.modifiers.new('Soft silicone band edges','BEVEL');mod.width=.0006;mod.segments=3
    return ob

def battery(name,x,y,z,size=.003):
    # Tiny literal display icons, kept in the same plane as the reference faces.
    rounded(name+' battery outline',(x,y,z),size*1.7,size,.0001,.0004,screenwhite,.00002)
    rounded(name+' battery inset',(x,y-.00008,z),size*1.4,size*.7,.0001,.0002,glass,.00002)
    rounded(name+' battery fill',(x-.0004,y-.00015,z),size,size*.55,.0001,.0001,green,.00002)
    box(name+' battery terminal',(x+size*.9,y,z),(.0005,.0001,size*.4),screenwhite,.00005)

def signal(name,x,y,z):
    for i in range(4):
        box(name+' signal bar',(x+i*.001,y,z+i*.0003),(.00055,.00015,.0011+i*.0006),screenwhite,.0001)

# Wander Alert / Sony: deep curved square case, two long side controls, black
# exterior / orange interior silicone strap, buckle and printed SafeTrx strap.
before=set(scene.objects);x=.002;cz=Z+.047
wristband('Wander Alert',x,.086,.024,True)
for dz in (-.026,.026):
    rounded('Wander Alert molded strap lug',(x,-.020,cz+dz),.027,.012,.014,.003,housing,.0015)
rounded('Wander Alert curved Sony case',(x,-.026,cz),.044,.050,.016,.010,housing,.003)
rounded('Wander Alert fine screen lip',(x,-.0342,cz+.001),.0405,.043,.0015,.009,edge,.0004)
rounded('Wander Alert glass face',(x,-.0353,cz+.001),.039,.0415,.0016,.0088,glass,.0007)
for dz in (-.011,.011):
    o=rounded('Wander Alert right side control',(x+.0223,-.025,cz+dz),.007,.011,.002,.003,housing,.0005)
    o.rotation_euler.z=math.pi/2
signal('Wander',x-.013,-.0363,cz+.017)
battery('Wander',x+.013,-.0363,cz+.017,.002)
label('Wander display Zembro','Zembro',(x,-.0363,cz+.012),.0031,screenwhite)
label('Wander display time','16:57',(x,-.0363,cz+.002),.010,screenwhite)
label('Wander display SOS','SOS >',(x,-.0363,cz-.008),.005,screenwhite)
label('Wander Sony mark','SONY',(x,-.0363,cz-.017),.0036,screenwhite)
label('Wander printed strap','SAFETRX',(x,-.026,Z+.016),.0034,orange)
# Buckle frame and retaining loop visible on the rear strap.
for dx in (-.012,.012):box('Wander buckle side',(x+dx,.024,Z+.030),(.002,.007,.019),bezel)
for dz in (-.008,.008):box('Wander buckle bridge',(x,.024,Z+.030+dz),(.026,.007,.002),bezel)
box('Wander buckle tongue',(x,.020,Z+.032),(.0015,.003,.016),bezel)
box('Wander strap keeper',(x,.026,Z+.047),(.027,.006,.008),rubber,.001)
group_since(before,'Wander whole',(x,0,Z),math.radians(-10))

# Oktave: broad rounded cushion outline, thin silver surround, lower home key,
# blue 12/3/6/9 analog display and status line as in the supplied artwork.
before=set(scene.objects);x=.098;cz=Z+.046
wristband('Oktave',x,.080,.023)
for dz in (-.025,.025):
    rounded('Oktave strap attachment',(x,-.020,cz+dz),.028,.009,.009,.003,housing,.001)
rounded('Oktave cushion housing',(x,-.025,cz),.043,.048,.013,.011,housing,.0027)
rounded('Oktave narrow silver surround',(x,-.0317,cz),.0405,.045,.0018,.010,edge,.0006)
rounded('Oktave display',(x,-.033,cz),.0378,.0418,.0013,.0093,glass,.0005)
rounded('Oktave upper earpiece',(x,-.0329,cz+.0225),.010,.0013,.0004,.0005,black,.0001)
rounded('Oktave lower home key',(x,-.034,cz-.020),.010,.004,.0008,.0013,housing,.0003)
o=rounded('Oktave side SOS key',(x+.0217,-.025,cz+.004),.006,.008,.0015,.002,housing,.0004);o.rotation_euler.z=math.pi/2
y=-.03385
signal('Oktave',x-.014,y,cz+.0155)
label('Oktave network','4G',(x-.007,y,cz+.015),.0024,screenwhite)
label('Oktave charge','80%',(x+.007,y,cz+.015),.0022,screenwhite)
battery('Oktave',x+.013,y,cz+.015,.0021)
clock=cz-.003
for i in range(12):
    a=i*math.pi/6
    if i%3:
        o=box('Oktave dial index',(x+math.sin(a)*.013,y,clock+math.cos(a)*.013),(.0006,.00012,.0025),screenwhite,.0001)
        o.rotation_euler.y=a
for value,dx,dz in (('12',0,.012),('3',.012,0),('6',0,-.012),('9',-.012,0)):
    label('Oktave blue numeral '+value,value,(x+dx,y,clock+dz),.0048,blue)
for angle,length,mat,name in ((-.9,.009,screenwhite,'hour'),(1.95,.013,screenwhite,'minute'),(-1.55,.012,blue,'second')):
    dx=math.sin(angle)*length;dz=math.cos(angle)*length
    o=box('Oktave '+name+' hand',(x+dx/2,y-.00018,clock+dz/2),(.00045,.00015,length),mat,.0001)
    o.rotation_euler.y=angle
cylinder('Oktave central pivot',(x,y-.0003,clock),.0008,.0002,blue)
group_since(before,'Oktave whole',(x,0,Z),math.radians(-8))

# Comfort: dark sculpted bezel and projecting strap lugs, not a silver disc.
before=set(scene.objects);x=.188;cz=Z+.042
wristband('Comfort',x,.073,.022)
for dx in (-.014,.014):
    for dz in (-.022,.022):
        lug=rounded('Comfort tapered lug',(x+dx,-.021,cz+dz),.006,.012,.010,.0015,bezel,.001)
        lug.rotation_euler.y=(-1 if dx<0 else 1)*(-1 if dz<0 else 1)*math.radians(-25)
cylinder('Comfort black circular housing',(x,-.025,cz),.023,.013,housing)
cylinder('Comfort sculpted charcoal bezel',(x,-.032,cz),.0226,.0028,bezel)
cylinder('Comfort inset black glass',(x,-.0337,cz),.0193,.0013,glass)
ring('Comfort fine inner bezel',(x,-.0341,cz),.020,.0004,bezel)
for i in range(4):
    a=math.pi/4+i*math.pi/2
    o=rounded('Comfort diagonal bezel relief',(x+math.sin(a)*.0215,-.0336,cz+math.cos(a)*.0215),.004,.007,.0005,.0018,housing,.00015)
    o.rotation_euler.y=a
cylinder('Comfort crown',(x+.024,-.025,cz),.003,.004,bezel,(1,0,0))
signal('Comfort',x-.006,-.0345,cz+.012)
battery('Comfort',x+.005,-.0345,cz+.012,.0028)
label('Comfort blue date','TUE 15',(x,-.0345,cz+.006),.0038,blue)
label('Comfort time','10:09',(x-.001,-.0345,cz-.003),.0105,screenwhite)
label('Comfort pm','pm',(x+.015,-.0345,cz-.005),.0028,screenwhite)
group_since(before,'Comfort whole',(x,0,Z),math.radians(-9))

# Four SafeTrx room beacons: deep white circular pucks with recessed cap seam
# and Zembro/SafeTrx branding. Each is real closed geometry.
for i in range(4):
    x=.267+(i%2)*.035;y=.005+(i//2)*.034;cz=Z+.016
    before=set(scene.objects)
    cylinder('SafeTrx white puck body',(x,y,cz),.016,.011,white)
    cylinder('SafeTrx recessed cap seam',(x,y-.0057,cz),.015,.0007,seam)
    cylinder('SafeTrx inset front cap',(x,y-.0062,cz),.0145,.001,white)
    ring('SafeTrx molded cap rim',(x,y-.0069,cz),.0147,.0003,white)
    label('SafeTrx Zembro print','Zembro',(x+.001,y-.0069,cz+.001),.0032,logoink)
    label('SafeTrx small print','SAFETRX',(x+.002,y-.0069,cz-.002),.0014,logoink)
    # Pin silhouette is modeled, its interior punched visually with white.
    pin=cylinder('SafeTrx logo pin',(x-.007,y-.0069,cz+.0018),.0017,.0001,logoink)
    cylinder('SafeTrx logo pin centre',(x-.007,y-.0070,cz+.0019),.00065,.0001,white)
    group_since(before,'Beacon whole',(x,y,Z),math.radians(-12))

scene.camera.location=(.24,-1.30,1.20)
scene.camera.rotation_euler=(Vector((.015,0,.785))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=.76
scene.camera.data.clip_start=.01
scene.render.filepath=str(ROOT/'products-sunny-table-v2.png')
bpy.context.view_layer.update()
bpy.data.libraries.write(str(ROOT/'products-sunny-table-v2.blend'),{scene},fake_user=True)
result={'scene':scene.name,'objects':len(scene.objects),'render':scene.render.filepath}
