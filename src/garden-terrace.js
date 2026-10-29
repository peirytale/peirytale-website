import * as THREE from 'three';

// Illustrative garden furniture, kept separate from the real work photographs.
export function createTerrace(){
 const group=new THREE.Group();
 const paint=new THREE.MeshStandardMaterial({color:0xc6d4cf,roughness:.83});
 const stone=new THREE.MeshStandardMaterial({color:0xe3d6bc,roughness:.95});
 const green=new THREE.MeshStandardMaterial({color:0x8fa57d,roughness:.9});
 const flower=new THREE.MeshStandardMaterial({color:0xd7a8bd,roughness:.8});
 const put=(g,m,x,y,z)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
 const box=(w,h,d,m,x,y,z)=>put(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 // A pergola behind the worktable preserves the garden setting across chapters.
 for(const x of [.45,3.95]){
  box(.11,2.8,.12,paint,x,-.24,-.21);
  box(.23,.12,.24,stone,x,-1.60,-.21);
  for(const y of [-.95,.15,1.02])box(.18,.045,.18,paint,x,y,-.21);
 }
 box(3.85,.13,.18,paint,2.2,1.2,-.21);
 for(let i=0;i<9;i++)box(.06,.08,.78,paint,.35+i*.46,1.3,-.21);
 // Climbing leaves stay outside the photo, leaving its full area readable.
 for(const side of [-1,1])for(let i=0;i<11;i++){
  const x=side<0?.45:3.95,y=-1.35+i*.23;
  const leaf=put(new THREE.SphereGeometry(.09,10,7),green,x+Math.sin(i*1.7)*.1,y,-.1);leaf.scale.set(1.2,.5,.35);leaf.rotation.z=side*(i%2?.5:-.5);
  if(i%3===0)for(let j=0;j<5;j++){const a=j*Math.PI*2/5;const p=put(new THREE.SphereGeometry(.038,8,6),flower,x+.045*Math.cos(a),y+.045*Math.sin(a),-.02);p.scale.z=.4;}
 }
 // A low stone garden wall gives the display a grounded edge.
 for(const side of [-1,1]){
  const x=2.2+side*1.55;box(.72,.32,.26,stone,x,-1.46,-.05);box(.78,.05,.31,paint,x,-1.275,-.05);
  for(let i=0;i<4;i++){
   const bush=put(new THREE.SphereGeometry(.13,12,8),green,x-.24+i*.16,-1.18,-.08);bush.scale.y=.65;
  }
 }
 return group;
}
