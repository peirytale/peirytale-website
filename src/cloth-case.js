import * as THREE from 'three';
import {COVER_HEIGHT,COVER_FORE_X,COVER_JOINT_X,JOINT_WIDTH,SPINE_CORNER_RADIUS,FRONT_COVER_TRAVEL,BACK_COVER_TRAVEL} from './book-dimensions.js';
export {BACK_COVER_TRAVEL} from './book-dimensions.js';

// One closed, indexed cloth skin: front, both joints, spine, rear and all
// turned edges. The same vertices/UVs survive the entire binding movement.
export const FRONT_BOARD_THICKNESS=.045,BACK_BOARD_THICKNESS=.045;
const HALF_HEIGHT=COVER_HEIGHT/2,FORE=COVER_FORE_X,JOINT=COVER_JOINT_X,BEVEL=.005;
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const GROOVE_START=JOINT+.02,GROOVE_END=GROOVE_START+JOINT_WIDTH;
const groove=x=>x>GROOVE_START&&x<GROOVE_END?Math.sin(Math.PI*(x-GROOVE_START)/JOINT_WIDTH)**2:0;
const bodyX=t=>FORE-BEVEL+(JOINT-FORE+BEVEL)*t;
export const frontPivotX=p=>JOINT+FRONT_COVER_TRAVEL*p;
function flatSpine(t){
 const radius=SPINE_CORNER_RADIUS,arc=Math.PI*radius/2,straight=.6-2*radius,d=t*(2*arc+straight);
 if(d<arc){const a=d/radius;return new THREE.Vector2(JOINT-radius*Math.sin(a),.25-radius+radius*Math.cos(a));}
 if(d<arc+straight)return new THREE.Vector2(JOINT-radius,.25-radius-(d-arc));
 const a=(d-arc-straight)/radius;return new THREE.Vector2(JOINT-radius*Math.cos(a),-.35+radius-radius*Math.sin(a));
}
function frontPoint(x,z,p,lift=0,tilt=0){
 const angle=(-Math.PI+tilt)*p,c=Math.cos(angle),s=Math.sin(angle);
 return new THREE.Vector2(frontPivotX(p)+(x-JOINT)*c+(z+.05)*s,-.05-(x-JOINT)*s+(z+.05)*c+lift);
}
function spinePoint(t,p,lift=0,tilt=0){
 const a=frontPoint(JOINT,.25,p,lift,tilt),b=new THREE.Vector2(JOINT+BACK_COVER_TRAVEL*p,-.35);
 const closedLength=.6-2*SPINE_CORNER_RADIUS+Math.PI*SPINE_CORNER_RADIUS;
 const length=THREE.MathUtils.lerp(closedLength,.12,p),angle=(-Math.PI+tilt)*p;
 const ta=new THREE.Vector2(-Math.cos(angle)*length,Math.sin(angle)*length),tb=new THREE.Vector2(length,0);
 const t2=t*t,t3=t2*t;
 const out=a.multiplyScalar(2*t3-3*t2+1).addScaledVector(ta,t3-2*t2+t).addScaledVector(b,-2*t3+3*t2).addScaledVector(tb,t3-t2);
 // A broad flat spine and small rounded shoulders, rather than a tube.
 // Its correction fades into the same connected opened-gutter profile.
 const base=new THREE.Vector2(JOINT,.25).multiplyScalar(2*t3-3*t2+1).addScaledVector(new THREE.Vector2(-closedLength,0),t3-2*t2+t).addScaledVector(new THREE.Vector2(JOINT,-.35),-2*t3+3*t2).addScaledVector(new THREE.Vector2(closedLength,0),t3-t2);
 out.addScaledVector(flatSpine(t).sub(base),1-p);
 out.y-=.015*p*Math.sin(Math.PI*t)**2;
 return out;
}
function outerPoint(row,p,lift=0,tilt=0){
 if(row.part==='front'){
  const x=bodyX(row.t)+(row.cap?BEVEL*Math.sin(row.cap):0);
  return frontPoint(x,.25-.048*groove(x),p,lift,tilt);
 }
 if(row.part==='spine')return spinePoint(row.t,p,lift,tilt);
 const x=bodyX(1-row.t)+(row.cap?BEVEL*Math.sin(row.cap):0);
 return new THREE.Vector2(x+BACK_COVER_TRAVEL*p,-.35+.048*groove(x));
}
function boardThickness(x,front=true){return .035+((front?FRONT_BOARD_THICKNESS:BACK_BOARD_THICKNESS)-.035)*smooth((x-JOINT)/.30);}
export function closedInnerDepth(x,front=true){return front?.25-.048*groove(x)-boardThickness(x,true):-.35+.048*groove(x)+boardThickness(x,false);}
export function frontEndpaperPoint(x,p,lift=0,depth=0,tilt=0){
 const slope=x>GROOVE_START&&x<GROOVE_END?-.048*Math.PI/JOINT_WIDTH*Math.sin(2*Math.PI*(x-GROOVE_START)/JOINT_WIDTH):0;
 const normal=new THREE.Vector2(-slope,1).normalize(),distance=boardThickness(x,true)+.002-depth;
 return frontPoint(x-normal.x*distance,.25-.048*groove(x)-normal.y*distance,p,lift,tilt);
}
function thickness(row){
 if(row.part==='spine')return .035;
 const x=row.part==='front'?bodyX(row.t):bodyX(1-row.t);
 return boardThickness(x,row.part==='front');
}
function outward(row,p,lift=0,tilt=0){
 if(row.cap)return row.part==='front'?new THREE.Vector2(-Math.sin((-Math.PI+tilt)*p),Math.cos((-Math.PI+tilt)*p)):new THREE.Vector2(0,-1);
 const eps=.00001,t0=Math.max(0,row.t-eps),t1=Math.min(1,row.t+eps);
 const tangent=outerPoint({...row,t:t1},p,lift,tilt).sub(outerPoint({...row,t:t0},p,lift,tilt)).normalize();
 return new THREE.Vector2(tangent.y,-tangent.x);
}
// Points around a rounded rectangular cross-section; matching first/last
// vertices deliberately share coordinates and normals at the UV closure.
function ring(half,halfHeight,radius){
 const result=[];
 const add=(n,y)=>result.push([n,y]);
 add(half,-halfHeight+radius);add(half,halfHeight-radius);
 const arc=(cx,cy,start)=>{for(let i=1;i<=6;i++){const a=start+i*Math.PI/12;add(cx+radius*Math.cos(a),cy+radius*Math.sin(a));}};
 arc(half-radius,halfHeight-radius,0);
 add(-half+radius,halfHeight);arc(-half+radius,halfHeight-radius,Math.PI/2);
 add(-half,-halfHeight+radius);arc(-half+radius,-halfHeight+radius,Math.PI);
 add(half-radius,-halfHeight);arc(half-radius,-halfHeight+radius,Math.PI*1.5);
 result[result.length-1]=[...result[0]];
 return result;
}
function rowsForCase(){
 const rows=[];
 for(let i=6;i>=1;i--)rows.push({part:'front',t:0,cap:(Math.PI/2-.001)*i/6});
 const samples=new Set(Array.from({length:65},(_,i)=>i/64));
 for(let i=0;i<=20;i++)samples.add(.88+i*.12/20);
 const front=[...samples].sort((a,b)=>a-b);
 for(const t of front)rows.push({part:'front',t});
 for(let i=1;i<=40;i++)rows.push({part:'spine',t:i/40});
 for(const t of [...front].reverse().map(x=>1-x).slice(1))rows.push({part:'back',t});
 for(let i=1;i<=6;i++)rows.push({part:'back',t:1,cap:(Math.PI/2-.001)*i/6});
 let distance=0,previous;
 for(const row of rows){
  const position=outerPoint(row,0);
  if(previous&&!row.cap&&previous.part!==undefined)distance+=position.distanceTo(previous.position);
  row.distance=distance;previous={position,part:row.part};
 }
 const total=distance;
 for(const row of rows)row.u=row.distance/total;
 const nearest=(part,x)=>rows.filter(r=>r.part===part&&!r.cap).reduce((a,b)=>Math.abs((part==='front'?bodyX(a.t):bodyX(1-a.t))-x)<Math.abs((part==='front'?bodyX(b.t):bodyX(1-b.t))-x)?a:b);
 return {rows,total,joins:[nearest('front',GROOVE_START+JOINT_WIDTH/2).u,nearest('back',GROOVE_START+JOINT_WIDTH/2).u]};
}
export class ClothCase {
 constructor(){
  const {rows,total,joins}=rowsForCase();this.rows=rows;this.length=total;this.joins=joins;
  this.ringSize=ring(.07,HALF_HEIGHT,BEVEL).length;
  const count=rows.length*this.ringSize+2;
  const positions=new Float32Array(count*3),uv=new Float32Array(count*2),clothUv=new Float32Array(count*2),indices=[];
  rows.forEach((row,i)=>{for(let j=0;j<this.ringSize;j++){const k=i*this.ringSize+j;uv[k*2]=row.u;clothUv[k*2]=row.u*total;}});
  for(let i=0;i<rows.length-1;i++)for(let j=0;j<this.ringSize-1;j++){
   const a=i*this.ringSize+j,b=a+this.ringSize;
   indices.push(a,a+1,b,b,a+1,b+1);
  }
  const firstCenter=count-2,lastCenter=count-1,last=(rows.length-1)*this.ringSize;
  for(let j=0;j<this.ringSize-1;j++){indices.push(firstCenter,j+1,j);indices.push(lastCenter,last+j,last+j+1);}
  uv[firstCenter*2]=0;uv[firstCenter*2+1]=.5;uv[lastCenter*2]=1;uv[lastCenter*2+1]=.5;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('clothUv',new THREE.BufferAttribute(clothUv,2));geometry.setIndex(indices);
  this.geometry=geometry;
  this.readingCrop={value:0};
  this.material=new THREE.MeshStandardMaterial({color:0xbed3db,roughness:.97,metalness:0});
  this.material.onBeforeCompile=shader=>{
   shader.uniforms.readingCrop=this.readingCrop;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 clothUv;varying vec2 vCloth;varying float clothX;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCloth=clothUv;clothX=position.x;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vCloth;varying float clothX;uniform float readingCrop;').replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(readingCrop>.5&&clothX<-.045)discard;').replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec2 thread=vec2(vCloth.x*880.,vCloth.y*10053.09649);
    float coverage=1.-smoothstep(.5,2.,max(fwidth(thread.x),fwidth(thread.y)));
    if(coverage>.001){
    float relief=.00022*sin(thread.x)*sin(thread.y)*coverage;
    vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
    vec3 rx=cross(dy,normal),ry=cross(normal,dx);
    float determinant=dot(dx,rx);
    vec3 gradient=sign(determinant)*(dFdx(relief)*rx+dFdy(relief)*ry);
    normal=normalize(max(abs(determinant),1e-8)*normal-gradient);
    }`);
  };
  this.material.customProgramCacheKey=()=> 'continuous-cotton-case-v1';
  this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.name='continuous-cloth-case';this.mesh.userData.clothContinuous=true;
  this.update(0);
 }
 // Mobile reading follows one leaf. This crops its offscreen neighbour only
 // in the reading viewport; inspection always retains the complete skin.
 setReadingLeaf(singleLeaf){this.readingCrop.value=singleLeaf?1:0;}
 update(progress,lift=0,tilt=0){
  const p=THREE.MathUtils.clamp(progress,0,1);
  if(this.progress===p&&this.frontLift===lift&&this.frontTilt===tilt&&this.geometry.boundingBox)return;
  this.progress=p;this.frontLift=lift;this.frontTilt=tilt;
  const position=this.geometry.attributes.position,uv=this.geometry.attributes.uv,clothUv=this.geometry.attributes.clothUv;
  this.rows.forEach((row,i)=>{
   const outer=outerPoint(row,p,lift,tilt),normal=outward(row,p,lift,tilt),half=thickness(row)/2;
   const center=outer.clone().addScaledVector(normal,-half);
   if(!row.section){
    const shrink=row.cap?BEVEL*(1-Math.cos(row.cap)):0,radius=Math.min(BEVEL,half*.45)*(row.cap?Math.cos(row.cap):1);
    row.section=ring(half-shrink,HALF_HEIGHT-shrink,radius);
    row.loopLength=row.section.reduce((sum,[n,y],j)=>j?sum+Math.hypot(n-row.section[j-1][0],y-row.section[j-1][1]):0,0);
   }
   const section=row.section,loopLength=row.loopLength;
   let perimeter=0;
   section.forEach(([n,y],j)=>{
    const k=i*this.ringSize+j;
    position.setXYZ(k,center.x+normal.x*n,y,center.y+normal.y*n);
    if(this.initialized)return;
    if(j)perimeter+=Math.hypot(n-section[j-1][0],y-section[j-1][1]);
    // Unroll the small turn-ins as well as the broad faces. Projecting every
    // edge onto one image column would stretch the cloth into coloured stripes.
    const edgeWrap=(half-n)*smooth((Math.abs(y)-HALF_HEIGHT+.16)/.16)*Math.sign(y);
    const foreWeight=row.cap?1:row.part==='front'?1-smooth(row.t*4.1/.12):row.part==='back'?1-smooth((1-row.t)*4.1/.12):0;
    const foreWrap=(half-n)*(row.part==='front'?-1:1)*foreWeight/this.length;
    uv.setX(k,row.u+foreWrap);uv.setY(k,(y+HALF_HEIGHT+edgeWrap)/(2*HALF_HEIGHT));clothUv.setY(k,perimeter/loopLength);
   });
   if(i===0||i===this.rows.length-1){const k=position.count-(i===0?2:1);position.setXYZ(k,center.x,0,center.y);if(!this.initialized)uv.setX(k,row.u+half*(row.part==='front'?-1:1)/this.length);}
  });
  position.needsUpdate=true;
  if(!this.initialized){uv.needsUpdate=true;clothUv.needsUpdate=true;this.initialized=true;}
  this.geometry.computeVertexNormals();
  const normals=this.geometry.attributes.normal;
  for(let i=0;i<this.rows.length;i++){
   const a=i*this.ringSize,b=a+this.ringSize-1,n=new THREE.Vector3().fromBufferAttribute(normals,a).add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);
  }
  normals.needsUpdate=true;this.geometry.computeBoundingBox();this.geometry.computeBoundingSphere();
 }
 setImages(front,spine,back,anisotropy=4){
  const height=1024,width=Math.ceil(this.length*height/(2*HALF_HEIGHT));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');
  const joins=this.joins.map(x=>Math.round(x*width)),bounds=[0,...joins,width];
  [front,spine,back].forEach((image,i)=>{context.save();context.translate(bounds[i+1],0);context.scale(-1,1);context.drawImage(image,0,0,bounds[i+1]-bounds[i],height);context.restore();});
  // The cloth references have different photographic crops. Feather
  // their shared atlas only inside the two recessed joints, never at an edge.
  const data=context.getImageData(0,0,width,height),source=data.data.slice(),band=12;
  for(const join of joins)for(let x=-band;x<=band;x++){
   const weight=smooth((x+band)/(2*band));
   for(let y=0;y<height;y++)for(let c=0;c<3;c++){
    const left=(y*width+join-1-Math.abs(x))*4+c,right=(y*width+join+Math.abs(x))*4+c;
    data.data[(y*width+join+x)*4+c]=source[left]*(1-weight)+source[right]*weight;
   }
  }
  context.putImageData(data,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=anisotropy;
  // Only the narrow, previously unseen turn-ins extend beyond the photographs.
  // Mirrored edge padding keeps their observed dyes/weave continuous, rather
  // than introducing a plain trim or inventing a separate border design.
  texture.wrapS=texture.wrapT=THREE.MirroredRepeatWrapping;
  this.material.map?.dispose();this.material.map=texture;this.material.color.set(0xffffff);this.material.needsUpdate=true;
  this.atlas=canvas;
 }
}
