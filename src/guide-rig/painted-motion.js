import {footPose,gaitConfig} from './gait.js';
import {rigidPoint} from './deform.js';
const maximumForward=Math.max(...Array.from({length:1025},(_,i)=>Math.abs(footPose(i/1024).forward)))+.001;
export function paintedContact(def,soles,shoeRadii=soles.map(()=>15)){
 const angle=def.row*Math.PI/4,direction=[Math.cos(angle),Math.sin(angle)],length=soles.reduce((sum,p)=>sum+p[1]-def.hem,0)/soles.length;
 return {soles,shoeRadii,direction,stride:length*Math.hypot(2.1*direction[0],1.2*direction[1])};
}
// One rigid transform per painted limb. Sleeves/hands and calves/shoes share
// it, so animation cannot alter their outline, width or joint proportions.
export function paintedLimbMotion(def,side,phase,weight=1,kind='leg',contact){
 const q=phase+side*.5,c=Math.cos(Math.PI*2*q),[fx,fy]=def.projection;
 if(kind==='arm'){
  const arm=def.arms[side],pivot=arm.joints[0],outward=Math.sign(pivot[0]-(def.patch[0]+def.patch[2]/2))||1;
  return {pivot,rotation:fx*(.28*c+.08)*weight,translation:[(outward*Math.abs(fy)*1.6*c+(arm.virtual?-3:0))*weight,-Math.abs(fy)*3*Math.max(0,-c)**2*weight]};
 }
 const leg=def.legs[side],foot=footPose(q),pivot=leg.joints[0],rotation=-fx*.50*Math.tanh(foot.forward/23)*weight,sole=contact.soles[side],ankle=leg.joints[2],shoeRotation=-fx*.12*foot.shoeAngle/55*weight,scale=contact.stride/gaitConfig.stride,[dx,dy]=contact.direction;
 // The clock and painted sole share the same physical stride. Translation
 // represents the hidden thigh's movement under the skirt, never a stretch.
 const targetSole=[sole[0]+dx*foot.forward*scale*weight,sole[1]+(dy*foot.forward*scale-Math.abs(dy)*maximumForward*scale-foot.height*(.28+.48*Math.abs(fy)))*weight-contact.shoeRadii[side]*Math.abs(Math.sin(shoeRotation))],shoeOffset=rigidPoint(sole,ankle,[0,0],shoeRotation),targetAnkle=targetSole.map((n,i)=>n-shoeOffset[i]),rotatedAnkle=rigidPoint(ankle,pivot,pivot,rotation);
 // The original shoe stays flat throughout contact. Its small recovery roll
 // flexes at the same ankle as the rigid calf, with no shape deformation.
 return {pivot,rotation,translation:targetAnkle.map((n,i)=>n-rotatedAnkle[i]),shoe:{pivot:ankle,rotation:shoeRotation,translation:targetAnkle.map((n,i)=>n-ankle[i])}};
}
