import * as THREE from 'three';
import {frontEndpaperPoint,closedInnerDepth,BACK_COVER_TRAVEL} from './cloth-case.js';
export const PAGE_WIDTH=3.98,PAGE_HEIGHT=5.5;
export const paperHeight=s=>-.018+.145*(1-Math.exp(-s/.28))+.035*Math.sin(Math.PI*s/PAGE_WIDTH)+.030*Math.exp(-s/.13)+.05*Math.exp(-Math.pow((s-.28)/.19,2));
const slope=s=>.145/.28*Math.exp(-s/.28)+.035*Math.PI/PAGE_WIDTH*Math.cos(Math.PI*s/PAGE_WIDTH)-.030/.13*Math.exp(-s/.13)-.10*(s-.28)/(.19*.19)*Math.exp(-Math.pow((s-.28)/.19,2));
// Integrate the tangent along the paper, preserving its arc length. At both
// ends of the turn the sheet matches the bound surface exactly. No crossfade,
// screen capture or disconnected corner plane participates in a page turn.
export function leafProfile(turn,segments=88){
 const points=[{x:0,z:paperHeight(0),angle:Math.PI*turn+Math.atan(slope(0))*Math.cos(Math.PI*turn)}];
 const ds=PAGE_WIDTH/segments,a=Math.PI*turn;
 for(let i=1;i<=segments;i++){
  const s=(i-.5)*ds,gradient=slope(s);
  const angle=a+Math.atan(gradient)*Math.cos(a)+Math.sin(a)*(.72*s/PAGE_WIDTH-.40);
  const length=ds*Math.sqrt(1+gradient*gradient),last=points[i-1];
  points.push({x:last.x+length*Math.cos(angle),z:last.z+length*Math.sin(angle),angle});
 }
 // Exact endpoint agreement prevents even a subpixel jump at handoff.
 if(turn===0||turn===1)for(let i=0;i<=segments;i++){
  points[i]={x:(turn===0?1:-1)*i*ds,z:paperHeight(i*ds),angle:turn===0?Math.atan(slope(i*ds)):Math.PI-Math.atan(slope(i*ds))};
 }
 return points;
}
export function createLeafGeometry({thickness=.006,block=false,segments=88,rows=20}={}){
 const count=(segments+1)*(rows+1),rimCount=2*(segments+rows),total=count*2+rimCount*2,positions=new Float32Array(total*3),uvs=new Float32Array(total*2*2),indices=[];
 for(let face=0;face<2;face++)for(let y=0;y<=rows;y++)for(let x=0;x<=segments;x++){
  const k=face*count+y*(segments+1)+x;
  uvs[k*2]=face?1-x/segments:x/segments;uvs[k*2+1]=y/rows;
 }
 for(let face=0;face<2;face++){
  const start=indices.length;
  for(let y=0;y<rows;y++)for(let x=0;x<segments;x++){
   const a=face*count+y*(segments+1)+x,b=a+1,c=a+segments+1,d=c+1;
   if(face)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
  }
  // Front and verso are separate materials, on the same sealed geometry.
  // Face indices stay stable as the sheet crosses vertical.
  if(!face)var frontCount=indices.length-start;
 }
 const edgeStart=indices.length;
 const rim=[];
 for(let x=0;x<=segments;x++)rim.push(x);
 for(let y=1;y<=rows;y++)rim.push(y*(segments+1)+segments);
 for(let x=segments-1;x>=0;x--)rim.push(rows*(segments+1)+x);
 for(let y=rows-1;y>0;y--)rim.push(y*(segments+1));
 for(let i=0;i<rim.length;i++){const a=count*2+i,b=count*2+(i+1)%rim.length;indices.push(a,a+rimCount,b,b,a+rimCount,b+rimCount);}
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(indices);
 geometry.addGroup(0,frontCount,0);geometry.addGroup(frontCount,frontCount,1);geometry.addGroup(edgeStart,indices.length-edgeStart,2);
 geometry.userData={thickness,block,segments,rows,count,rim,rimCount};updateLeafGeometry(geometry,0);return geometry;
}
export function updateLeafGeometry(geometry,turn,side=1,lift=0){
 const {thickness,block,segments,rows,count,rim,rimCount}=geometry.userData,profile=leafProfile(turn,segments),p=geometry.attributes.position;
 for(let y=0;y<=rows;y++)for(let x=0;x<=segments;x++){
  const u=x/segments,v=y/rows,s=u*PAGE_WIDTH,q=profile[x];
  const py=(v-.5)*PAGE_HEIGHT,px=q.x,pz=q.z+lift;
  const k=y*(segments+1)+x;
  for(let face=0;face<2;face++){
   const depth=face?-thickness:0;
   p.setXYZ(k+face*count,side*(px-(block?0:depth*Math.sin(q.angle))),py,block&&face?THREE.MathUtils.lerp(pz-.008,(geometry.userData.boundToRear?paperBlockBottomAt(s,geometry.userData.rearProgress||0):geometry.userData.bottom??-.235),geometry.userData.stack??1):pz+(block?0:depth*Math.cos(q.angle)));
  }
 }
 for(let face=0;face<2;face++)for(let i=0;i<rim.length;i++){const from=rim[i]+face*count,to=count*2+face*rimCount+i;p.setXYZ(to,p.getX(from),p.getY(from),p.getZ(from));}
 p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();
 // Reflecting a left block also reflects its normals; reverse the winding
 // once, so both blocks remain opaque with ordinary depth testing.
 if(geometry.userData.side!==side){
  if(geometry.userData.side!==undefined||side<0){const ix=geometry.index.array;for(let i=0;i<ix.length;i+=3){const v=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=v;}geometry.index.needsUpdate=true;geometry.computeVertexNormals();}
  geometry.userData.side=side;
 }
}

