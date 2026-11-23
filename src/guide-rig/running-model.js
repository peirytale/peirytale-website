import {prepareTeacupParts} from './teacup-parts.js';
import {Texture,LinearFilter} from 'three';
import {landingFragment} from './landing.js';
import {GuideRig} from './model.js';
import {prepareSouthPalm} from './south-palm.js';
import metadata from './run-parts.json';
import {curvedLimbPoint,paintedLegPoint,diagonalSleeve,projectedSleeve,runContact,runPose} from './run-motion.js';
import {rigidPoint} from './deform.js';
import {gaitConfig} from './gait.js';
// Carry the terminal band of the calf/sleeve on the same rigid transform
// as its shoe/fist. Every overlapping painted pixel then meets its mate.
function attachedLimbPoint(point, source, target, rotation, projection) {
 const end=source[2],joint=source[1],dx=end[0]-joint[0],dy=end[1]-joint[1];
 const distance=((end[0]-point[0])*dx+(end[1]-point[1])*dy)/Math.hypot(dx,dy);
 const rigid=rigidPoint(point,end,target[2],rotation);
 if(distance<=5)return rigid;
 const curved=curvedLimbPoint(point,source,target,projection);
 const t=Math.min(1,(distance-5)/11),blend=t*t*(3-2*t);
 return curved.map((v,i)=>rigid[i]+(v-rigid[i])*blend);
}
export class RunningGuideRig extends GuideRig{
 constructor(renderer,atlas,repair,runImage){super(renderer,atlas,repair);this.runImage=runImage;this.runViews=new Map();
  if(runImage?.height===1792){
   this.landingAtlas=new Texture(runImage);
   this.landingAtlas.generateMipmaps=false;
   this.landingAtlas.minFilter=this.landingAtlas.magFilter=LinearFilter;
   this.landingAtlas.needsUpdate=true;
  }}
 async warm(){for(let row=0;row<8;row++){await new Promise(resolve=>typeof requestIdleCallback==='function'?requestIdleCallback(resolve,{timeout:100}):requestAnimationFrame(resolve));if(this.disposed)return false;this.draw(row,.25,1);this.draw(row,0,0);}return true;}
 part(def){const [ax,ay,w,h]=def.atlas,[x,y]=def.source,image=Object.assign(document.createElement('canvas'),{width:w,height:h});image.getContext('2d').drawImage(this.runImage,ax,ay,w,h,0,0,w,h);return {image,x,y};}
 joined(defs){const parts=defs.map(d=>this.part(d)),x=Math.min(...parts.map(p=>p.x)),y=Math.min(...parts.map(p=>p.y)),right=Math.max(...parts.map(p=>p.x+p.image.width)),bottom=Math.max(...parts.map(p=>p.y+p.image.height)),image=Object.assign(document.createElement('canvas'),{width:right-x,height:bottom-y}),ctx=image.getContext('2d');for(const p of parts)ctx.drawImage(p.image,p.x-x,p.y-y);return {image,x,y};}
 prepareRun(row){
  const original=this.views.get(row)||super.prepare(row),record=metadata.views[row],group=original.group,meshes=[],add=(part,connected=false)=>{const p=this.makePart(part,connected);group.add(p.mesh);meshes.push(p);return p;},legs=record.legs.map(l=>({skin:add(this.joined([l.upper,l.lower,l.cap]),true),shoe:add(this.part(l.shoe))})),arms=record.arms.map(a=>({
   sleeve:add(row===2?this.part(a.upper):this.joined([a.upper,a.lower,a.cap]),true),
   forearm:row===2?add(this.part(a.lower),true):null,
   hand:add(this.part(a.hand))
  })),contact=runContact(record),v={original,record,legs,arms,meshes,contact};
  if(row===2)arms.forEach((parts,side)=>{parts.posePalm=prepareSouthPalm(parts.hand,record.arms[side],this.runImage);});
  const body=document.createElement('canvas');
  body.width=body.height=256;
  const bc=body.getContext('2d');
  bc.drawImage(original.data.bodyOutline,0,0);
  const upper=document.createElement('canvas');upper.width=upper.height=256;
  const uc=upper.getContext('2d'),torso=original.data.torso;
  uc.drawImage(torso.image,torso.x,torso.y);
  const collar=[123,121,109,133,123,124,108,128][row];
  const fade=uc.createLinearGradient(0,collar-6,0,collar+4);
  fade.addColorStop(0,'#000');fade.addColorStop(1,'transparent');
  uc.globalCompositeOperation='destination-in';uc.fillStyle=fade;uc.fillRect(0,0,256,256);
  if(row!==2)bc.drawImage(upper,0,0);
  v.body=add({image:body,x:0,y:0});
  if(row===2){
   // The old head cutout includes the tips of its old jacket collar.
   // Keep the face and hair, letting the fitted neckline meet the jaw.
   const face=document.createElement('canvas');face.width=face.height=256;
   const fc=face.getContext('2d'),h=original.data.head;
   fc.drawImage(h.image,h.x,h.y);fc.clearRect(114,83,36,19);
   v.face=add({image:face,x:0,y:0});
  }
  if(row===2){
   // The jacket edge progressively occludes the receding arm. Moving the
   // occlusion edge across the elbow avoids changing render order mid-stride.
   v.sideCover=add({image:body,x:0,y:0});
   const material=v.sideCover.material;
   material.uniforms.aft={value:[0,0]};
   material.fragmentShader=`
    uniform sampler2D map;
    uniform vec2 aft;
    varying vec2 p;
    void main(){
     vec2 xy=vec2(p.x,1.-p.y)*256.;
     float depth=xy.x>132.?aft.x:aft.y;
     float coverage=smoothstep(.69,.98,depth)*smoothstep(105.,121.,xy.y);
     vec4 c=texture2D(map,p);
     if(depth<.01||coverage<.001||c.a<.97)discard;
     gl_FragColor=vec4(c.rgb/max(c.a,.00001),c.a*coverage);
    }`;
  }
  // Retain the painted seam across the shoulder socket during the entire
  // swing. Feather only its lower edge into the articulated upper sleeve.
  const shoulders=document.createElement('canvas');
  shoulders.width=shoulders.height=256;
  const sc=shoulders.getContext('2d');
  if(original.data.def.name==='W'){
   // On the profile the ivory collar runs from the nape to the lapel in
   // front of the sleeve. Keep that whole painted edge on one body layer.
   sc.beginPath();
   sc.moveTo(80,108);sc.lineTo(111,99);sc.lineTo(120,101);
   sc.quadraticCurveTo(126,111,126,122);
   sc.bezierCurveTo(119,117,112,113,106,118);
   sc.bezierCurveTo(99,119,98,133,87,140);
   sc.lineTo(81,139);sc.closePath();sc.clip();
   sc.drawImage(original.data.source,0,0);
  }else if(row===2){
   // Retain the reference jacket at the inner shoulder. Its matching sleeve
   // cap owns the outer edge all the way down the arm.
   for(const a of record.arms){
    sc.save();sc.beginPath();sc.arc(...a.shoulder,11,0,Math.PI*2);sc.clip();
    sc.drawImage(body,0,0);sc.restore();
   }
  }else for(let side=0;side<2;side++){
   const socket=record.arms[side].shoulder;
   const layer=document.createElement('canvas');
   layer.width=layer.height=256;
   const lc=layer.getContext('2d');
   const arm=original.data.arms[side].upper;
   for(const part of [original.data.torso,arm])lc.drawImage(part.image,part.x,part.y);
   lc.globalCompositeOperation='destination-in';
   const feather=lc.createRadialGradient(...socket,8,...socket,11);
   feather.addColorStop(0,'#000');feather.addColorStop(1,'transparent');
   lc.fillStyle=feather;lc.fillRect(0,0,256,256);
   sc.drawImage(layer,0,0);
  }
  v.shoulders=add({image:shoulders,x:0,y:0});
  if(this.landingAtlas){
   v.landing=add({image:original.data.source,x:0,y:0});
   const material=v.landing.material;
   material.fragmentShader=landingFragment;
   Object.assign(material.uniforms,{packed:{value:this.landingAtlas},row:{value:row},progress:{value:0}});
  }
  original.meshes.push(...meshes);this.runViews.set(row,v);return v;
 }
 strideScale(row){return (this.runViews.get(row)||this.prepareRun(row)).contact.stride/gaitConfig.stride;}
 draw(row,phase,weight=1){
  if(this.disposed)return this.texture;if(!this.runImage)return super.draw(row,phase,weight);
  const v=this.runViews.get(row)||this.prepareRun(row),o=v.original;
  if(v.landing&&weight<=.12){
   for(const current of this.views.values())current.group.visible=current===o;
   for(const part of o.meshes)part.mesh.visible=part===v.landing;
   const t=Math.max(0,weight/.12);
   v.landing.material.uniforms.progress.value=t*t*(3-2*t);
   this.pose=runPose(v.record,phase,0,v.contact);
   this.render();return this.texture;
  }
  if(weight<=1e-4)return super.draw(row,phase,0);
  const t=Math.max(0,Math.min(1,(weight-.12)/.12));
  return this.drawArticulated(row,phase,v.landing?weight*t*t*(3-2*t):weight);
 }
 // The workshop uses this same articulated outfit right through weight zero.
 // The castle keeps its separately authored frame-zero doorway pose.
 drawArticulated(row,phase,weight,strideMultiplier=1,dressImage=null){
  if(this.disposed)return this.texture;
  const v=this.runViews.get(row)||this.prepareRun(row),o=v.original,d=o.data.def;
  if(dressImage&&!v.dress)v.dress=prepareTeacupParts(this,v,dressImage);
  const outfit=dressImage?v.dress:v;
  const head=outfit.head||v.face||o.head;
  if(dressImage&&!outfit.visible){
   outfit.visible=new Set([...outfit.meshes,...v.legs.map(({skin})=>skin),...outfit.arms.map(a=>a.hand)]);
  }
  for(const current of this.views.values())current.group.visible=current===o;
  for(const part of o.meshes)part.mesh.visible=dressImage?outfit.visible.has(part):part!==v.landing&&(v.meshes.includes(part)||part===head);
  const pose=runPose(v.record,phase,weight,v.contact,strideMultiplier);
  this.pose=pose;
  const sideProjection=Math.abs(v.contact.projection.c);
  // Diagonal arm swings sweep closer to horizontal than the legs.
  // Follow that bend so the painted sleeve stays broad across the forearm.
  const sleeveProjection=Math.min(1,sideProjection*1.9);
  let rank=0;const order=p=>p.mesh.renderOrder=rank++,curve=(part,source,target,rotation,projection=sideProjection)=>this.deform(part,p=>attachedLimbPoint(p,source,target,rotation,projection)),rigid=(part,from,to,angle=0)=>this.deform(part,p=>rigidPoint(p,from,to,angle));
  const leg=side=>{
   const a=v.record.legs[side],b=pose.legs[side],{skin,shoe}=v.legs[side];
   const footwear=outfit.shoes?.[side]??shoe;
   this.deform(skin,p=>paintedLegPoint(p,a,b));
   rigid(footwear,a.ankle,b.ankle,b.shoeAngle);
   order(skin);order(footwear);
  };
  d.legOrder.forEach(leg);
  const arm=side=>{
   const a=v.record.arms[side],b=pose.arms[side],m=outfit.arms[side];
   if(m.forearm){
    this.deform(m.sleeve,projectedSleeve(a.shoulder,a.elbow,b.shoulder,b.elbow));
    this.deform(m.forearm,projectedSleeve(a.elbow,a.wrist,b.elbow,b.wrist));
   }else if(row===1||row===3)this.deform(m.sleeve,diagonalSleeve(a,b));
   else curve(m.sleeve,[a.shoulder,a.elbow,a.wrist],[b.shoulder,b.elbow,b.wrist],b.handAngle,sleeveProjection);
   if(m.posePalm)m.posePalm(b);
   else rigid(m.hand,a.wrist,b.wrist,b.handAngle);
   order(m.sleeve);if(m.forearm)order(m.forearm);order(m.hand);
  };
  for(let side=0;side<2;side++)if(!d.frontArms.includes(side))arm(side);outfit.body.mesh.position.y=head.mesh.position.y=pose.bodyY;order(outfit.body);d.frontArms.forEach(arm);
  if(outfit.sideCover){
   // The projecting forearm curls up in front of its own shoulder.
   v.shoulders.mesh.position.y=pose.bodyY;order(v.shoulders);
   for(const m of outfit.arms){order(m.forearm);order(m.hand);}
   const aft=outfit.sideCover.material.uniforms.aft.value;
   aft[0]=pose.arms[0].aft;aft[1]=pose.arms[1].aft;
   outfit.sideCover.mesh.position.y=pose.bodyY;order(outfit.sideCover);

  }
  v.shoulders.mesh.position.y=pose.bodyY;
  // The west collar carries the original nape pixels at its top seam.
  if(d.name==='W'){order(head);order(v.shoulders);}
  else{if(!outfit.sideCover)order(v.shoulders);order(head);}
  this.render();return this.texture;
 }
 restore(){super.restore();if(this.landingAtlas)this.landingAtlas.needsUpdate=true;}
 dispose(){this.landingAtlas?.dispose();super.dispose();this.runViews.clear();this.runImage=null;}
}
