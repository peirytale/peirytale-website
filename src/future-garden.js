import * as THREE from 'three';

// Illustrative evening garden; blank leaves make no product promise.
export function createFutureGarden(){
 const group=new THREE.Group(),staticGroup=new THREE.Group(),leaves=[];group.add(staticGroup);
 const paper=new THREE.MeshStandardMaterial({color:0xf4ead8,roughness:.98,side:THREE.DoubleSide});
 const edge=new THREE.MeshStandardMaterial({color:0xcbb6a0,roughness:.9});
 const gold=new THREE.MeshStandardMaterial({color:0xbfa16e,metalness:.35,roughness:.5});
 const light=new THREE.MeshBasicMaterial({color:0xffe2a9});
 const metal=new THREE.MeshStandardMaterial({color:0x8c8577,metalness:.5,roughness:.5});
 const put=(geo,mat,x,y,z,parent=staticGroup)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);parent.add(o);return o;};
 const veil=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){float d=length((vUv-vec2(.55,.55))*vec2(1.2,1.));float a=(1.-smoothstep(.1,.65,d))*.17;gl_FragColor=vec4(vec3(.96,.73,.55),a);}' });
 const wash=put(new THREE.PlaneGeometry(4.9,2.8),veil,2,-.08,-.65);wash.renderOrder=1;
 for(const x of [.45,3.95]){
  put(new THREE.CylinderGeometry(.012,.018,1.35,8),metal,x,-.92,.22);
  put(new THREE.CylinderGeometry(.14,.14,.035,16),gold,x,-.24,.25);
  put(new THREE.CylinderGeometry(.10,.11,.30,12),light,x,-.06,.25);
  put(new THREE.CylinderGeometry(.14,.14,.035,16),gold,x,.11,.25);
  put(new THREE.SphereGeometry(.025,10,8),gold,x,.16,.25);
 }
 for(let i=0;i<5;i++){
  const pivot=new THREE.Group();pivot.position.set(3.2,-1.2,.5+i*.02);group.add(pivot);
  put(new THREE.BoxGeometry(.65,1.15,.018),edge,0,.59,0,pivot);
  put(new THREE.PlaneGeometry(.61,1.1),paper,0,.6,.013,pivot);
  pivot.rotation.z=(i-2)*.15;leaves.push(pivot);
 }
 const star=new THREE.Shape();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?.035:.085,x=Math.cos(a)*r,y=Math.sin(a)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();
 for(const [x,y] of [[3.15,1.08],[3.55,1.34],[2.97,1.40]])put(new THREE.ShapeGeometry(star),gold,x,y,.13);
 return {group,staticGroup,leaves};
}
