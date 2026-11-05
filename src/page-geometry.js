import * as THREE from 'three';
import {closedInnerDepth,BACK_COVER_TRAVEL} from './cloth-case.js';
import {PAGE_WIDTH,PAGE_HEIGHT,PAPER_FORE_X,paperHingeX} from './book-dimensions.js';
export {PAGE_WIDTH,PAGE_HEIGHT} from './book-dimensions.js';
import {PAPER_SURFACE_Z,leftPagePoint,leftStackThickness} from './binding-kinematics.js';
export {leftStackThickness} from './binding-kinematics.js';
// Reading faces are planar and parallel to their boards. Their common profile
// is also the exact endpoint of every physical turning leaf.
export const paperHeight=()=>PAPER_SURFACE_Z;
const slope=()=>0;
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
// A developable cylinder rolls only the material beyond a diagonal tangent.
// Its arc length is q at every strength, including the exactly flat limit.
export function cornerCurl(s,y,strength){
 const nx=.9,ny=-Math.sqrt(1-nx*nx),reach=.95;
 const q=Math.max(0,reach-((PAGE_WIDTH-s)*nx+(y+PAGE_HEIGHT/2)*-ny));
 const angle=4.2*strength*q/reach;
 if(q===0||Math.abs(angle)<1e-8)return {s,y,height:0};
 const along=q*Math.sin(angle)/angle,qShift=along-q;
 return {s:s+nx*qShift,y:y+ny*qShift,height:q*(1-Math.cos(angle))/angle};
}
export function updateLeafGeometry(geometry,turn,side=1,lift=0,curl=0){
 const {thickness,block,segments,rows,count,rim,rimCount}=geometry.userData,profile=leafProfile(turn,segments),p=geometry.attributes.position;
 for(let y=0;y<=rows;y++)for(let x=0;x<=segments;x++){
  const u=x/segments,v=y/rows,s=u*PAGE_WIDTH,q=profile[x];
  let py=(v-.5)*PAGE_HEIGHT,px=q.x,pz=q.z+lift;
  if(curl>0&&!block){
   const c=cornerCurl(s,py,curl),sample=THREE.MathUtils.clamp(c.s/PAGE_WIDTH*segments,0,segments),i=Math.min(segments-1,Math.floor(sample)),t=sample-i;
   const a=THREE.MathUtils.lerp(profile[i].angle,profile[i+1].angle,t);
   px=THREE.MathUtils.lerp(profile[i].x,profile[i+1].x,t)-c.height*Math.sin(a);
   pz=THREE.MathUtils.lerp(profile[i].z,profile[i+1].z,t)+c.height*Math.cos(a)+lift;py=c.y;
  }
  const k=y*(segments+1)+x;
  for(let face=0;face<2;face++){
   const depth=face?-thickness:0;
   p.setXYZ(k+face*count,side*(px-(block?0:depth*Math.sin(q.angle))),py,block&&face?THREE.MathUtils.lerp(pz-.008,(geometry.userData.boundToRear?paperBlockBottomAt(s,geometry.userData.rearProgress||0):geometry.userData.bottom??-.235),geometry.userData.stack??1):pz+(block?0:depth*Math.cos(q.angle)));
  }
 }
 if(curl>0&&!block){
  // The diagonal roll has a Y normal too. Derive the verso from the actual
  // surface instead of an XZ-only offset, retaining a sealed thin shell.
  geometry.computeVertexNormals();const n=geometry.attributes.normal;
  for(let i=0;i<count;i++)p.setXYZ(i+count,p.getX(i)-n.getX(i)*thickness,p.getY(i)-n.getY(i)*thickness,p.getZ(i)-n.getZ(i)*thickness);
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

// Transform the complete sealed left shell by the same rigid frame as the board.
export const COVER_PAPER_FORE=PAPER_FORE_X;
export const paperBlockBottomAt=(s,p)=>closedInnerDepth(paperHingeX(p)+s-BACK_COVER_TRAVEL*p,false)+.025;
export function conformCoverEndpaper(geometry,progress,{thickness=geometry.userData.thickness??.008}={}){
 const amount=(thickness-.008)/.28,p=geometry.attributes.position,angle=Math.PI*(1-progress),c=Math.cos(angle),s=Math.sin(angle);
 for(let i=0;i<p.count;i++){const q=leftPagePoint(p.getX(i),p.getZ(i),progress,amount);p.setXYZ(i,q.x,p.getY(i),q.z);}
 const normal=geometry.attributes.normal;
 for(let i=0;i<normal.count;i++){const x=normal.getX(i),z=normal.getZ(i);normal.setXYZ(i,c*x+s*z,normal.getY(i),-s*x+c*z);}
 p.needsUpdate=normal.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
