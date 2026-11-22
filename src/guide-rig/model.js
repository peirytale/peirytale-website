import * as THREE from 'three';
import {GuideSourceParts} from './source-parts.js';
import {authoredViews} from './views.js';
import {gaitPose,gaitConfig} from './gait.js';
import {rigidPoint} from './deform.js';
import {paintedLimbMotion} from './painted-motion.js';
export const rigSize=320,rigPadding=32;
// Painted limbs move as complete rigid cutouts. No generated contour, bone
// scaling, foreshortening or wrist/knee reconstruction changes their shape.
export class GuideRig{
 constructor(renderer,atlasImage,repairImage){
  this.renderer=renderer;this.parts=new GuideSourceParts(atlasImage,repairImage);this.views=new Map();this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-rigPadding,256+rigPadding,-rigPadding,256+rigPadding,.1,10);this.camera.position.z=1;
  this.target=new THREE.WebGLRenderTarget(rigSize,rigSize,{depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});this.target.texture.colorSpace=THREE.NoColorSpace;
 }
 get texture(){return this.target.texture;}
 async warm(){for(let row=0;row<authoredViews.length;row++){await new Promise(resolve=>typeof requestIdleCallback==='function'?requestIdleCallback(resolve,{timeout:100}):requestAnimationFrame(resolve));if(this.disposed)return false;this.draw(row,0,0);}return true;}
 makePart(part,connected=false){
  const {image,x,y}=part,w=image.width,h=image.height,texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.NoColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.premultiplyAlpha=true;
  const geometry=new THREE.PlaneGeometry(w,h,connected?Math.max(2,Math.ceil(w/4)):1,connected?Math.max(4,Math.ceil(h/3)):1),uv=geometry.attributes.uv,position=geometry.attributes.position,source=[];
  for(let i=0;i<position.count;i++){const point=[x+uv.getX(i)*w,y+(1-uv.getY(i))*h];source.push(point);position.setXYZ(i,...point,0);}position.needsUpdate=true;
  const material=new THREE.ShaderMaterial({uniforms:{map:{value:texture}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D map;varying vec2 p;void main(){vec4 c=texture2D(map,p);if(c.a<.001)discard;gl_FragColor=vec4(c.rgb/max(c.a,.00001),c.a);}',transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;return {mesh,source,texture,geometry,material};
 }
 prepare(row){
  const data=this.parts.views.get(row)||this.parts.prepare(authoredViews[row]),group=new THREE.Group(),meshes=[],add=(part,connected)=>{const p=this.makePart(part,connected);group.add(p.mesh);meshes.push(p);return p;};
  const legs=data.legs.map(s=>({skin:s,limb:add(s.limb),shoe:add(s.shoe)})),arms=data.arms.map(s=>({skin:s,limb:add(s.limb),hand:add(s.hand)})),patch=add(data.patch),torso=add(data.torso),head=add(data.head);
  const v={data,group,meshes,legs,arms,patch,torso,head};group.visible=false;this.scene.add(group);this.views.set(row,v);return v;
 }
 deform(part,transform){const position=part.geometry.attributes.position;part.source.forEach((p,i)=>position.setXYZ(i,...transform(p,i),0));position.needsUpdate=true;}
 strideScale(row){return this.parts.strideScale(row);}
 draw(row,phase,weight=1){
  if(this.disposed)return this.texture;
  const v=this.views.get(row)||this.prepare(row),d=v.data.def,p=gaitPose(phase),bob=(5+gaitConfig.hipHeight-p.hipHeight)*weight;for(const current of this.views.values())current.group.visible=current===v;
  let rank=0;const order=part=>part.mesh.renderOrder=rank++;
  const move=(parts,motion,offset=0)=>{const target=motion.pivot.map((n,i)=>n+motion.translation[i]+(i?offset:0));for(const part of parts)this.deform(part,point=>rigidPoint(point,motion.pivot,target,motion.rotation));};
  const leg=side=>{const entry=v.legs[side],motion=paintedLimbMotion(d,side,phase,weight,'leg',v.data.contact);move([entry.limb],motion);move([entry.shoe],motion.shoe);order(entry.limb);order(entry.shoe);};
  const arm=side=>{const entry=v.arms[side];move([entry.limb,entry.hand],paintedLimbMotion(d,side,phase,weight,'arm'),bob);order(entry.limb);order(entry.hand);};
  d.legOrder.forEach(leg);for(let side=0;side<2;side++)if(!d.frontArms.includes(side))arm(side);v.patch.mesh.position.y=v.torso.mesh.position.y=v.head.mesh.position.y=bob;order(v.patch);order(v.torso);d.frontArms.forEach(arm);order(v.head);this.render();return this.texture;
 }
 render(){
  const r=this.renderer,previous=r.getRenderTarget(),auto=r.autoClear,color=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha(),shadowAuto=r.shadowMap.autoUpdate,shadowNeeds=r.shadowMap.needsUpdate;
  // Render-target viewports are physical pixels. setViewport() would multiply
  // this fixed-size glyph by the display DPR and crop/distort it on Retina.
  try{r.autoClear=true;r.shadowMap.autoUpdate=false;r.shadowMap.needsUpdate=false;r.setRenderTarget(this.target);r.setClearColor(0,0);r.render(this.scene,this.camera);}finally{r.setRenderTarget(previous);r.setClearColor(color,alpha);r.autoClear=auto;r.shadowMap.autoUpdate=shadowAuto;r.shadowMap.needsUpdate=shadowNeeds;}
 }
 restore(){for(const v of this.views.values())for(const p of v.meshes)p.texture.needsUpdate=true;}
 releaseGPU(){if(!this.renderer.getContext().isContextLost())return;this.target.dispose();for(const v of this.views.values())for(const p of v.meshes){p.texture.dispose();p.geometry.dispose();p.material.dispose();}}
 dispose(){this.disposed=true;for(const v of this.views.values())for(const p of v.meshes){p.texture.dispose();p.geometry.dispose();p.material.dispose();}this.views.clear();this.target.dispose();this.parts.dispose();this.scene.clear();}
}