// One thin endpaper, attached to the board over its broad face and folded
// continuously into the signature at the gutter. Rebuild the verso from
// surface normals so the thin shell cannot collapse where that fold turns.
export const leftStackThickness=amount=>.008+.28*amount;
export const leftCoverLift=amount=>THREE.MathUtils.lerp(.29,.365-.28*amount,THREE.MathUtils.smoothstep(amount,0,.05));
// A fixed inset on a rigid board keeps the exposed cloth margin continuous.
export const COVER_PAPER_FORE=1.88;
export const paperBlockBottomAt=(s,p)=>closedInnerDepth(-1.98+s-(BACK_COVER_TRAVEL-1.98)*p,false)+.025;
export function leftCoverTilt(amount){
 const q=frontEndpaperPoint(COVER_PAPER_FORE,0,0,-(leftStackThickness(amount)-.008));
 const x=q.x+2.04,z=q.y+.05;
 return Math.atan2(z,x)+Math.asin((paperHeight(PAGE_WIDTH)+.05-leftCoverLift(amount))/Math.hypot(x,z));
}
export function conformCoverEndpaper(geometry,progress,{thickness=.008,coverLift=.29*progress,coverTilt=leftCoverTilt((thickness-.008)/.28),rootLift=0}={}){
 const p=progress,position=geometry.attributes.position,{count,rim,rimCount}=geometry.userData;
 const hinge=-1.98+1.98*p,angle=Math.PI*(1-p),c=Math.cos(angle),s=Math.sin(angle),relax=THREE.MathUtils.smoothstep(p,.78,1);
 for(let i=0;i<count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i),attached=frontEndpaperPoint(COVER_PAPER_FORE-PAGE_WIDTH-x,p,coverLift,-(thickness-.008),coverTilt);
  const settle=relax*(1-THREE.MathUtils.smoothstep(-x,PAGE_WIDTH-.35,PAGE_WIDTH));
  const readingX=hinge+x*c+z*s,readingZ=.20*(1-p)-x*s+z*c,pin=1-THREE.MathUtils.smoothstep(-x,0,.32);
  position.setXYZ(i,THREE.MathUtils.lerp(THREE.MathUtils.lerp(attached.x,readingX,settle),hinge,pin),y,THREE.MathUtils.lerp(THREE.MathUtils.lerp(attached.y,readingZ,settle),paperHeight(0)+rootLift,pin)+(-x<.32?.08*Math.sin(Math.PI*(-x)/.32)*Math.sin(Math.PI*p):0));
 }
 geometry.computeVertexNormals();const normal=geometry.attributes.normal;
 for(let i=0;i<count;i++)position.setXYZ(i+count,position.getX(i)-normal.getX(i)*thickness,position.getY(i)-normal.getY(i)*thickness,position.getZ(i)-normal.getZ(i)*thickness);
 for(let face=0;face<2;face++)for(let i=0;i<rim.length;i++){const from=rim[i]+face*count,to=count*2+face*rimCount+i;position.setXYZ(to,position.getX(from),position.getY(from),position.getZ(from));}
 position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
