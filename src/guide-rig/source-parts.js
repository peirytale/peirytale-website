import {gaitConfig} from './gait.js';
import {authoredViews} from './views.js';
import {paintedContact} from './painted-motion.js';
const canvas=(width=256,height=256)=>Object.assign(document.createElement('canvas'),{width,height});
const polygon=(c,points)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();};
function trim(image){
 const c=image.getContext('2d'),data=c.getImageData(0,0,256,256).data;let left=256,top=256,right=0,bottom=0;
 for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(data[(y*256+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
 if(right===0)return {image:canvas(1,1),x:0,y:0};
 left=Math.max(0,left-1);top=Math.max(0,top-1);right=Math.min(256,right+1);bottom=Math.min(256,bottom+1);
 const out=canvas(right-left,bottom-top);out.getContext('2d').drawImage(image,left,top,right-left,bottom-top,0,0,right-left,bottom-top);return {image:out,x:left,y:top};
}
function paintedSole(part){
 const {image,x,y}=part,w=image.width,h=image.height,p=image.getContext('2d').getImageData(0,0,w,h).data;let bottom=h-1;while(bottom>0&&!Array.from({length:w},(_,i)=>p[(bottom*w+i)*4+3]).some(a=>a>200))bottom--;
 let sum=0,mass=0;for(let row=Math.max(0,bottom-1);row<=bottom;row++)for(let col=0;col<w;col++){const alpha=p[(row*w+col)*4+3];if(alpha>200){sum+=(col+.5)*alpha;mass+=alpha;}}
 return [x+(mass?sum/mass:w/2),y+bottom+1];
}
// Every cached part retains source coordinates and original pigment. Only the
// missing cloth beneath departing arms uses the generated repair plates.
export class GuideSourceParts{
 constructor(atlasImage,repairImage){this.atlasImage=atlasImage;this.repairImage=repairImage;this.views=new Map();}
 prepare(def){
  const source=canvas(),c=source.getContext('2d');c.drawImage(this.atlasImage,0,def.row*256,256,256,0,0,256,256);
  const pixels=c.getImageData(0,0,256,256),slice=test=>{const out=canvas(),ctx=out.getContext('2d'),data=new ImageData(new Uint8ClampedArray(pixels.data),256,256);for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(!test(x,y))data.data[(y*256+x)*4+3]=0;ctx.putImageData(data,0,0);return trim(out);};
  const mask=(points,padding=0)=>{const out=canvas(),ctx=out.getContext('2d');polygon(ctx,points);ctx.fill();if(padding){ctx.lineJoin='round';ctx.lineWidth=padding*2;ctx.stroke();}const data=ctx.getImageData(0,0,256,256).data;return (x,y)=>data[(y*256+x)*4+3]>=128;};
  const inHead=mask(def.head),lowerMask=mask(def.lowerBody),inLowerBody=(x,y)=>y>=def.hem+2||lowerMask(x,y),armMasks=def.arms.map(d=>mask(d.mask,1));
  const plate=canvas(),plateContext=plate.getContext('2d');if(this.repairImage){if(this.repairImage.height===2048)plateContext.drawImage(this.repairImage,0,def.row*256,256,256,0,0,256,256);else plateContext.drawImage(this.repairImage,...def.patch);}
  const owners=new Int8Array(256*256);owners.fill(-1);const active=def.arms.map((a,i)=>a.virtual?-1:i).filter(i=>i>=0);
  const score=(x,y,a)=>{const t=Math.max(0,Math.min(1,(y-a.joints[0][1])/(a.wrist[1]-a.joints[0][1]))),cx=a.joints[0][0]+(a.wrist[0]-a.joints[0][0])*t;return (x-cx)**2;};
  for(let y=0;y<def.hem;y++)for(let x=0;x<256;x++)if(!inHead(x,y)&&pixels.data[(y*256+x)*4+3]){const candidates=active.filter(i=>armMasks[i](x,y));if(candidates.length)owners[y*256+x]=candidates.reduce((best,i)=>score(x,y,def.arms[i])<score(x,y,def.arms[best])?i:best);}
  const inArm=(x,y)=>owners[y*256+x]>=0;
  const torso=slice((x,y)=>!inLowerBody(x,y)&&!inHead(x,y)&&!inArm(x,y)),head=slice((x,y)=>!inLowerBody(x,y)&&inHead(x,y));
  const patch=canvas(),pc=patch.getContext('2d');
  if(this.repairImage){
   pc.drawImage(plate,0,0);
   const erasure=canvas(),ec=erasure.getContext('2d'),maskPixels=ec.createImageData(256,256);for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(inArm(x,y))maskPixels.data[(y*256+x)*4+3]=pixels.data[(y*256+x)*4+3];ec.putImageData(maskPixels,0,0);pc.globalCompositeOperation='destination-in';pc.drawImage(erasure,0,0);
  }
  const arms=def.arms.map((d,i)=>{const owns=(x,y)=>d.virtual?armMasks[i](x,y)&&!inHead(x,y):owners[y*256+x]===i;return {def:d,upper:slice((x,y)=>owns(x,y)&&y<d.joints[1][1]+3),lower:slice((x,y)=>owns(x,y)&&y>=d.joints[1][1]-3),limb:slice((x,y)=>owns(x,y)&&y<d.wrist[1]+2),hand:slice((x,y)=>owns(x,y)&&y>=d.wrist[1])};});
  const legs=def.legs.map(d=>{const belongs=(x,y)=>inLowerBody(x,y)&&(d.half==='left'?x<def.split[0]+(y-def.hem)*def.split[1]:x>=def.split[0]+(y-def.hem)*def.split[1]),shoeTop=x=>d.shoeTop[0]+(x-d.shoeTop[2])*d.shoeTop[1],r=d.kneeRadius,k=d.joints[1];return {def:d,scale:(d.joints[2][1]-def.hem+5)/gaitConfig.hipHeight,thigh:slice((x,y)=>belongs(x,y)&&y<k[1]+3),calf:slice((x,y)=>belongs(x,y)&&y>=k[1]-3&&y<shoeTop(x)+2),limb:slice((x,y)=>belongs(x,y)&&y<shoeTop(x)+2),shoe:slice((x,y)=>belongs(x,y)&&y>=shoeTop(x)),knee:slice((x,y)=>belongs(x,y)&&(x-k[0])**2+(y-k[1])**2<=r*r)};});
  const soles=legs.map(l=>paintedSole(l.shoe)),contact=paintedContact(def,soles,legs.map((l,i)=>Math.max(soles[i][0]-l.shoe.x,l.shoe.x+l.shoe.image.width-soles[i][0]))),view={def,source,head,torso,patch:trim(patch),bodyOutline:plate,arms,legs,contact};this.views.set(def.row,view);return view;
 }
 strideScale(row){const v=this.views.get(row)||this.prepare(authoredViews[row]);return v.contact.stride/gaitConfig.stride;}
 dispose(){const release=item=>{if(item instanceof HTMLCanvasElement)item.width=item.height=1;else if(item&&typeof item==='object')Object.values(item).forEach(release);};for(const v of this.views.values())release(v);this.views.clear();this.atlasImage=this.repairImage=null;}
}
