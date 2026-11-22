import {Float32BufferAttribute,PlaneGeometry} from 'three';

// The relaxed and curled paintings have the same wrist anchor. Corresponding
// horizontal sections give the material a single outline as the fingers turn.
function sections(ctx,column){
 const pixels=ctx.getImageData(column,0,32,56).data;
 const bounds=[];
 for(let y=0;y<56;y++){
  let left=32,right=-1;
  for(let x=0;x<32;x++)if(pixels[(y*32+x)*4+3]>12){
   left=Math.min(left,x);right=x;
  }
  if(right>=left)bounds.push({y,left,right});
 }
 if(!bounds.length)return null;
 return t=>{
  const y=bounds[0].y-1+t*(bounds.at(-1).y-bounds[0].y+3);
  const row=bounds.reduce((best,r)=>Math.abs(r.y+.5-y)<Math.abs(best.y+.5-y)?r:best);
  return [Math.max(0,row.left-1),Math.min(32,row.right+2),y];
 };
}

export function prepareSouthPalm(part,arm,atlas){
 const image=document.createElement('canvas');image.width=64;image.height=56;
 const ctx=image.getContext('2d'),[x,y]=arm.hand.atlas;
 ctx.drawImage(atlas,x,y+64,64,56,0,0,64,56);
 const loose=sections(ctx,0),curled=sections(ctx,32);
 if(!loose||!curled)return null;
 const geometry=new PlaneGeometry(1,1,2,24),uv=geometry.attributes.uv,otherUV=[];
 const openPoints=[],closedPoints=[];
 for(let i=0;i<uv.count;i++){
  const u=uv.getX(i),v=1-uv.getY(i),a=loose(v),b=curled(v);
  const ax=a[0]+u*(a[1]-a[0]),bx=b[0]+u*(b[1]-b[0]);
  openPoints.push([(ax-15.5)*.49,(a[2]-9)*.49]);
  closedPoints.push([(bx-15.5)*.49,(b[2]-9)*.49]);
  uv.setXY(i,ax/64,1-a[2]/56);
  otherUV.push((32+bx)/64,1-b[2]/56);
 }
 const ex=arm.wrist[0]-arm.elbow[0],ey=arm.wrist[1]-arm.elbow[1],norm=Math.hypot(ex,ey);
 part.source=openPoints.map(([across,along])=>[
  arm.wrist[0]+(ex*along-ey*across)/norm,
  arm.wrist[1]+(ey*along+ex*across)/norm
 ]);
 geometry.setAttribute('closedUV',new Float32BufferAttribute(otherUV,2));
 part.geometry.dispose();part.geometry=part.mesh.geometry=geometry;
 part.texture.image=image;part.texture.needsUpdate=true;
 const curl={value:0},material=part.material;
 material.uniforms.curl=curl;
 material.vertexShader=`varying vec2 p,q; attribute vec2 closedUV;
 void main(){p=uv;q=closedUV;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 material.fragmentShader=`uniform sampler2D map;uniform float curl; varying vec2 p,q;
 void main(){vec4 c=mix(texture2D(map,p),texture2D(map,q),curl);
 if(c.a<.001)discard;gl_FragColor=vec4(c.rgb/max(c.a,.00001),c.a);}`;
 return pose=>{
  const dx=pose.wrist[0]-pose.elbow[0],dy=pose.wrist[1]-pose.elbow[1];
  const k=pose.cuffLift;
  // Keep the relaxed hand soft at the wrist. At full flexion the knuckles
  // turn inward just short of the sleeve axis, as in the painted study.
  const angle=Math.atan2(dy,dx)+Math.sign(dx)*.17*k;
  const vx=Math.cos(angle),vy=Math.sin(angle);
  curl.value=k;
  const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
   const a=openPoints[i],b=closedPoints[i];
   const width=a[0]+(b[0]-a[0])*k,along=a[1]+(b[1]-a[1])*k;
   pos.setXYZ(i,pose.wrist[0]+vx*along-vy*width,pose.wrist[1]+vy*along+vx*width,0);
  }
  pos.needsUpdate=true;
 };
}
