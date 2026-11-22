// Shared anatomical gait, in character-source pixels. All eight authored views
// project these same left/right joints; neither turns nor retargets swap legs.
export const gaitConfig=Object.freeze({stride:92,stance:.36,hipHeight:31,bob:1,recovery:12,upperLeg:20,lowerLeg:18});
const tau=Math.PI*2;
export const wrapPhase=x=>x-Math.floor(x);
const ease=x=>x*x*x*(x*(x*6-15)+10);
export function advancePhase(phase,distance,height=230){
 return wrapPhase(phase+distance/(gaitConfig.stride*height/230));
}
export function footPose(phase){
 const q=wrapPhase(phase),{stride,stance,recovery}=gaitConfig,reach=stride*stance/2;
 if(q<stance)return {forward:reach-stride*q,height:0,shoeAngle:0,stance:true};
 const u=(q-stance)/(1-stance),tangent=-stride*(1-stance);
 // Match backward stance velocity at BOTH ends of recovery. Zero endpoint
 // accelerations avoid a velocity hitch at the loop or a frozen foot contact.
 const forward=-reach+tangent*u+(2*reach-tangent)*ease(u);
 const arc=16*u*u*(1-u)*(1-u);
 return {forward,height:recovery*arc,shoeAngle:55*arc,stance:false};
}
export function solveLeg(hip,ankle){
 const {upperLeg:a,lowerLeg:b}=gaitConfig,dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],raw=Math.hypot(dx,dy),d=Math.max(.001,Math.min(a+b-.00001,raw));
 const x=(a*a+d*d-b*b)/(2*d),h=Math.sqrt(Math.max(0,a*a-x*x)),nx=dx/raw,ny=dy/raw;
 return {hip,knee:[hip[0]+x*nx-h*ny,hip[1]+x*ny+h*nx],ankle,reach:raw};
}
export function gaitPose(phase){
 const q=wrapPhase(phase),hipHeight=gaitConfig.hipHeight-gaitConfig.bob*Math.cos(tau*2*(q-.1));
 const leg=offset=>{const foot=footPose(q+offset);return {...solveLeg([0,hipHeight],[foot.forward,foot.height]),foot};};
 const arm=offset=>{const c=Math.cos(tau*(q+offset)),upper=(-5-45*c)*Math.PI/180,flex=(80-15*c)*Math.PI/180,lower=upper+flex;return {upper,lower,flex,elbow:[25*Math.sin(upper),-25*Math.cos(upper)],hand:[25*Math.sin(upper)+27*Math.sin(lower),-25*Math.cos(upper)-27*Math.cos(lower)]};};
 return {phase:q,hipHeight,left:leg(0),right:leg(.5),leftArm:arm(0),rightArm:arm(.5)};
}
