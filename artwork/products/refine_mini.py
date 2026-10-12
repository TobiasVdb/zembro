"""Mini multi-angle correction and product hero light/dark studio scenes.

References: EV12 Mini² Frontview, Sideview, Backview and With charging base.
Preserves the v2 scene, all other devices and existing renders.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path('Y:/Zembro/landing/artwork/products')
sources=[s for s in bpy.data.scenes if s.name.startswith('Zembro - reference-led product family v2')]
if not sources:
    raise RuntimeError('Load products-sunny-table-v2.blend first')
source=sources[-1]
bpy.ops.scene.new(type='NEW')
scene=bpy.context.scene
scene.name='Zembro - multi-angle Mini lineup light'
for original in source.objects:
    if original.name.startswith('Mini II'):
        continue
    copy=original.copy()
    if original.data:copy.data=original.data.copy()
    scene.collection.objects.link(copy)
    if copy.type=='CAMERA':scene.camera=copy
scene.world=source.world.copy()
scene.render.engine='CYCLES'
scene.cycles.samples=96
scene.cycles.use_denoising=True
scene.cycles.device='GPU'
scene.render.resolution_x=2400
scene.render.resolution_y=1080
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=.85
scene.unit_settings.system='METRIC'
Z=.742
X=-.115

def material(name,color,rough=.5,metal=0,emission=0):
    m=bpy.data.materials.new('Mini multi-angle - '+name);m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*color,1)
    b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal
    if emission:
        b.inputs['Emission Color'].default_value=(*color,1)
        b.inputs['Emission Strength'].default_value=emission
    return m

shellmat=material('fine charcoal ABS',(.037,.040,.042),.56)
dockmat=material('dock satin charcoal',(.024,.026,.028),.4)
black=material('recesses',(.001,.001,.001),.85)
buttonmat=material('button elastomer',(.027,.029,.031),.62)
silver=material('charging pads and fasteners',(.42,.44,.45),.3,.75)
led=material('diffused white light',(.85,.91,.95),.45,emission=.6)

def outline(w,h,r,n=24):
    pts=[]
    for cx,cz,start in ((w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),
                        (-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)):
        for i in range(n):
            a=math.radians(start+90*i/n)
            pts.append((cx+r*math.cos(a),cz+r*math.sin(a)))
    return pts

def mesh_object(name,verts,faces,mat):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob)
    me.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    for p in me.polygons:p.use_smooth=len(p.vertices)==4
    return ob

def capsule(name,loc,w,h,d,r,mat):
    pts=outline(w,h,min(r,w/2,h/2));n=len(pts)
    verts=[(x,y,z) for y in (-d/2,d/2) for x,z in pts]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    ob=mesh_object(name,verts,faces,mat);ob.location=loc
    return ob

def cylinder(name,loc,r,d,mat,axis=(0,-1,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=r,depth=d,location=loc)
    ob=bpy.context.object;ob.name=name;ob.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    ob.data.materials.append(mat)
    for p in ob.data.polygons:p.use_smooth=len(p.vertices)==4
    return ob

def cut(ob,cutter):
    bpy.context.view_layer.objects.active=ob
    mod=ob.modifiers.new('Actual recessed opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # Cutter is temporary geometry made by this script, never a source object.
    bpy.data.objects.remove(cutter,do_unlink=True)

def path_line(name,points,r,mat):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D'
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points):p.co=(*co,1)
    curve.bevel_depth=r;curve.bevel_resolution=3
    ob=bpy.data.objects.new(name,curve);scene.collection.objects.link(ob);curve.materials.append(mat)
    return ob

before=set(scene.objects)
# The charging base is slightly wider at its foot, with an inset flush top.
verts=[];faces=[];n=96
for z,w,d,r in ((.0005,.073,.062,.009),(.002,.075,.064,.010),
                (.0265,.071,.060,.009),(.028,.0695,.0585,.0085)):
    verts.extend((X+x,y,Z+z) for x,y in outline(w,d,r))
faces=[tuple(reversed(range(n))),tuple(range(3*n,4*n))]
for j in range(3):
    faces += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for i in range(n)]
dock=mesh_object('Mini III - tapered charging dock',verts,faces,dockmat)
top=capsule('Mini III - flush inset dock top',(X,0,Z+.0281),.068,.057,.0007,.008,shellmat)
top.rotation_euler.x=math.pi/2
for ob in (dock,top):
    cutter=capsule('Temporary dock recess',(X,.008,Z+.029),.043,.023,.027,.009,black)
    cutter.rotation_euler.x=math.pi/2
    cut(ob,cutter)
slot=capsule('Mini III - interior docking well',(X,.008,Z+.016),.042,.022,.001,.008,black)
slot.rotation_euler.x=math.pi/2
cylinder('Mini III - flush top pairing button',(X,-.017,Z+.0287),.0062,.0005,buttonmat,(0,0,1))
capsule('Mini III - front status light',(X,-.0315,Z+.0125),.0015,.0062,.0004,.0007,led)

pendant_before=set(scene.objects)
C=Z+.055
# Front/back contour rings create a broad shallow dome and a straight side band.
# Front-view ratio is ~0.56; former pill geometry was too wide and too rounded.
verts=[];profiles=[]
for i in range(1,25):
    s=i/24
    profiles.append((s,-.0085+.0048*s**6))
profiles.append((1,.0037))
for i in range(23,0,-1):
    s=i/24
    profiles.append((s,.0082-.0045*s**6))
for s,y in profiles:
    verts.extend((X+x,.008+y,C+z) for x,z in outline(.039*s,.070*s,.0105*s))
faces=[tuple(reversed(range(n))),tuple(range((len(profiles)-1)*n,len(profiles)*n))]
for j in range(len(profiles)-1):
    faces += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for i in range(n)]
shell=mesh_object('Mini III - domed face and straight side band',verts,faces,shellmat)
tri=shell.modifiers.new('Stable curved surface triangulation','TRIANGULATE')
bpy.context.view_layer.objects.active=shell
bpy.ops.object.modifier_apply(modifier=tri.name)
# Upper-front lanyard slot passes through the housing, as seen front and back.
cut(shell,capsule('Temporary lanyard slot',(X,.008,C+.032),.0092,.0023,.035,.0011,black))
# Seven diagonal grille openings arranged as the reference's compact diamond.
for col,row in ((-1,0),(-1,1),(0,-1),(0,0),(0,1),(1,-1),(1,0)):
    dx=col*.0029;dz=row*.0029
    angle=math.radians(42)
    px=.009+dx*math.cos(angle)+dz*math.sin(angle)
    pz=.017-dx*math.sin(angle)+dz*math.cos(angle)
    cutter=capsule('Temporary speaker perforation',(X+px,.0001,C+pz),.0012,.0022,.007,.0006,black)
    cutter.rotation_euler.y=angle
    cut(shell,cutter)
# Interior dark material can be seen through the seven actual cut-outs.
capsule('Mini III - speaker interior',(X+.009,.004,C+.017),.011,.011,.0005,.003,black)
cut(shell,cylinder('Temporary help button recess',(X,-.0007,C-.014),.0092,.004,black))
for p in shell.data.polygons:p.use_smooth=True
normals=shell.modifiers.new('Preserve domed surface shading','WEIGHTED_NORMAL')
normals.keep_sharp=True
cylinder('Mini III - help button surround',(X,-.0006,C-.014),.0091,.0008,black)
cylinder('Mini III - help button face',(X,-.0012,C-.014),.0079,.0007,buttonmat)
bpy.ops.mesh.primitive_torus_add(major_radius=.0083,minor_radius=.00055,major_segments=128,
    minor_segments=16,location=(X,-.0016,C-.014),rotation=(math.pi/2,0,0))
ring=bpy.context.object;ring.name='Mini III - white help ring';ring.data.materials.append(led)
for p in ring.data.polygons:p.use_smooth=True
# Shell join line follows the perimeter at the front/side transition.
path_line('Mini III - fine housing seam',[(X+x,.0043,C+z) for x,z in outline(.0391,.0701,.0105)]+[(X+outline(.0391,.0701,.0105)[0][0],.0043,C+outline(.0391,.0701,.0105)[0][1])],.00009,buttonmat)
# Side controls: upper phone key, lower audio/power key and small indicators.
for dz,name in ((.010,'phone'),(-.004,'audio')):
    for w,h,y,mat,suffix in ((.0051,.0102,X-.0196,black,' recess'),(.0044,.0094,X-.0199,buttonmat,' key')):
        key=capsule('Mini III - '+name+suffix,(y,.008,C+dz),w,h,.0005,.002,mat)
        key.rotation_euler.z=math.pi/2
for dz in (.017,.003,-.011):
    cylinder('Mini III - side indicator',(X-.0197,.008,C+dz),.00065,.0003,silver,(-1,0,0))
cylinder('Mini III - lower microphone',(X-.0196,.010,C-.023),.00045,.0004,black,(-1,0,0))
# Rear-view fasteners, recessed charging contacts and microphone.
for dx in (-.0148,.0148):
    for dz in (-.028,.028):
        cylinder('Mini III - rear screw recess',(X+dx,.0155,C+dz),.00155,.001,black,(0,1,0))
        cylinder('Mini III - rear screw head',(X+dx,.0161,C+dz),.00115,.0003,silver,(0,1,0))
        path_line('Mini III - screw cross',[(X+dx-.0006,.0163,C+dz),(X+dx+.0006,.0163,C+dz)],.00012,black)
        path_line('Mini III - screw cross',[(X+dx,.0163,C+dz-.0006),(X+dx,.0163,C+dz+.0006)],.00012,black)
rear=capsule('Mini III - rear charging recess',(X,.0164,C-.022),.013,.0045,.0005,.002,black)
for dx in (-.0048,-.0008,.002,.0048):
    cylinder('Mini III - rear charging contact',(X+dx,.0168,C-.022),.001,.0003,silver,(0,1,0))
cylinder('Mini III - rear microphone',(X+.005,.016,C-.030),.0005,.0004,black,(0,1,0))
# The pendant leans back in its dock. Turn the whole Mini toward its control side,
# matching the supplied with-base render; the other products retain their framing.
bpy.context.view_layer.update()
pivot=Vector((X,.008,Z+.023))
tilt=Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(-12),4,'X') @ Matrix.Translation(-pivot)
for ob in scene.objects:
    if ob not in pendant_before:ob.matrix_world=tilt @ ob.matrix_world
bpy.context.view_layer.update()
pivot=Vector((X,0,Z))
turn=Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(40),4,'Z') @ Matrix.Translation(-pivot)
for ob in scene.objects:
    if ob not in before:ob.matrix_world=turn @ ob.matrix_world
bpy.context.view_layer.update()
scene.render.filepath=str(ROOT/'products-sunny-table-v3.png')
bpy.data.libraries.write(str(ROOT/'products-sunny-table-v3.blend'),{scene},fake_user=True)

# Independent dark studio: same camera, geometry and natural material colours.
# Only the studio fabric/backdrop and illumination change, so white devices stay white.
light_scene=scene
bpy.ops.scene.new(type='NEW');dark=bpy.context.scene
dark.name='Zembro - multi-angle Mini lineup dark'
studio_cloth=material('dark teal linen',(.012,.031,.035),.92)
studio_wall=material('dark teal backdrop',(.008,.020,.024),.85)
for original in light_scene.objects:
    copy=original.copy()
    if original.data:copy.data=original.data.copy()
    dark.collection.objects.link(copy)
    if copy.type=='CAMERA':dark.camera=copy
    if original.name.startswith('White '):
        originalmat=original.data.materials[0]
        m=originalmat.copy()
        b=m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value=studio_cloth.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value if 'tablecloth' in original.name else studio_wall.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value
        copy.data.materials.clear();copy.data.materials.append(m)
    if copy.type=='LIGHT':
        if copy.data.type=='SUN':
            copy.data.energy=1.1;copy.data.color=(.82,.90,1)
        else:
            copy.data.energy=2.5;copy.data.color=(1,.92,.83)
dark.world=light_scene.world.copy()
dark.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.19,.23,1)
dark.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.18
dark.render.engine='CYCLES';dark.cycles.samples=96;dark.cycles.use_denoising=True;dark.cycles.device='GPU'
dark.render.resolution_x=2400;dark.render.resolution_y=1080;dark.render.resolution_percentage=100
dark.render.image_settings.file_format='PNG'
dark.view_settings.view_transform='AgX';dark.view_settings.look='AgX - Medium High Contrast'
dark.view_settings.exposure=.6
dark.render.filepath=str(ROOT/'products-sunny-table-v3-dark.png')
bpy.ops.object.light_add(type='AREA',location=(0,.26,1.13))
rim=bpy.context.object;rim.name='Dark studio soft rim';rim.data.energy=1.8;rim.data.size=.8
rim.data.color=(.58,.79,.85)
rim.rotation_euler=(Vector((0,0,.79))-rim.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update()
bpy.data.libraries.write(str(ROOT/'products-sunny-table-v3-dark.blend'),{dark},fake_user=True)
# Leave light scene selected for the first render.
bpy.context.window.scene=light_scene
result={'light':light_scene.name,'dark':dark.name,'objects':len(light_scene.objects)}
