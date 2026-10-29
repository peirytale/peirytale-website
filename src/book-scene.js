import * as THREE from 'three';
import {createGarden,createCastleDoors} from './garden-world.js';
import {createTerrace} from './garden-terrace.js';
import {createFutureGarden} from './future-garden.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// The page is subdivided so the vertex shader bends the sheet, rather than
// rotating a flat screenshot. Its hinge stays fixed at the book's spine.
const vertex = `
uniform float turn;
uniform float direction;
varying vec2 vUv;
varying float fold;
void main(){
 vUv=uv;
 float x=position.x;
 float angle=turn*3.14159265;
 // A broad bowed leaf remains visible at the middle of a turn. The sine
 // vanishes at both edges, so the spine and outer page edge stay attached.
 float curl=sin(angle)*sin(uv.x*3.14159265);
 vec3 p=position;
 // The sheet's broad lateral bow stays inside the boards while giving the
 // middle of a turn enough width to read as paper rather than a thin strip.
 p.x=direction*(x*cos(angle)-1.65*curl*sin(angle));
 // A leaf bows towards the reader, but its upper and lower edges must stay
 // inside the bound book instead of ballooning beyond the boards in perspective.
 float raised=sin(angle)*uv.x;
 p.y*=1.0-0.12*raised;
 p.z+=0.32*x*sin(angle)+0.94*curl*cos(angle);
 fold=sin(angle)*uv.x;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`;
