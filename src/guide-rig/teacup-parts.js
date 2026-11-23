// The dress is painted in the uniform rig's native coordinates. Only the
// original head and palms are trimmed at the old collar and cuffs.
export function prepareTeacupParts(rig,view,image){
 const row=view.record.row;
 const crop=(ax,ay,w,h,x,y)=>{
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  canvas.getContext('2d').drawImage(image,ax,ay,w,h,0,0,w,h);
  return {image:canvas,x,y};
 };
 const meshes=[];
 const add=(part,connected=false)=>{
  const layer=rig.makePart(part,connected);
  view.original.group.add(layer.mesh);
  view.original.meshes.push(layer);
  meshes.push(layer);
  return layer;
 };
 const bodyPart=crop(0,row*256,256,256,0,0);
 const body=add(bodyPart);
 const head=add(crop(448,row*256,256,216,0,0));
 const shoes=view.record.legs.map(({shoe},side)=>{
  const [x,y,w,h]=shoe.source;
  return add(crop(448+64*side,row*256+216,w,h,x,y));
 });
 const arms=view.record.arms.map((arm,side)=>{
  const x=Math.floor(arm.shoulder[0])-48,y=Math.floor(arm.shoulder[1])-20;
  const layer=k=>crop(256+96*side,row*256+108*k,96,108,x,y);
  const puff=layer(0),bare=layer(1);
  if(row===2)return {...view.arms[side],sleeve:add(puff,true),forearm:add(bare,true)};
  const [hx,hy,hw,hh]=arm.hand.source;
  const hand=add(crop(256+96*side,row*256+216,hw,hh,hx,hy));
  bare.image.getContext('2d').drawImage(puff.image,0,0);
  return {hand,sleeve:add(bare,true)};
 });
 let sideCover;
 if(view.sideCover){
  sideCover=add(bodyPart);
  sideCover.material.fragmentShader=view.sideCover.material.fragmentShader;
  sideCover.material.uniforms.aft={value:[0,0]};
 }
 return {body,head,arms,shoes,sideCover,meshes};
}
