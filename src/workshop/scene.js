import * as THREE from 'three';
import {room,objects} from './layout.js';
import {WorkshopNavigation,sourceToFloor} from './navigation.js';
const vertex=`varying vec2 sourceUV,worldPoint;void main(){sourceUV=uv;vec4 world=modelMatrix*vec4(position,1.);worldPoint=vec2(world.x,-world.y);gl_Position=projectionMatrix*viewMatrix*world;}`;
const fragment=`uniform sampler2D image;uniform vec3 paper;uniform float edge;uniform bool fabric;varying vec2 sourceUV,worldPoint;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){if(fabric){float lip=worldPoint.x<1309.?695.+(worldPoint.x-1100.)*48./209.:743.-(worldPoint.x-1309.)*35./63.;if(worldPoint.y>lip)discard;}vec4 c=texture2D(image,sourceUV);if(c.a<.005)discard;vec3 transmission=linearRGB(c.rgb)/paper;transmission*=1.-edge*.12;gl_FragColor=vec4(clamp((128.+127.*(transmission-1.))/255.,0.,1.),c.a);}`;
const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
// Triangulated projected surfaces preserve source shading and depth.
function surface(points,{subdivide=0,thickness=0}={}){
 const contour=points.map(p=>new THREE.Vector2(p[0],-p[1]));
 const triangles=THREE.ShapeUtils.triangulateShape(contour,[]),positions=[],uvs=[],edges=[];
 function triangle(a,b,c,n){if(n){const ab=a.map((v,i)=>(v+b[i])/2),bc=b.map((v,i)=>(v+c[i])/2),ca=c.map((v,i)=>(v+a[i])/2);triangle(a,ab,ca,n-1);triangle(ab,b,bc,n-1);triangle(ca,bc,c,n-1);triangle(ab,bc,ca,n-1);return;}for(const p of [a,b,c]){positions.push(p[0],-p[1],p[2]);uvs.push(p[0]/room.sourceSize[0],1.-p[1]/room.sourceSize[1]);}}
 triangles.forEach(t=>triangle(...t.map(i=>points[i]),subdivide));
 const frontCount=positions.length/3;
 if(thickness)points.forEach((p,i)=>{const q=points[(i+1)%points.length],a=[p[0],p[1],p[2]-thickness],b=[q[0],q[1],q[2]-thickness];triangle(p,q,a,0);triangle(q,b,a,0);edges.push(i);});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.addGroup(0,frontCount,0);if(edges.length)g.addGroup(frontCount,positions.length/3-frontCount,1);g.computeVertexNormals();return g;
}
export class WorkshopScene{
 constructor(renderer,loader,onFrame=()=>{}){
  this.renderer=renderer;this.loader=loader;this.onFrame=onFrame;this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(room.crop[0],room.crop[0]+room.crop[2],-room.crop[1],-room.crop[1]-room.crop[3],1,4000);this.camera.position.z=2000;
  const gl=renderer.getContext(),samples=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA8,gl.SAMPLES);this.target=new THREE.WebGLRenderTarget(960,672,{depthBuffer:true,samples:Math.max(0,...Array.from(samples||[]).filter(n=>n<=4)),generateMipmaps:false});this.target.texture.colorSpace=THREE.NoColorSpace;
  this.paint=this.target.clone();this.rest=this.target.clone();this.reference=this.target.clone();this.erase=this.target.clone();
  // Each replacement reveals the clean plate only through the original
  // object's fixed footprint, then composites its visual over the room.
  this.eraseScene=new THREE.Scene();this.eraseNodes=new Map();this.eraseMaterial=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});
  this.compositeGeometry=new THREE.PlaneGeometry(2,2);this.compositeMaterial=new THREE.ShaderMaterial({uniforms:{source:{value:this.reference.texture},paint:{value:this.paint.texture},rest:{value:this.rest.texture},erase:{value:this.erase.texture},dynamic:{value:false}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D source,paint,rest,erase;uniform bool dynamic;varying vec2 p;void main(){vec3 base=texture2D(source,p).rgb;if(dynamic){base=mix(base,texture2D(rest,p).rgb,texture2D(erase,p).r);vec4 ink=texture2D(paint,p);base=ink.rgb+base*(1.-ink.a);}gl_FragColor=vec4(base,1.);}',depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending});
  this.composite=new THREE.Mesh(this.compositeGeometry,this.compositeMaterial);
  this.composite.frustumCulled=false;this.composite.renderOrder=-1;this.composite.visible=false;
  this.nodes=new Map();this.materials=[];this.textures=[];this.visuals=new Map();this.navigation=new WorkshopNavigation();this.actors=new THREE.Group();this.actors.name='workshop-dynamic-actors';this.actorScene=new THREE.Scene();this.actorScene.add(this.composite,this.actors);this.dirty=true;this.selected=null;this.ready=null;this.disposed=false;
 }
 get texture(){return this.target.texture;}
 async prepare(){
  if(this.ready)return this.ready;
  this.ready=Promise.allSettled(room.assets.map(async name=>{const blob=await this.loader.load(name),url=URL.createObjectURL(blob);try{const t=await new THREE.TextureLoader().loadAsync(url);t.colorSpace=THREE.NoColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());return t;}finally{URL.revokeObjectURL(url);}})).then(results=>{
   const textures=results.filter(r=>r.status==='fulfilled').map(r=>r.value),failed=results.find(r=>r.status==='rejected');if(this.disposed||failed){textures.forEach(t=>t.dispose());if(failed)throw failed.reason;return;}
   const [source,background,dressAtlas,dressFlow]=textures;this.textures=textures;
   for(const t of [dressAtlas,dressFlow]){t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;}
   this.dressAtlas=dressAtlas;this.dressFlow=dressFlow;
   this.source=source;this.background=background;this.build();this.loaded=true;this.prepareBaseline();this.draw();
  }).catch(e=>{this.textures.forEach(t=>t.dispose());this.textures=[];this.ready=null;throw e;});return this.ready;
 }
 material(image,edge=0){const m=new THREE.ShaderMaterial({uniforms:{image:{value:image},paper:{value:new THREE.Vector3(...[254,243,232].map(v=>linear(v/255)))},edge:{value:edge},fabric:{value:false}},vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,toneMapped:false,transparent:true,blending:THREE.NormalBlending});this.materials.push(m);return m;}
 build(){
  const base=this.material(this.background);this.scene.add(new THREE.Mesh(surface([[0,0,-600],[1445,0,-600],[1445,1088,-600],[0,1088,-600]]),base));
  // One continuous floor plane and the two walls share their actual rear edge.
  // Projection is baked in the texture; floor depth is also usable by actors.
  const floorDepth=p=>-120+sourceToFloor(p)[1]*440;
  const leftEdge=[[90,804],[437,690],[768,712]],rightEdge=[[768,712],[1070,774],[1352,847]];
  for(const part of room.surfaces){let points=part.points;if(part.id==='floor')points=room.floor.map(p=>[...p,floorDepth(p)]);if(part.id==='left-wall')points=[[30,25,-420],[768,25,-420],...[...leftEdge].reverse().map(p=>[...p,floorDepth(p)])];if(part.id==='right-wall')points=[[768,25,-420],[1385,25,-420],...[...rightEdge].reverse().map(p=>[...p,floorDepth(p)])];const mesh=new THREE.Mesh(surface(points),base);mesh.name=part.id;mesh.userData.surface={...part,points};this.scene.add(mesh);}
  for(const data of objects){
   const bounds={left:Math.min(...data.polygon.map(p=>p[0])),right:Math.max(...data.polygon.map(p=>p[0])),top:Math.min(...data.polygon.map(p=>p[1])),bottom:Math.max(...data.polygon.map(p=>p[1]))};
   const anchor=data.axis||[data.kind==='book'?bounds.left:(bounds.left+bounds.right)/2,data.kind==='dress'?bounds.top:bounds.bottom];
   const front=this.material(this.source),edge=this.material(this.source,1),geometry=surface(data.polygon.map(p=>[...p,data.depth]),{subdivide:data.kind==='dress'?3:1,thickness:data.thickness});
   geometry.translate(-anchor[0],anchor[1],-data.depth);
   const node=new THREE.Mesh(geometry,[front,edge]);node.position.set(anchor[0],-anchor[1],data.depth);node.name=data.id;node.userData={...data,bounds,anchor,sourceUV:geometry.attributes.uv.array.slice()};this.nodes.set(data.id,node);this.scene.add(node);
   node.material.forEach(m=>m.uniforms.fabric.value=data.kind==='fabric');
   // The erase mask uses the source contour independently of replacement UVs.
   const erase=new THREE.Mesh(geometry,this.eraseMaterial);erase.position.copy(node.position);erase.visible=false;this.eraseNodes.set(data.id,erase);this.eraseScene.add(erase);
  }
 }
 renderTo(target,scene=this.scene,camera=this.camera,{clear=true,background=0x808080,opacity=1}={}){const r=this.renderer,previous=r.getRenderTarget(),auto=r.autoClear,color=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha(),shadowAuto=r.shadowMap.autoUpdate,shadowNeeds=r.shadowMap.needsUpdate;try{r.autoClear=clear;r.shadowMap.autoUpdate=false;r.shadowMap.needsUpdate=false;r.setClearColor(background,opacity);r.setRenderTarget(target);r.render(scene,camera);}finally{r.setRenderTarget(previous);r.setClearColor(color,alpha);r.autoClear=auto;r.shadowMap.autoUpdate=shadowAuto;r.shadowMap.needsUpdate=shadowNeeds;}}
 prepareBaseline(){
  const visible=[...this.nodes.values()].map(n=>[n,n.visible]);for(const [n] of visible)n.visible=false;
  this.renderTo(this.rest);
  this.referenceScene??=new THREE.Scene();if(!this.referenceMesh){this.referenceMesh=new THREE.Mesh(surface([[0,0,0],[1445,0,0],[1445,1088,0],[0,1088,0]]),this.material(this.source));this.referenceScene.add(this.referenceMesh);}this.renderTo(this.reference,this.referenceScene);
  for(const [n,v] of visible)n.visible=v;
 }
 draw(){if(!this.loaded||!this.dirty||this.disposed)return false;
  const active=new Set([...this.visuals].filter(([,visual])=>{
   return visual.external!==this.source||visual.mapping!=='source-projection';
  }).map(([id])=>id));
  this.compositeMaterial.uniforms.dynamic.value=active.size>0;
  if(active.size){
   for(const [id,n] of this.eraseNodes)n.visible=active.has(id);this.renderTo(this.erase,this.eraseScene,this.camera,{background:0x000000});
   const visibility=this.scene.children.map(n=>[n,n.visible]);
   try{for(const [n] of visibility)n.visible=active.has(n.name);this.renderTo(this.paint,this.scene,this.camera,{background:0x000000,opacity:0});}finally{for(const [n,v] of visibility)n.visible=v;}
  }
  // The full-screen room is opaque and the actor blends OVER it in the same
  // pass. Resolve multisampling once after both have been drawn.
  this.composite.visible=true;
  try{this.renderTo(this.target,this.actorScene,this.camera);}finally{this.composite.visible=false;}
  this.dirty=false;this.onFrame();return true;}
 // Replace a visual slot without coupling future merchandise to geometry/routes.
 // Passing a complete source atlas uses source-projection; a standalone photo
 // uses object-bounds UVs. Caller owns permissions; no remote fetching here.
 setUV(node,mapping){const uv=node.geometry.attributes.uv;if(mapping==='source-projection'){uv.array.set(node.userData.sourceUV);uv.needsUpdate=true;return;}const p=node.geometry.attributes.position,b=node.userData.bounds;for(let i=0;i<uv.count;i++){const x=p.getX(i)+node.userData.anchor[0],y=-p.getY(i)+node.userData.anchor[1];uv.setXY(i,(x-b.left)/(b.right-b.left),1-(y-b.top)/(b.bottom-b.top));}uv.needsUpdate=true;}
 replaceVisual(id,texture,{mapping='object-bounds'}={}){const node=this.nodes.get(id);if(!node)throw Error('Unknown workshop object');const previous=this.visuals.get(id);let view;if(texture){view=texture.clone();view.colorSpace=THREE.NoColorSpace;view.needsUpdate=true;this.visuals.set(id,{external:texture,view,mapping});}else this.visuals.delete(id);this.setUV(node,texture?mapping:'source-projection');node.material.forEach(m=>m.uniforms.image.value=view||this.source);previous?.view.dispose();this.dirty=true;}
 setActorAdapter(adapter){this.cancelInteraction();this.actorAdapter=adapter;}
 attachActor(node){this.actors.add(node);this.dirty=true;return ()=>{this.actors.remove(node);this.dirty=true;};}
 cancelInteraction(){this.interactionAbort?.abort();this.interactionAbort=null;}
 beginInteraction(id,{onActivate=()=>{}}={}){this.cancelInteraction();const abort=new AbortController();this.interactionAbort=abort;const data=this.nodes.get(id)?.userData;if(!data)return null;const plan=this.planInteraction(id,this.actorAdapter?.getPosition?.()||room.entry);return {object:id,kind:data.kind,plan,signal:abort.signal,activate:()=>{if(abort.signal.aborted||this.disposed)return;this.selected=id;onActivate(data);}};}
 beginWalk(point,{onActivate=()=>{}}={}){
  let destination=[...point];if(!this.navigation.walkable(destination)){const key=this.navigation.nearest(destination);if(key==null)return null;destination=this.navigation.point(key);}
  const from=this.actorAdapter?.getPosition?.()||room.entry,route=this.navigation.route(from,destination);if(!route)return null;
  this.cancelInteraction();this.selected=null;const abort=new AbortController();this.interactionAbort=abort;
  return {object:null,kind:'floor',plan:{id:null,approach:destination,route,floorRoute:route.map(p=>this.floorPoint(p)),directions:route.slice(1).map((p,i)=>this.navigation.direction(route[i],p))},signal:abort.signal,activate:()=>{if(!abort.signal.aborted&&!this.disposed)onActivate();}};
 }
 planInteraction(id,from=room.entry){const object=this.nodes.get(id)?.userData;if(!object)return null;const route=this.navigation.route(from,object.approach);return {id,approach:object.approach,route,floorRoute:route?.map(p=>this.floorPoint(p)),directions:route?.slice(1).map((p,i)=>this.navigation.direction(route[i],p))};}
 floorPoint(p){return sourceToFloor(p);}
 // Character foot world position shares the room floor and its depth buffer.
 floorWorld(p){return new THREE.Vector3(p[0],-p[1],-120+sourceToFloor(p)[1]*440);}
 releaseGPU(){
  // Three r186 retains old-generation dispose listeners through context restore.
  // Release owned handles while the context is lost (GL deletes are no-ops),
  // removing those listeners before the next generation. CPU data stays intact.
  if(!this.renderer.getContext().isContextLost())return;
  for(const t of this.textures)t.dispose();for(const {view} of this.visuals.values())view.dispose();
  this.scene.traverse(n=>n.geometry?.dispose());this.referenceMesh?.geometry.dispose();this.materials.forEach(m=>m.dispose());this.eraseMaterial.dispose();this.compositeGeometry.dispose();this.compositeMaterial.dispose();for(const target of [this.target,this.paint,this.rest,this.reference,this.erase])target.dispose();
 }
 isActor(node){for(let n=node;n;n=n.parent)if(n===this.actors)return true;return false;}
 restore(){for(const t of this.textures)t.needsUpdate=true;for(const {view} of this.visuals.values())view.needsUpdate=true;if(this.loaded)this.prepareBaseline();this.dirty=true;this.draw();}
 dispose(){this.disposed=true;this.cancelInteraction();this.actorScene.remove(this.actors);this.actors.clear();this.scene.traverse(n=>n.geometry?.dispose());this.referenceMesh?.geometry.dispose();this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());for(const {view} of this.visuals.values())view.dispose();this.visuals.clear();this.eraseMaterial.dispose();this.compositeGeometry.dispose();this.compositeMaterial.dispose();for(const target of [this.target,this.paint,this.rest,this.reference,this.erase])target.dispose();}
}