const fragment = `
uniform vec3 paper;
uniform sampler2D frontPage;
uniform sampler2D backPage;
uniform float direction;
varying vec2 vUv;
varying float fold;
void main(){
 float grain=fract(sin(dot(vUv,vec2(127.1,311.7)))*43758.5453);
 float edge=smoothstep(0.0,0.07,vUv.x);
 bool front=gl_FrontFacing==(direction>0.0);
 vec2 pageUv=vec2(front==(direction>0.0)?vUv.x:1.0-vUv.x,vUv.y);
 vec3 ink=front?texture2D(frontPage,pageUv).rgb:texture2D(backPage,pageUv).rgb;
 vec3 color=ink*(0.89+edge*0.11-fold*0.16)+(grain-0.5)*0.012;
 gl_FragColor=vec4(color,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export class BookScene {
 constructor(canvas, onReady) {
  this.canvas=canvas; this.dirty=true; this.opened=false; this.chapter=0; this.quiet=false;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,canvas.clientWidth<700?1.25:1.5));
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.scene=new THREE.Scene();
  this.camera=new THREE.PerspectiveCamera(32,1,.1,100);
  this.camera.position.set(0,0,14);
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x9d8e82,1.5));
  const light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(-3,5,8);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:25});light.shadow.intensity=.25;light.shadow.bias=-.0005;light.shadow.normalBias=.025;this.scene.add(light);this.sun=light;
  this.book=new THREE.Group();this.scene.add(this.book);
  this.restRotation=new THREE.Euler(-.48,.14,-.16);this.book.rotation.copy(this.restRotation);this.book.scale.setScalar(.84);
  this.shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{opacity:{value:.27},spread:{value:0}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv; uniform float opacity; uniform float spread; void main(){vec2 p=(vUv-vec2(.5))*2.;float radius=length(p)/(1.+spread*.1);float core=1.-smoothstep(.38,.75,radius);float penumbra=1.-smoothstep(.43,1.,radius);gl_FragColor=vec4(.20,.16,.13,(core*.62+penumbra*.38)*opacity);}'});
  // The contact shadow is cast onto the tabletop plane, not tilted with the
  // cover. Tilting the shadow made it disappear behind the table at one edge.
  this.contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(8,9),this.shadowMaterial);this.contactShadow.position.set(.34,-.24,-2.48);this.contactShadow.rotation.z=this.restRotation.z;this.scene.add(this.contactShadow);
  const tableMaterial=new THREE.ShaderMaterial({uniforms:{},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv; void main(){float weave=sin(vUv.x*6500.)*sin(vUv.y*6500.)*.002;float grain=fract(sin(dot(vUv,vec2(173.3,39.7)))*43758.5453)*.009;vec3 c=mix(vec3(.84,.81,.76),vec3(.96,.94,.89),1.-smoothstep(.0,.65,length(vUv-.5)));gl_FragColor=vec4(c+weave+grain,1.);}' });
  this.table=new THREE.Mesh(new THREE.PlaneGeometry(60,60),tableMaterial);this.table.position.z=-2.5;this.scene.add(this.table);
  this.paperMaterial=new THREE.MeshBasicMaterial({color:0xfffaef});
  this.bindingMaterial=new THREE.MeshStandardMaterial({color:0x9bb9c9,roughness:1});
  this.closedVolume=new THREE.Group();this.book.add(this.closedVolume);
  const volumePart=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);this.closedVolume.add(mesh);return mesh;};
  volumePart(new THREE.BoxGeometry(4.12,5.7,.1),this.bindingMaterial,0,0,-.3);
  volumePart(new THREE.BoxGeometry(3.96,5.46,.36),this.paperMaterial,.02,0,-.07);
  const edgeMaterial=new THREE.MeshBasicMaterial({color:0xd5c9af});
  // Thin recessed edges reveal the signatures when the whole volume lifts.
  for(let i=0;i<30;i++){
   const z=-.24+i*.011;
   volumePart(new THREE.BoxGeometry(.005,5.43,.0025),edgeMaterial,2.003,0,z);
   for(const y of [-2.731,2.731])volumePart(new THREE.BoxGeometry(3.95,.005,.0025),edgeMaterial,.02,y,z);
  }
  volumePart(new THREE.CylinderGeometry(.21,.21,5.6,24),this.bindingMaterial,-1.98,0,-.06).scale.z=.85;
  const threadMaterial=new THREE.MeshStandardMaterial({color:0x91b2c9,roughness:.85});
  for(const y of [-2.71,2.71])for(let i=0;i<12;i++){
   const thread=volumePart(new THREE.TorusGeometry(.042,.009,6,10),threadMaterial,-1.9+i*.025,y,-.04);
   thread.rotation.x=Math.PI/2;
  }
  this.back=this.box(8.18,5.68,.13,this.bindingMaterial,0,0,-.22);
  this.left=this.box(3.98,5.5,.19,this.paperMaterial,-2,0,-.08);
  this.right=this.box(3.98,5.5,.19,this.paperMaterial,2,0,-.08);
  // Subtle crowned leaves catch light across the binding and gutter.
  this.pageSurfaces=[-1,1].map(side=>{
   const geometry=new THREE.PlaneGeometry(3.98,5.5,64,16),positions=geometry.attributes.position;
   for(let i=0;i<positions.count;i++){const u=(positions.getX(i)+1.99)/3.98;positions.setZ(i,.021+.04*Math.sin(Math.PI*u)+.006*Math.cos(positions.getY(i)));}
   geometry.computeVertexNormals();
   const material=new THREE.MeshStandardMaterial({color:0xfffaef,roughness:.96,emissive:0xfffaef,emissiveIntensity:.3});
   material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 pageUV;').replace('#include <uv_vertex>','#include <uv_vertex>\npageUV=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 pageUV;').replace('#include <color_fragment>',`#include <color_fragment>
     float gutter=exp(-${side>0?'pageUV.x':'(1.0-pageUV.x)'}*25.0);
     float fibre=fract(sin(dot(pageUV,vec2(1271.1,3117.7)))*43758.5453)-.5;
     diffuseColor.rgb*=1.0-gutter*.10+fibre*.008;`);
   };
   material.customProgramCacheKey=()=>`paper-leaf-${side}`;
   const mesh=new THREE.Mesh(geometry,material);mesh.position.x=side*2;mesh.receiveShadow=false;this.book.add(mesh);return mesh;
  });
  this.edges=[];for(let i=0;i<5;i++)this.edges.push(this.box(8.02,.009,.01,new THREE.MeshBasicMaterial({color:0xd9ceba}),0,-2.74+i*.018,-.03));
  const pageGeometry=new THREE.PlaneGeometry(4,5.5,64,12);pageGeometry.translate(2,0,0);
  this.turnMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,uniforms:{turn:{value:0},direction:{value:1},paper:{value:new THREE.Color(0xfffaef)},frontPage:{value:null},backPage:{value:null}}});
  this.sheet=new THREE.Mesh(pageGeometry,this.turnMaterial);this.sheet.position.z=.12;this.sheet.visible=false;this.book.add(this.sheet);
  this.underPages=[-2,2].map(x=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.98,5.5),new THREE.MeshBasicMaterial());mesh.position.set(x,0,.09);mesh.visible=false;this.book.add(mesh);return mesh;});
  this.cornerMeshes=[-1,1].map(side=>{
   const geometry=new THREE.PlaneGeometry(.65,.65,16,16),positions=geometry.attributes.position;
   for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),curl=Math.max(0,(side*x-y)/.65);positions.setZ(i,.01+curl*curl*.15);}
   geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xfffaef,roughness:.9,side:THREE.DoubleSide}));mesh.position.set(side*3.66,-2.42,.04);mesh.visible=false;this.book.add(mesh);return mesh;
  });
  this.coverHinge=new THREE.Group();this.book.add(this.coverHinge);
  this.cover=new THREE.Mesh(new THREE.BoxGeometry(4.12,5.7,.12),this.bindingMaterial);this.cover.position.set(2.04,0,.18);this.coverHinge.add(this.cover);
  const innerPaper=new THREE.Mesh(new THREE.PlaneGeometry(4.08,5.65),new THREE.MeshBasicMaterial({color:0xfffaef}));innerPaper.position.set(2.04,0,.082);innerPaper.rotation.y=Math.PI;this.coverHinge.add(innerPaper);
  this.innerCoverMaterial=new THREE.MeshStandardMaterial({color:0x25232a,roughness:.94,transparent:true,depthWrite:false});
  const insideCover=new THREE.Mesh(new THREE.PlaneGeometry(4.08,5.65),this.innerCoverMaterial);insideCover.position.set(2.04,0,.075);insideCover.rotation.y=Math.PI;this.coverHinge.add(insideCover);
  this.coverHinge.position.x=-2.04;
  this.loadBinding();
  this.makeCover(onReady);
  this.world=new THREE.Group();this.world.position.x=-2;this.book.add(this.world);this.world.visible=false;
  // A thin paper veil reveals the already-formed scene only after the boards
  // finish opening. Squashing the world to the page used to turn the castle
  // into a horizontal streak visible behind the half-open cover.
  this.worldVeil=new THREE.Mesh(new THREE.PlaneGeometry(7.86,5.35),new THREE.MeshBasicMaterial({color:0xfffaef,transparent:true,opacity:0,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
  this.worldVeil.position.z=2.4;this.worldVeil.renderOrder=1000;this.worldVeil.visible=false;this.book.add(this.worldVeil);
  this.doorLight=new THREE.Mesh(new THREE.PlaneGeometry(.52,1.8),new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,uniforms:{strength:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float strength;void main(){float slit=exp(-pow((vUv.x-.5)*4.5,2.));float vertical=smoothstep(.02,.23,vUv.y)*(1.-smoothstep(.79,1.,vUv.y));gl_FragColor=vec4(1.,.94,.76,strength*slit*vertical);}'}));
  this.doorLight.position.set(0,-.53,1.35);this.doorLight.renderOrder=1001;this.doorLight.visible=false;this.book.add(this.doorLight);
  this.makeWorld();
  this.makeLandscape();
  this.consolidate(this.closedVolume);
  this.makeRibbon();
  this.loadGuide();
  this.resize=()=>this.fit();window.addEventListener('resize',this.resize);this.fit();
  this.start=performance.now();this.tick=this.tick.bind(this);this.frame=requestAnimationFrame(this.tick);
 }
 box(w,h,d,mat,x,y,z){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);this.book.add(mesh);return mesh;}
 async loadBinding(){
  try{
   const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
   const gltf=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/book-binding.glb`);
   gltf.scene.rotation.x=Math.PI/2;
   gltf.scene.traverse(o=>{if(o.isMesh&&o.material){o.material.color.set(0x9bb9c9);o.receiveShadow=true;}});
   this.coverHinge.add(gltf.scene);this.cover.visible=false;this.dirty=true;
   this.canvas.dataset.binding='loaded';
  }catch(error){this.canvas.dataset.binding='fallback';console.warn('Binding model unavailable; retaining basic cover.',error.message);}
 }
 makeCover(onReady){
  const lining=new Image();lining.fetchPriority='low';lining.onload=()=>{const t=new THREE.Texture(lining);t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;this.bindingMaterial.map=t;this.bindingMaterial.color.set(0xffffff);this.bindingMaterial.needsUpdate=true;this.dirty=true;};lining.src=`${import.meta.env.BASE_URL}assets/cover-fabric.webp`;
  const img=new Image();img.onload=()=>{
   // Rectified photograph of the user-supplied physical book. Its front has no
   // printed title; the observed Peiry Tale name belongs on the metal charm.
   const texture=new THREE.Texture(img);texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=this.renderer.capabilities.getMaxAnisotropy();
   const front=new THREE.Mesh(new THREE.PlaneGeometry(4.12,5.7),new THREE.MeshStandardMaterial({map:texture,roughness:.95}));front.position.set(2.04,0,.27);this.coverHinge.add(front);this.dirty=true;onReady?.();
  };img.onerror=()=>onReady?.();img.fetchPriority='high';img.src=`${import.meta.env.BASE_URL}assets/storybook-cover.webp`;
 }
 consolidate(group){
  group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),batches=new Map();
  group.traverse(o=>{if(!o.isMesh)return;const key=`${o.material.uuid}/${o.castShadow}/${o.receiveShadow}`;if(!batches.has(key))batches.set(key,{material:o.material,cast:o.castShadow,receive:o.receiveShadow,geometries:[]});const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));batches.get(key).geometries.push(g);});
  group.clear();for(const batch of batches.values()){const geometry=mergeGeometries(batch.geometries);if(geometry){const mesh=new THREE.Mesh(geometry,batch.material);mesh.castShadow=batch.cast;mesh.receiveShadow=batch.receive;group.add(mesh);}for(const g of batch.geometries)g.dispose();}
 }
 makeLandscape(){
  this.landscape=createGarden();this.world.add(this.landscape);
  this.consolidate(this.landscape);
  const doors=createCastleDoors();this.landscape.add(doors.root);this.castleDoors=doors.hinges;
  this.doorParts.forEach(part=>{part.visible=false;});this.doorParts=[];
 }
 makeRibbon(){
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.91,-2.75,.02),new THREE.Vector3(-1.83,-3.06,-.12),new THREE.Vector3(-1.55,-3.43,-.15),new THREE.Vector3(-1.02,-3.68,-.12)]);
  this.ribbon=new THREE.Group();this.closedVolume.add(this.ribbon);
  const thread=new THREE.Mesh(new THREE.TubeGeometry(curve,48,.015,6,false),new THREE.MeshStandardMaterial({color:0x8bbbd5,roughness:.72}));this.ribbon.add(thread);
  for(let i=0;i<5;i++){const bead=new THREE.Mesh(new THREE.SphereGeometry(i%2?.075:.065,20,14),new THREE.MeshPhysicalMaterial({color:[0xf7f3e8,0xb6a2d6,0xf7f3e8,0x94c5df,0xf7f3e8][i],roughness:.23,metalness:.08,clearcoat:.7}));bead.position.set(-1.27+i*.13,-3.64-i*.035,-.12);this.ribbon.add(bead);}
  const knot=new THREE.Mesh(new THREE.TorusGeometry(.10,.012,8,32),new THREE.MeshStandardMaterial({color:0x8bbbd5,roughness:.68}));knot.position.set(-.57,-3.74,-.11);knot.rotation.z=.3;this.ribbon.add(knot);
  const shape=new THREE.Shape();shape.moveTo(0,.04);shape.bezierCurveTo(-.24,.28,-.34,-.07,0,-.28);shape.bezierCurveTo(.34,-.07,.24,.28,0,.04);
  const charm=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.05,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:4,steps:1,curveSegments:24}),new THREE.MeshPhysicalMaterial({color:0xcac6c0,metalness:.27,roughness:.2,clearcoat:1,clearcoatRoughness:.08}));charm.position.set(-.42,-3.91,-.12);charm.rotation.z=.3;charm.scale.setScalar(1.42);this.ribbon.add(charm);
  const markCanvas=document.createElement('canvas');markCanvas.width=1024;markCanvas.height=256;
  const mark=markCanvas.getContext('2d');mark.textAlign='center';mark.textBaseline='middle';mark.fillStyle='#fff';mark.font='700 150px Georgia';mark.fillText('Peiry Tale',512,128,860);
  const markTexture=new THREE.CanvasTexture(markCanvas);markTexture.colorSpace=THREE.SRGBColorSpace;
  // The real charm is polished silver: a broad window reflection and darker
  // room reflection move across its face. The name cuts into that reflection:
  // its dark floor and light upper lip read as a shallow engraved groove.
  const reflection=new THREE.Mesh(new THREE.ShapeGeometry(shape,24),new THREE.ShaderMaterial({uniforms:{engraving:{value:markTexture}},vertexShader:'varying vec2 facePoint; void main(){facePoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 facePoint; uniform sampler2D engraving;
   void main(){float x=facePoint.x+.2*facePoint.y;
    vec3 silver=mix(vec3(.28,.29,.30),vec3(.76,.77,.76),smoothstep(-.28,.22,x));
    float window=exp(-pow((x-.02)/.095,2.));
    float shade=exp(-pow((x+.2)/.075,2.));
    silver=clamp(silver+vec3(.36,.35,.32)*window-vec3(.17,.15,.13)*shade,0.,1.);
    vec2 markUv=vec2((facePoint.x+.23)/.46,(facePoint.y+.114)/.13);
    float cut=texture2D(engraving,markUv).a;
    float upper=texture2D(engraving,markUv+vec2(0.,.042)).a;
    float lower=texture2D(engraving,markUv-vec2(0.,.042)).a;
    silver=mix(silver,vec3(.09,.10,.12),cut*.98);
    silver=clamp(silver+vec3(.22,.21,.19)*max(0.,upper-cut)-vec3(.12)*max(0.,lower-cut),0.,1.);
    gl_FragColor=vec4(silver,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }` }));reflection.position.z=.087;charm.add(reflection);
 }
 async loadGuide(){
  try{
   const [{GLTFLoader},{MeshoptDecoder}]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/libs/meshopt_decoder.module.js')]);
   const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
   const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/peiry-guide.glb`);
   this.guide.clear();this.guide.add(gltf.scene);gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});gltf.scene.scale.setScalar(.86);
   this.guideModel=gltf.scene;this.mixer=new THREE.AnimationMixer(gltf.scene);
   this.guideClips=Object.fromEntries(gltf.animations.map(clip=>[clip.name,this.mixer.clipAction(clip)]));
   this.playGuide('Idle');this.mixer.update(0);this.canvas.dataset.guide='loaded';this.dirty=true;
  }catch(error){this.canvas.dataset.guide='fallback';console.warn('Guide model unavailable.',error.message);}
 }
 playGuide(name){
  const action=this.guideClips?.[name];if(!action||this.guideAction===action)return;
  action.reset().play();if(this.guideAction)action.crossFadeFrom(this.guideAction,.35,true);this.guideAction=action;
 }
 makeWorld(){
  const add=(geometry,color,x,y,z)=>{const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1}));mesh.position.set(x,y,z);this.world.add(mesh);return mesh;};
  this.arch=add(new THREE.TorusGeometry(.83,.035,8,60,Math.PI),0xb5bea5,2,.6,.18);
  for(const x of [1.17,2.83])add(new THREE.CylinderGeometry(.035,.035,1.8,8),0xb5bea5,x,-.3,.18);
  this.door=add(new THREE.PlaneGeometry(1.45,2.35),0xe9e6d8,2,-.2,.1);
  this.orb=add(new THREE.SphereGeometry(.12,16,12),0xd7b878,2,.5,.45);
  this.guide=new THREE.Group();this.world.add(this.guide);this.guide.position.set(1.2,-.86,1.5);
  const part=(geometry,color,x,y,z)=>{const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1}));m.position.set(x,y,z);this.guide.add(m);return m;};
  part(new THREE.ConeGeometry(.23,.52,16),0xa0787f,0,.12,0);
  part(new THREE.SphereGeometry(.14,20,16),0xf2d8bf,0,.49,0);
  part(new THREE.SphereGeometry(.145,20,16),0x584d43,0,.56,-.04);
  for(const x of [-.048,.048])part(new THREE.SphereGeometry(.011,8,8),0x443b32,x,.5,.13);
  for(const x of [-.09,.09])part(new THREE.CylinderGeometry(.025,.028,.18,8),0x65594b,x,-.19,0);
  this.arm=part(new THREE.CylinderGeometry(.027,.03,.27,8),0xf2d8bf,.2,.27,0);this.arm.rotation.z=-.6;
  for(let i=0;i<7;i++){
   const leaf=add(new THREE.SphereGeometry(.08,10,8),0x99a78b,1.1+i*.3,-1.8+Math.sin(i)*.05,.15);leaf.scale.set(1.6,.6,.35);
  }
  this.chapterProps=new THREE.Group();this.world.add(this.chapterProps);
  this.doorParts=this.world.children.filter(child=>child!==this.guide&&child!==this.chapterProps);
 }
 fit(){
  const w=this.canvas.clientWidth,h=this.canvas.clientHeight;this.renderer.setSize(w,h,false);
  this.mobile=w<700;const width=this.mobile?4.7:10.8;
  const height=Math.max(7.5,width*h/w,5.7*h/Math.max(150,h-155));
  const actualWidth=height*w/h;this.camera.aspect=w/h;this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(height/28));this.camera.updateProjectionMatrix();
  this.layout={width:8*w/actualWidth,height:5.5*h/height,x:w/2,y:h/2};
  this.applyPosition();
  this.canvas.dispatchEvent(new CustomEvent('bookresize',{detail:this.layout}));
 }
 applyPosition(){this.dirty=true;this.book.position.x=this.opened?(this.mobile?-2:0):0;this.left.visible=this.opened&&!this.mobile;this.right.visible=this.opened;this.pageSurfaces.forEach((m,i)=>m.visible=this.opened&&(!this.mobile||i===1));this.back.visible=this.opened;this.world.visible=this.opened;this.world.position.x=this.mobile?0:-2;if(this.landscape){this.landscape.scale.set(this.mobile?.52:.75,this.mobile?.65:.75,.75);this.landscape.position.set(this.mobile?.96:.5,.2,1);}if(this.chapterProps){this.chapterProps.scale.set(this.mobile?.72:.82,.78,.85);this.chapterProps.position.set(this.mobile?.56:.36,.45,.85);}for(const edge of this.edges)edge.visible=this.opened;}
 setOpeningVolume(progress){
  const p=THREE.MathUtils.clamp(progress,0,1),width=.5+.5*p;
  this.back.scale.x=width;
  this.right.position.x=2*p;this.pageSurfaces[1].position.x=2*p;
  this.left.position.x=-2*p;this.left.scale.x=Math.max(.001,p);
  this.pageSurfaces[0].position.x=-2*p;this.pageSurfaces[0].scale.x=Math.max(.001,p);
  this.left.visible=this.opened&&!this.mobile&&p>.04;
  this.pageSurfaces[0].visible=this.left.visible;
  this.innerCoverMaterial.opacity=1-THREE.MathUtils.smoothstep(p,.82,1);
  this.edges.forEach(edge=>edge.scale.x=width);
  this.dirty=true;
 }
 setWorldEmergence(progress){
  const reveal=THREE.MathUtils.clamp(progress,0,1);
  this.worldVeil.material.opacity=1-reveal;
  this.worldVeil.visible=this.opened&&reveal<1;
  this.dirty=true;
 }
 showVisual(value){this.visual=value;this.applyPosition();}
 setChapter(index){
  this.chapter=index;this.guideHome=[1.2,1.05,.65,.65,1.55][index]??1.2;this.guideTarget=undefined;if(this.quiet)this.guide.position.x=this.guideHome;this.chapterVersion=(this.chapterVersion||0)+1;this.activeUntil=0;this.dirty=true;
  for(const child of [...this.chapterProps.children]){child.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});this.chapterProps.remove(child);}
  this.petals=[];this.paperLeaves=[];
  for(const part of this.doorParts)part.visible=index===0;
  if(this.landscape)this.landscape.visible=index<2||index===4;
  this.sun.color.set(index===4?0xffe2cf:0xffffff);
  if(index===2||index===3)this.makeStudio(index);
  if(index===4){const future=createFutureGarden();this.chapterProps.add(future.group);this.consolidate(future.staticGroup);this.paperLeaves=future.leaves;}
 }
 makeStudio(index){
  const studio=new THREE.Group();this.chapterProps.add(studio);
  studio.add(createTerrace());
  const wood=new THREE.MeshStandardMaterial({color:0xc4ae8d,roughness:.78});
  const paper=new THREE.MeshStandardMaterial({color:0xf2e8d7,roughness:.9});
  const rose=new THREE.MeshStandardMaterial({color:0xb88b98,roughness:.76});
  const sage=new THREE.MeshStandardMaterial({color:0xa7b6a0,roughness:.8});
  const metal=new THREE.MeshStandardMaterial({color:0xbba16b,roughness:.35,metalness:.6});
  const put=(geometry,material,x,y,z)=>{const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;studio.add(o);return o;};
  // A small reading desk grows from the page. The framed image remains the
  // actual brand photograph; the surrounding props are illustrative scenery.
  put(new THREE.BoxGeometry(2.7,.09,.65),wood,2.45,-1.12,.23);
  for(const x of [1.25,3.65])for(const z of [-.02,.48])put(new THREE.CylinderGeometry(.035,.055,.56,12),wood,x,-1.43,z);
  for(let i=0;i<3;i++){const folio=put(new THREE.BoxGeometry(.6,.055,.42),i===1?sage:paper,3.38,-1.04+i*.056,.21);folio.rotation.y=(i-1)*.12;}
  const display=new THREE.Group();display.position.set(2.25,.03,.22);display.rotation.y=-.10;display.rotation.z=index===3?-.045:.035;this.chapterProps.add(display);
  const width=1.42,height=1.9;
  const mount=new THREE.Mesh(new THREE.BoxGeometry(width+.13,height+.13,.055),paper);mount.receiveShadow=true;display.add(mount);
  for(const x of [-width/2-.04,width/2+.04]){const edge=new THREE.Mesh(new THREE.BoxGeometry(.035,height+.18,.07),wood);edge.position.set(x,0,.015);display.add(edge);}
  for(const y of [-height/2-.07,height/2+.07]){const edge=new THREE.Mesh(new THREE.BoxGeometry(width+.15,.035,.07),wood);edge.position.set(0,y,.015);display.add(edge);}
  const imageMaterial=new THREE.MeshBasicMaterial({color:0xffffff});
  const photo=new THREE.Mesh(new THREE.PlaneGeometry(width,height),imageMaterial);photo.position.z=.035;display.add(photo);
  const version=this.chapterVersion;this.photoTextures??=new Map();
  const filename=index===2?'notebook.webp':'dress-study-01.webp';
  if(!this.photoTextures.has(filename))this.photoTextures.set(filename,new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/${filename}`).then(texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());return texture;}));
  this.photoReady=this.photoTextures.get(filename).then(texture=>{if(version!==this.chapterVersion)return;imageMaterial.map=texture;imageMaterial.needsUpdate=true;const aspect=texture.image.width/texture.image.height;photo.scale.set(aspect>width/height?1:aspect*height/width,aspect>width/height?width/(aspect*height):1,1);this.canvas.dataset.photo=filename;this.dirty=true;}).catch(()=>{this.canvas.dataset.photo='unavailable';});
  if(index===3){
   const spool=put(new THREE.CylinderGeometry(.13,.13,.32,24),rose,3.35,-.79,.26);
   for(const y of [-.96,-.62])put(new THREE.CylinderGeometry(.17,.17,.025,24),wood,3.35,y,.26);
   for(let i=0;i<12;i++)put(new THREE.TorusGeometry(.131,.003,4,24),paper,3.35,-.94+i*.025,.26).rotation.x=Math.PI/2;
   const thread=new THREE.CatmullRomCurve3([new THREE.Vector3(3.35,-.72,.4),new THREE.Vector3(3.7,-.83,.5),new THREE.Vector3(3.6,-1.06,.6),new THREE.Vector3(3.05,-1.07,.55)]);
   put(new THREE.TubeGeometry(thread,32,.006,6,false),rose,0,0,0);
   for(const x of [.9,1.08]){const hoop=put(new THREE.TorusGeometry(.075,.013,8,24),metal,x,-1.05,.5);hoop.rotation.x=-Math.PI/2;}
  }else{
   // Decorative closed paper folios, never substituted for product photographs.
   for(let i=0;i<2;i++){const folio=put(new THREE.BoxGeometry(.52,.68,.06),i?sage:rose,3.46,-.65,.17+i*.07);folio.rotation.z=(i?-.11:.09);}
  }
  const floor=put(new THREE.CylinderGeometry(1,1.04,.065,64),paper,2,-1.73,.2);floor.scale.set(2.1,1,.7);
  this.consolidate(studio);
 }
 fitMovingCover(){
  // Perspective makes the upright cover much larger than the resting volume.
  // Fit its projected corners, including narrow mobile and landscape screens.
  for(let pass=0;pass<4;pass++){
   this.book.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(this.coverHinge);let extent=0;
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const p=new THREE.Vector3(x,y,z).project(this.camera);extent=Math.max(extent,Math.abs(p.x),Math.abs(p.y));
   }
   if(extent<=.86)break;const factor=Math.min(.98,.86/extent);this.book.scale.multiplyScalar(factor);this.contactShadow.scale.multiplyScalar(factor);
 }
}
 makeIntroLeaf(eyebrow,title){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1408;
  const c=canvas.getContext('2d');c.fillStyle='#fffaf0';c.fillRect(0,0,1024,1408);
  c.strokeStyle='#d8cfbf';c.lineWidth=2;c.strokeRect(54,54,916,1300);
  c.fillStyle='#8c806d';c.textAlign='center';c.textBaseline='middle';c.font='28px Georgia, serif';c.fillText(eyebrow,512,540,820);
  c.fillStyle='#51493f';c.font='72px Georgia, serif';
  const words=/[\u3400-\u9fff]/.test(title)?[...title]:title.split(/(?<=\s)/);
  let line='',rows=title.includes('\n')?title.split('\n'):[];
  if(!rows.length){for(const word of words){if(c.measureText(line+word).width>790&&line){rows.push(line.trim());line=word;}else line+=word;}if(line)rows.push(line.trim());}
  rows.slice(0,3).forEach((row,i)=>c.fillText(row,512,655+(i-(rows.length-1)/2)*88,820));
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
 }
 async turnIntroLeaves(content){
  const pages=[this.makeIntroLeaf('PEIRY TALE',content.subtitle),this.makeIntroLeaf(`${content.chapters[0].number} / ${content.chapters[0].eyebrow}`,content.chapters[0].title)];
  const blank=this.makeIntroLeaf('','');
  try{
   this.underPages[0].material.map=blank;this.underPages[0].material.needsUpdate=true;this.underPages[0].visible=!this.mobile;
   this.underPages[1].material.map=pages[1];this.underPages[1].material.needsUpdate=true;this.underPages[1].visible=true;
   for(let i=0;i<pages.length;i++){
    this.turnMaterial.uniforms.frontPage.value=pages[i];this.turnMaterial.uniforms.backPage.value=blank;
    this.turnMaterial.uniforms.turn.value=0;this.turnMaterial.uniforms.direction.value=1;this.sheet.visible=true;this.dirty=true;
    await this.animate(i===0?380:220,()=>{});
    await this.animate(740,p=>{this.turnMaterial.uniforms.turn.value=p;});
    this.sheet.visible=false;
    this.underPages[1].material.map=i===0?pages[1]:blank;
    this.underPages[1].material.needsUpdate=true;this.dirty=true;
   }
  }finally{
   this.sheet.visible=false;this.turnMaterial.uniforms.frontPage.value=null;this.turnMaterial.uniforms.backPage.value=null;
   for(const mesh of this.underPages){mesh.visible=false;mesh.material.map=null;mesh.material.needsUpdate=true;}
   for(const texture of [...pages,blank])texture.dispose();this.dirty=true;
  }
 }
 async knockDoor(quiet=false){
  if(quiet||this.limitedMotion){this.canvas.dataset.door='rest';return;}
  const origin=this.camera.position.clone(),doorZ=2.8,doorY=-.5;
  this.doorLight.position.x=this.mobile?2:0;this.doorLight.visible=true;
  this.canvas.dataset.door='approaching';
  try{
   await this.animate(650,p=>{
    // Travel through the open spread toward its castle. Scaling the whole
    // book enlarges its paper and charm with the doorway; moving the viewer
    // preserves their physical proportions and brings the portal into frame.
    this.camera.position.z=THREE.MathUtils.lerp(origin.z,doorZ,p);
    this.camera.position.y=THREE.MathUtils.lerp(origin.y,doorY,p);
   });
   this.canvas.dataset.door='knocking';
   await this.animate(260,p=>{
    this.castleDoors.forEach((hinge,i)=>{hinge.rotation.y=(i===0?-1:1)*.92*p;});
    this.doorLight.material.uniforms.strength.value=.65*p;this.doorLight.scale.x=.12+.73*p;
   });
   await this.animate(330,p=>{
    this.castleDoors.forEach((hinge,i)=>{hinge.rotation.y=(i===0?-1:1)*(.92+.43*p);});
    this.doorLight.material.uniforms.strength.value=.65+.35*p;this.doorLight.scale.x=.85+1.0*p;
   });
   await this.animate(480,p=>{
    this.camera.position.z=THREE.MathUtils.lerp(doorZ,origin.z,p);
    this.camera.position.y=THREE.MathUtils.lerp(doorY,origin.y,p);
    this.castleDoors.forEach((hinge,i)=>{hinge.rotation.y=(i===0?-1:1)*1.35*(1-p);});
    this.doorLight.material.uniforms.strength.value=1-p;
   });
  }finally{
   this.camera.position.copy(origin);
   this.castleDoors.forEach(hinge=>{hinge.rotation.y=0;});
   this.doorLight.visible=false;this.doorLight.material.uniforms.strength.value=0;this.doorLight.scale.x=1;
   this.canvas.dataset.door='rest';this.dirty=true;
  }
 }
 async open(quiet=false,content){
  this.canvas.dataset.bindingMotion='opening';this.setWorldEmergence(1);
  if(quiet){this.canvas.dataset.bindingMotion='open';this.book.scale.setScalar(1);this.book.rotation.set(0,0,0);this.opened=true;this.applyPosition();this.setOpeningVolume(1);this.setWorldEmergence(1);this.closedVolume.visible=false;this.coverHinge.visible=false;this.contactShadow.position.x=.34+this.book.position.x*.7;this.shadowMaterial.uniforms.opacity.value=.2;return;}
  // Lift the closed volume first. Its thickness and spine become visible
  // before the cover opens; the reading plane settles only at the end.
  await this.animate(480,p=>{
   this.book.position.y=.22*p;this.book.position.z=.7*p;
   this.book.rotation.set(THREE.MathUtils.lerp(this.restRotation.x,-.18,p),THREE.MathUtils.lerp(this.restRotation.y,-.12,p),THREE.MathUtils.lerp(this.restRotation.z,-.035,p));
   this.book.scale.setScalar(.84+.12*p);
   this.shadowMaterial.uniforms.spread.value=p;this.shadowMaterial.uniforms.opacity.value=.27-.14*p;
  });
  this.opened=true;this.applyPosition();this.setOpeningVolume(0);this.setWorldEmergence(1);this.world.visible=false;
  await this.animate(1150,p=>{
   this.setOpeningVolume(p);
   this.coverHinge.position.x=-2.04*(1-p);
   this.closedVolume.position.x=2*p;
   this.coverHinge.rotation.y=-Math.PI*p;
   const settle=Math.max(0,(p-.45)/.55);
   this.world.visible=false;
   this.book.position.x=this.mobile?-2*THREE.MathUtils.smoothstep(p,.12,.88):0;this.book.position.y=.22*(1-settle);this.book.position.z=.7*(1-settle);
   this.contactShadow.position.x=.34+this.book.position.x*.7;
   this.book.rotation.set(-.18*(1-settle),-.12*(1-settle),-.035*(1-settle));
   this.book.scale.setScalar(this.mobile?.96+.04*p-.23*Math.sin(p*Math.PI):1+.055*(1-settle)-.18*Math.sin(p*Math.PI));
   this.contactShadow.scale.set(1+(this.mobile?0:.6)*p,1,1);
   this.shadowMaterial.uniforms.spread.value=1-settle;this.shadowMaterial.uniforms.opacity.value=.13+.07*settle;
   if(!this.mobile&&p>.08&&p<.92)this.fitMovingCover();
  });
  this.coverHinge.visible=false;this.closedVolume.visible=false;this.closedVolume.position.x=0;
  if(content)await this.turnIntroLeaves(content);
  this.world.visible=true;this.setWorldEmergence(0);
  await this.animate(600,p=>this.setWorldEmergence(p));
  this.dirty=true;this.enteredAt=performance.now();this.canvas.dataset.bindingMotion='open';
 }
 async close(quiet=false){
  this.previewCorner(0);this.enteredAt=0;this.waveUntil=0;
  if(!quiet){
   this.canvas.dataset.bindingMotion='closing';
   // Fold the miniature world into the paper before the cover crosses it.
   await this.animate(280,p=>{this.setWorldEmergence(1-p);});
   this.world.visible=false;this.worldVeil.visible=false;this.closedVolume.visible=true;this.closedVolume.position.x=2;
   this.coverHinge.visible=true;this.coverHinge.position.x=0;this.coverHinge.rotation.y=-Math.PI;
   const startX=this.book.position.x;
   await this.animate(900,p=>{
    this.setOpeningVolume(1-p);
    this.coverHinge.rotation.y=-Math.PI*(1-p);this.coverHinge.position.x=-2.04*p;
    this.closedVolume.position.x=2*(1-p);
    this.book.position.x=startX*(1-THREE.MathUtils.smoothstep(p,.12,.88));this.book.position.y=.22*Math.sin(p*Math.PI);this.book.position.z=.45*Math.sin(p*Math.PI);
    this.contactShadow.position.x=.34+this.book.position.x*.7;this.shadowMaterial.uniforms.opacity.value=.2+.07*p;
    this.book.rotation.set(this.restRotation.x*p,this.restRotation.y*p,this.restRotation.z*p);
    this.book.scale.setScalar(this.mobile?1-.16*Math.pow(p,5)-.23*Math.sin(p*Math.PI):1-.16*p-.18*Math.sin(p*Math.PI));this.contactShadow.scale.set(1+(this.mobile?0:.6)*(1-p),1,1);
    if(!this.mobile&&p>.08&&p<.92)this.fitMovingCover();
   });
  }
  this.book.rotation.copy(this.restRotation);this.book.position.set(0,0,0);this.book.scale.setScalar(.84);this.opened=false;this.applyPosition();this.setWorldEmergence(1);this.closedVolume.visible=true;this.closedVolume.position.x=0;this.contactShadow.scale.set(1,1,1);this.contactShadow.position.x=.34;this.shadowMaterial.uniforms.opacity.value=.27;this.shadowMaterial.uniforms.spread.value=0;this.coverHinge.visible=true;this.coverHinge.position.x=-2.04;this.coverHinge.rotation.y=0;this.canvas.dataset.bindingMotion='resting';
 }
 capturePages(chapter){
  // Capture the actual world through the display camera, cropped to each leaf.
  // Offscreen targets stay GPU-side: no canvas readback or screenshot upload.
  const titleCanvas=document.createElement('canvas');titleCanvas.width=1024;titleCanvas.height=230;
  const ctx=titleCanvas.getContext('2d'),face=getComputedStyle(this.canvas).fontFamily;ctx.textAlign='center';ctx.fillStyle='#81755f';ctx.font=`18px ${face}`;ctx.fillText(`${chapter.number} / ${chapter.eyebrow}`,512,30);
  ctx.fillStyle='#514f43';ctx.font=`${this.mobile?54:44}px ${face}`;
  const text=chapter.title.replace('\n',' '),tokens=/[\u3400-\u9fff]/.test(text)?[...text]:text.split(/(?<=\s)/);let line='',y=106;
  for(const token of tokens){if(ctx.measureText(line+token).width>960&&line){ctx.fillText(line,512,y);line=token;y+=65;}else line+=token;}if(line)ctx.fillText(line,512,y);
  const headingTexture=new THREE.CanvasTexture(titleCanvas);headingTexture.colorSpace=THREE.SRGBColorSpace;
  const heading=new THREE.Mesh(new THREE.PlaneGeometry(this.mobile?3.5:7.0,this.mobile?.79:1.1),new THREE.MeshBasicMaterial({map:headingTexture,transparent:true,depthWrite:false,depthTest:false}));heading.position.set(this.mobile?2:0,1.84,.045);heading.renderOrder=998;this.book.add(heading);
  const readingCanvas=document.createElement('canvas');readingCanvas.width=this.mobile?704:1024;readingCanvas.height=320;
  const reading=readingCanvas.getContext('2d');reading.fillStyle='#6c665a';reading.textAlign='center';reading.font=`${this.mobile?24:21}px ${face}`;
  const lineHeight=this.mobile?43:38,maxWidth=readingCanvas.width-55;let baseline=36;
  for(const paragraph of chapter.body){
   const words=/[\u3400-\u9fff]/.test(paragraph)?[...paragraph]:paragraph.split(/(?<=\s)/);let row='';
   for(const word of words){if(reading.measureText(row+word).width>maxWidth&&row){reading.fillText(row,readingCanvas.width/2,baseline);baseline+=lineHeight;row=word;}else row+=word;}
   if(row)reading.fillText(row,readingCanvas.width/2,baseline);baseline+=lineHeight*1.4;
  }
  const readingTexture=new THREE.CanvasTexture(readingCanvas);readingTexture.colorSpace=THREE.SRGBColorSpace;
  const readingMesh=new THREE.Mesh(new THREE.PlaneGeometry(this.mobile?3.52:5.12,this.mobile?1.54:1.32),new THREE.MeshBasicMaterial({map:readingTexture,depthTest:false,transparent:true,depthWrite:false}));readingMesh.position.set(this.mobile?2:0,this.mobile?-1.54:-1.705,.05);readingMesh.renderOrder=999;this.book.add(readingMesh);
  const previous=this.renderer.getRenderTarget(),targets=[];
  const leftVisible=this.left.visible,leftSurfaceVisible=this.pageSurfaces[0].visible;
  try{
   // Mobile normally hides the offscreen left leaf. It still has to exist in
   // both captured textures, or the exposed back of a reverse turn samples
   // the blue cloth board instead of paper.
   if(this.mobile){this.left.visible=true;this.pageSurfaces[0].visible=true;}
   this.scene.updateMatrixWorld(true);this.renderer.shadowMap.needsUpdate=true;
   for(const side of [-1,1]){
    // Sample each leaf in book-local space. A crop of the display camera
    // stretches the scene when its mobile viewport follows the right page,
    // and a projected screenshot lets a turning leaf outgrow the binding.
    const camera=new THREE.OrthographicCamera(-2,2,2.75,-2.75,.1,100);
    camera.position.copy(this.book.localToWorld(new THREE.Vector3(side*2,0,14)));
    camera.quaternion.copy(this.book.getWorldQuaternion(new THREE.Quaternion()));
    camera.updateMatrixWorld();
    const target=new THREE.WebGLRenderTarget(512,704,{depthBuffer:true});target.texture.colorSpace=THREE.LinearSRGBColorSpace;targets.push(target);
    this.renderer.setRenderTarget(target);this.renderer.clear();this.renderer.render(this.scene,camera);
   }
   return targets;
  }catch(error){for(const target of targets)target.dispose();throw error;}
  finally{this.left.visible=leftVisible;this.pageSurfaces[0].visible=leftSurfaceVisible;this.renderer.setRenderTarget(previous);this.book.remove(heading);heading.geometry.dispose();heading.material.dispose();headingTexture.dispose();this.book.remove(readingMesh);readingMesh.geometry.dispose();readingMesh.material.dispose();readingTexture.dispose();}
 }
 async turn(direction,quiet=false,current,next,nextIndex){
  this.previewCorner(0);if(quiet)return;
  let before=[],after=[];this.turning=true;this.canvas.dataset.turnTexture='preparing';
  try{
   before=this.capturePages(current);
   this.setChapter(nextIndex);
   if(nextIndex===2||nextIndex===3)await this.photoReady;
   after=this.capturePages(next);
   this.world.visible=false;
   this.turnMaterial.uniforms.frontPage.value=before[direction>0?1:0].texture;
   this.turnMaterial.uniforms.backPage.value=after[direction>0?0:1].texture;
   const under=direction>0?[before[0],after[1]]:[after[0],before[1]];
   // Both leaves must cover the cloth board throughout a turn. On mobile the
   // viewport follows the right leaf, but a reverse turn briefly exposes the
   // left one at the gutter; hiding it reveals an impossible strip of cover.
   this.underPages.forEach((mesh,i)=>{mesh.material.map=under[i].texture;mesh.material.needsUpdate=true;mesh.visible=true;});
   this.turnMaterial.uniforms.turn.value=0;this.turnMaterial.uniforms.direction.value=direction;this.sheet.visible=true;this.canvas.dataset.turnTexture='scene';
   await this.animate(1000,p=>{this.turnMaterial.uniforms.turn.value=p;});
  }catch(error){this.canvas.dataset.turnTexture='unavailable';console.warn('Scene page capture unavailable; changing chapter directly.',error.message);this.setChapter(nextIndex);}
  finally{
   this.sheet.visible=false;this.world.visible=this.opened;this.turning=false;this.dirty=true;
   for(const mesh of this.underPages){mesh.visible=false;mesh.material.map=null;}
   this.turnMaterial.uniforms.frontPage.value=null;this.turnMaterial.uniforms.backPage.value=null;
   for(const target of [...before,...after])target.dispose();
  }
 }
 previewCorner(direction){this.cornerMeshes.forEach((mesh,i)=>{mesh.visible=this.opened&&!this.turning&&direction===(i===0?-1:1)&&(!this.mobile||i===1);});this.dirty=true;}
 interact(){this.dirty=true;this.guideTarget=this.chapter===1?1.65:2.3;this.waveUntil=performance.now()+2200;this.activeUntil=performance.now()+5000;}
 animate(duration,update){return new Promise(resolve=>{const start=performance.now();const frame=now=>{const p=duration?Math.min((now-start)/duration,1):1;update(p*p*(3-2*p));this.dirty=true;if(p<1)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});}
 tick(now){
  const frameMs=now-(this.lastTick??now),dt=Math.min(.05,frameMs/1000);this.lastTick=now;
  const moving=now<this.activeUntil||now<this.waveUntil||!!this.enteredAt;
  if(this.landscape?.userData.windTime&&this.opened&&!this.quiet&&!this.limitedMotion)this.landscape.userData.windTime.value=now*.001;
  if(this.opened&&!this.turning&&!this.quiet&&!document.hidden&&!this.limitedMotion){
   this.frameSamples??=[];this.frameSamples.push(frameMs);
   if(this.frameSamples.length===24){
    const median=[...this.frameSamples].sort((a,b)=>a-b)[12];this.frameSamples=[];
    if(median>75){
     if(!this.reducedResolution){this.reducedResolution=true;this.renderer.setPixelRatio(.75);this.renderer.shadowMap.enabled=false;this.dirty=true;this.canvas.dataset.quality='reduced-resolution';}
     else{this.limitedMotion=true;this.canvas.dataset.quality='interaction-motion';this.dirty=true;}
    }
   }
  }

  if(this.mixer&&this.opened&&!this.turning&&!this.quiet&&(!this.limitedMotion||moving)){this.playGuide(this.enteredAt&&now-this.enteredAt<2200?'Walk':now<this.waveUntil?'Greet':Math.abs((this.guideTarget??this.guideHome??1.2)-this.guide.position.x)>.04?'Walk':'Idle');this.mixer.update(dt);}
  if(!this.quiet){this.orb.position.y=.5+Math.sin(now*.0014)*.05;this.guide.position.y=-.86+Math.sin(now*.002)*.012;}
  const active=now<this.activeUntil;if(active!==this.lastActive){this.dirty=true;this.lastActive=active;}
  for(const [i,blossom] of (this.petals||[]).entries()){const size=active?1.35:1;blossom.scale.lerp(new THREE.Vector3(size,size,size),this.quiet?1:.045);if(!this.quiet)blossom.rotation.z=Math.sin(now*.0007+i)*.08;}
  for(const [i,leaf] of (this.paperLeaves||[]).entries()){const angle=(i-2)*(active?.32:.18);leaf.rotation.z+=(angle-leaf.rotation.z)*(this.quiet?1:.04);}
  if(this.chapter===2&&this.keepsake)this.keepsake.rotation.z+=( (active?-.18:0)-this.keepsake.rotation.z)*(this.quiet?1:.04);
  if(this.chapter===3&&this.spool)this.spool.rotation.z+=( (active?-.35:0)-this.spool.rotation.z)*(this.quiet?1:.04);
  const target=this.guideTarget??this.guideHome??1.2,distance=target-this.guide.position.x;
  if(!this.turning)this.guide.position.x+=this.quiet?distance:Math.sign(distance)*Math.min(Math.abs(distance),dt*.65);
  if(this.enteredAt&&!this.quiet){const p=Math.min(1,(now-this.enteredAt)/2200);this.guide.position.x=THREE.MathUtils.lerp(2.1,this.guideHome??1.2,p);this.guide.position.z=.85+.65*p;if(this.guideModel)this.guideModel.rotation.y=-.55*Math.sin(p*Math.PI);if(p===1)this.enteredAt=0;}
  if(now<this.waveUntil&&!this.quiet)this.arm.rotation.z=-1+Math.sin(now*.012)*.4;
  else{this.arm.rotation.z=-.6;this.guideTarget=undefined;}
  if((!this.turning||this.sheet.visible)&&(this.dirty||(!this.quiet&&this.opened&&!document.hidden&&(!this.limitedMotion||moving)))){if(this.dirty)this.renderer.shadowMap.needsUpdate=true;this.renderer.render(this.scene,this.camera);this.canvas.dataset.drawCalls=String(this.renderer.info.render.calls);this.canvas.dataset.triangles=String(this.renderer.info.render.triangles);this.canvas.dataset.textures=String(this.renderer.info.memory.textures);this.canvas.dataset.geometries=String(this.renderer.info.memory.geometries);this.dirty=false;}this.frame=requestAnimationFrame(this.tick);
 }
}
