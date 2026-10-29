import * as THREE from 'three';
import {closedInnerDepth,BACK_COVER_TRAVEL} from './cloth-case.js';

function heartShape(){
 const shape=new THREE.Shape();shape.moveTo(0,.04);
 shape.bezierCurveTo(-.24,.28,-.34,-.07,0,-.28);
 shape.bezierCurveTo(.34,-.07,.24,.28,0,.04);return shape;
}

function heartBeadGeometry(){
 // Convex front/rear lenses catch moving highlights; a flat extrusion made
 // the translucent beads look like two paper hearts threaded on a string.
 const outline=heartShape().getSpacedPoints(80).slice(0,-1),n=outline.length,rings=12;
 const positions=[0,-.02,.13,0,-.02,-.13],indices=[];
 const ringIds=[[],[]];
 for(let side=0;side<2;side++)for(let ring=1;ring<=rings;ring++){
  if(side===1&&ring===rings){ringIds[side].push(ringIds[0][rings-1]);continue;}
  const s=ring/rings,ids=[];
  for(const point of outline){ids.push(positions.length/3);positions.push(point.x*s,-.02+(point.y+.02)*s,(side?-1:1)*.13*Math.sqrt(1-s*s));}
  ringIds[side].push(ids);
 }
 for(let side=0;side<2;side++){
  const add=(a,b,c)=>indices.push(...(side?[a,c,b]:[a,b,c]));
  for(let j=0;j<n;j++)add(side,ringIds[side][0][j],ringIds[side][0][(j+1)%n]);
  for(let ring=1;ring<rings;ring++)for(let j=0;j<n;j++){
   const a=ringIds[side][ring-1][j],b=ringIds[side][ring-1][(j+1)%n],c=ringIds[side][ring][j],d=ringIds[side][ring][(j+1)%n];add(a,c,b);add(b,c,d);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.type='HeartBeadGeometry';geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

// A small neutral studio reflection belongs only to the jewellery. It adds
// pearl/glass highlights without warming the book's photographic cloth.
function jewelleryReflection(){
 const w=128,h=64,data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/w,v=y/h;
  const window=Math.exp(-(((u-.28)/.065)**2))*Math.exp(-(((v-.48)/.32)**2));
  const fill=Math.exp(-(((u-.73)/.19)**2))*Math.exp(-(((v-.38)/.45)**2));
  const value=Math.round(255*Math.min(1,.17+.78*window+.34*fill));
  const i=(y*w+x)*4;data[i]=value;data[i+1]=value;data[i+2]=Math.min(255,value+3);data[i+3]=255;
 }
 const texture=new THREE.DataTexture(data,w,h);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;
}

// Flat ribbon, not a round cable: its two faces have a fine woven highlight.
function strip(points,width,material){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const positions=[],uv=[],indices=[],steps=36;
 for(let i=0;i<=steps;i++){
  const t=i/steps,p=curve.getPoint(t),tangent=curve.getTangent(t);
  const across=new THREE.Vector3(-tangent.y,tangent.x,0).normalize().multiplyScalar(width/2);
  for(const sign of [-1,1]){const q=p.clone().addScaledVector(across,sign);positions.push(...q);uv.push((sign+1)/2,t);}
  if(i<steps){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return new THREE.Mesh(geometry,material);
}

export function markerAttachment(progress,mobile=false){
 const x=mobile?-.9:-1.91;
 return new THREE.Vector3(x+BACK_COVER_TRAVEL*progress,-2.85,closedInnerDepth(x,false)+.0125);
}
export function createBookMarker(engraving){
 const root=new THREE.Group();root.name='book-marker';root.position.copy(markerAttachment(0));
 const envMap=jewelleryReflection();
 const ribbonMaterial=new THREE.MeshStandardMaterial({color:0x9cc3df,roughness:.76,side:THREE.DoubleSide});
 ribbonMaterial.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 ribbonUv;').replace('#include <uv_vertex>','#include <uv_vertex>\nribbonUv=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 ribbonUv;').replace('#include <color_fragment>','#include <color_fragment>\nfloat weave=sin(ribbonUv.x*75.)*sin(ribbonUv.y*300.);diffuseColor.rgb*=1.+.035*weave;');
 };
 const ribbonPoints=[[0,-.02,0],[-.38,-.17,.035],[-.24,-.43,-.025],[-.56,-.65,0]];
 const originalLength=.5097738310604516;
 const rawLength=new THREE.CatmullRomCurve3(ribbonPoints.map(p=>new THREE.Vector3(...p))).getLength();
 const lengthScale=2*originalLength/rawLength;
 const points=ribbonPoints.map(([x,y,z])=>[x*lengthScale,-.02+(y+.02)*lengthScale,z*lengthScale]);
 const ribbon=strip(points,.043,ribbonMaterial);ribbon.name='woven-ribbon';root.add(ribbon);
 root.userData.ribbonLength=2*originalLength;
 const ribbonEnd=points.at(-1);

 const threadCurve=new THREE.LineCurve3(new THREE.Vector3(.06,-.5,0),new THREE.Vector3(.06,-1.16,0));
 const thread=new THREE.Mesh(new THREE.TubeGeometry(threadCurve,1,.007,6,false),ribbonMaterial);thread.name='bead-thread';root.add(thread);
 const pearlMaterial=new THREE.MeshPhysicalMaterial({color:0xf5f5f0,roughness:.19,metalness:.08,clearcoat:1,clearcoatRoughness:.12,iridescence:.16,iridescenceIOR:1.3,envMap,envMapIntensity:1.1});
 const shape=heartShape();
 const heartGeometry=heartBeadGeometry();
 const beads=[['pearl',-.55,.047],['blue-heart',-.667,.32],['pearl',-.797,.054],['pink-heart',-.937,.31],['pearl',-1.06,.041]];
 root.userData.beadOrder=beads.map(([name])=>name);
 for(const [name,y,size] of beads){
  const isPearl=name==='pearl';
  const material=isPearl?pearlMaterial:new THREE.MeshPhysicalMaterial({color:name==='blue-heart'?0x7d92d5:0xdf8eac,roughness:.12,metalness:0,transparent:true,opacity:.68,depthWrite:false,clearcoat:1,clearcoatRoughness:.07,envMap,envMapIntensity:1.25});
  const bead=new THREE.Mesh(isPearl?new THREE.SphereGeometry(size,24,16):heartGeometry,material);
  bead.name=name;bead.position.set(.06,y,0);if(!isPearl){bead.scale.setScalar(size);bead.rotation.y=name==='blue-heart'?-.16:.15;}
  root.add(bead);
 }
 const knot=strip([[.015,-1.13,.027],[.08,-1.107,.03],[.104,-1.15,.025],[.04,-1.17,.032],[.014,-1.13,.027]],.034,ribbonMaterial);knot.name='ribbon-knot';root.add(knot);
 const tail=strip([[.083,-1.145,.007],[.15,-1.25,.03],[.27,-1.45,.03],[.32,-1.62,.015]],.042,ribbonMaterial);tail.name='ribbon-knot-tail';root.add(tail);
 const silver=new THREE.MeshPhysicalMaterial({color:0xe0e4e7,metalness:.95,roughness:.15,clearcoat:1,clearcoatRoughness:.08,envMap,envMapIntensity:1.2});
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.043,.009,8,24),silver);ring.position.set(.06,-1.19,.01);ring.name='silver-jump-ring';root.add(ring);
 const charm=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.05,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:4,steps:1,curveSegments:24}),silver);charm.name='engraved-silver-heart';charm.position.set(-.005,-1.42,-.015);charm.rotation.z=.18;root.add(charm);
 const reflection=new THREE.Mesh(new THREE.ShapeGeometry(shape,24),new THREE.ShaderMaterial({uniforms:{engraving:{value:engraving}},vertexShader:'varying vec2 facePoint; void main(){facePoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 facePoint; uniform sampler2D engraving;
  void main(){float x=facePoint.x+.2*facePoint.y;
   vec3 silver=mix(vec3(.28,.29,.30),vec3(.76,.77,.78),smoothstep(-.28,.22,x));
   float window=exp(-pow((x-.02)/.095,2.));float shade=exp(-pow((x+.2)/.075,2.));
   silver=clamp(silver+vec3(.36)*window-vec3(.16)*shade,0.,1.);
   vec2 markUv=vec2((facePoint.x+.23)/.46,(facePoint.y+.114)/.13);
   float cut=texture2D(engraving,markUv).a;
   float upper=texture2D(engraving,markUv+vec2(0.,.042)).a;float lower=texture2D(engraving,markUv-vec2(0.,.042)).a;
   silver=mix(silver,vec3(.09,.10,.12),cut*.98);
   silver=clamp(silver+vec3(.22)*max(0.,upper-cut)-vec3(.12)*max(0.,lower-cut),0.,1.);
   gl_FragColor=vec4(silver,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`}));reflection.position.z=.076;charm.add(reflection);
 // Extend only the ribbon: jewellery keeps its original proportions/order.
 for(const child of root.children)if(child!==ribbon){child.position.x+=ribbonEnd[0]-.06;child.position.y+=ribbonEnd[1]+.51;}
 const bound=strip([[0,.20,0],[0,-.02,0]],.043,ribbonMaterial);bound.name='bound-ribbon';root.add(bound);
 return root;
}

export const SPINE_BACKING_X=-2.004,SPINE_BACKING_Z=-.05;
export function createSpineBacking(){
 // A solid navy binding follows the inner cloth shoulders. It overlaps both
 // the white signature and the cloth, including a small head/tail allowance.
 // Coordinates are authored against the actual case rather than a loose box.
 const xs=[-2.04,-2.025,-2.01,-1.99,-1.97,-1.95,-1.93,-1.92],overlap=.009;
 const contour=[[-2.075,.19],...xs.map(x=>[x,closedInnerDepth(x,true)+overlap]),...xs.slice().reverse().map(x=>[x,closedInnerDepth(x,false)-overlap]),[-2.075,-.29]];
 const shape=new THREE.Shape();contour.forEach(([x,z],i)=>{const fn=i?'lineTo':'moveTo';shape[fn](x-SPINE_BACKING_X,z-SPINE_BACKING_Z);});shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:5.56,bevelEnabled:false,steps:1});geometry.rotateX(Math.PI/2);geometry.translate(0,2.78,0);
 const material=new THREE.MeshStandardMaterial({color:0x182c51,roughness:.96});
 const backing=new THREE.Mesh(geometry,material);backing.name='navy-spine-backing';backing.position.set(SPINE_BACKING_X,0,SPINE_BACKING_Z);backing.userData.profile=contour;return backing;
}
