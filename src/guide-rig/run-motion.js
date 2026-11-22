import {footPose,gaitConfig} from './gait.js';
import {landmarks} from './proportions.js';
import {rigidPoint} from './deform.js';
const depth=.55,vertical=Math.sqrt(1-depth*depth),tau=Math.PI*2;
const sub=(a,b)=>a.map((n,i)=>n-b[i]),add=(a,b)=>a.map((n,i)=>n+b[i]),mul=(a,s)=>a.map(n=>n*s),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),length=a=>Math.hypot(...a),mix=(a,b,w)=>a.map((n,i)=>n+(b[i]-n)*w);
export function runProjection(row){const angle=row*Math.PI/4,heading=Math.atan2(Math.sin(angle)/depth,Math.cos(angle)),c=Math.cos(heading),s=Math.sin(heading);return {c,s,ground:Math.hypot(c,depth*s),project:([f,l,v])=>[c*f-s*l,depth*(s*f+c*l)-vertical*v],unproject:([x,y])=>[c*x,-s*x,-y/vertical]};}
export function runContact(record){
 const projection=runProjection(record.row),legs=record.legs.map(l=>{const a=length(projection.unproject(sub(l.knee,l.hip))),b=length(projection.unproject(sub(l.ankle,l.knee)));return {a,b};}),physicalStride=legs.reduce((n,l)=>n+l.a+l.b,0)/2*1.28;
 const contact={projection,legs,physicalStride,stride:physicalStride*projection.ground,soles:record.legs.map(l=>l.sole)};
 // Calibrate once for each painted view, including asymmetric source heels.
 // Reach stays below knee lock; travel uses this exact resulting stride.
 for(let attempt=0;attempt<12;attempt++){
  let reach=0;for(let i=0;i<128;i++)for(const l of runPose(record,i/128,1,contact).legs)reach=Math.max(reach,l.reach);
  if(reach<=.975)break;contact.physicalStride*=.96;contact.stride=contact.physicalStride*projection.ground;
 }
 return contact;
}
export function solveRunLeg(target,a,b){
 const raw=length(target),d=Math.max(.0001,Math.min(a+b-.001,raw)),n=mul(target,1/raw),pole=sub([1,0,0],mul(n,n[0])),poleLength=length(pole),p=mul(pole,1/poleLength),x=(a*a+d*d-b*b)/(2*d),h=Math.sqrt(Math.max(0,a*a-x*x));
 return {knee:add(mul(n,x),mul(p,h)),reach:raw/(a+b),poleLength};
}
// Measured against the frontal pose sheet: at the forward contact the
// wrist curls above the elbow; the opposite palm trails beside the hip.
function southArm(arm,side,phase,bodyY,weight){
 const outside=side===0?1:-1,angle=tau*(phase+side*.5-.43);
 const lead=Math.cos(angle+.18),follow=Math.cos(angle-.10),passing=Math.sin(angle-.10);
 // Delay the lift until the hand has cleared the outside hip. The return
 // passes slightly lower, tracing an oval instead of reversing on one line.
 const reach=((1+follow)/2)**1.35;
 const upper=length(sub(arm.elbow,arm.shoulder)),lower=length(sub(arm.wrist,arm.elbow));
 const relaxed=1-weight;
 const shoulder=add(arm.shoulder,[-outside*.85*lead*weight,bodyY-1.4*lead*weight]);
 // In the nine-frame front study the trailing elbow stays between
 // the shoulder and the cuff. Only the forward arm folds towards the lapel.
 const trail=Math.max(0,1-reach/.32);
 const elbow=add(shoulder,mix(sub(arm.elbow,arm.shoulder),
  [outside*(10.5-2.5*lead-4.2*trail*trail),upper*(.82+.16*lead)],weight));
 const handHeight=upper*(.83+.15*lead)+lower*(.77-1.24*reach)+2.3*passing;
 const wrist=add(shoulder,mix(sub(arm.wrist,arm.shoulder),
  [outside*(10.1-10.5*reach-2.3*passing),handHeight],weight*(1+.12*relaxed)));
 const native=sub(arm.wrist,arm.elbow),forearm=sub(wrist,elbow);
 const handAngle=Math.atan2(native[0]*forearm[1]-native[1]*forearm[0],dot(native,forearm));
 return {shoulder,elbow,wrist,handAngle,cuffLift:weight*reach,aft:relaxed+weight*(1-reach)**1.6,flex:weight*(.5+1.4*reach)};
}
// The front diagonals project the forearm across the jacket.
function frontArm(arm, side, feet, projection, bodyY, weight) {
 const shoulder=add(arm.shoulder,[0,bodyY]);
 const upper=length(sub(arm.elbow,arm.shoulder)),lower=length(sub(arm.wrist,arm.elbow));
 const swing=(feet[1-side].foot.forward-feet[side].foot.forward)/(.48*gaitConfig.stride);
 const bend=.45*weight;
 // The character is painted nearly at eye level. The depth of a hand
 // reads mostly as foreshortening, with only a small vertical offset.
 const depthDrop=.12*projection.s;
 const upperAngle=.33*swing*weight-bend,lowerAngle=.88*swing*weight+bend;
 const reach=upper*Math.sin(upperAngle),handReach=reach+lower*Math.sin(lowerAngle);
 const outside=side===0?1:-1;
 // As the forward hand passes the jacket it comes slightly toward the
 // midline. Releasing the swing returns both wrists beneath their shoulders.
 const cross=outside*Math.max(0,swing)*weight;
 const elbow=add(shoulder,[outside*1.8+projection.c*reach-cross*1.5,
  upper*Math.cos(upperAngle)+depthDrop*reach]);
 const wrist=add(shoulder,[outside*1.3+projection.c*handReach-cross*(2+5*projection.s**4),
  upper*Math.cos(upperAngle)+lower*Math.cos(lowerAngle)+depthDrop*handReach]);
 const painted=sub(arm.wrist,arm.elbow),rotated=sub(wrist,elbow);
 return {shoulder,elbow,wrist,handAngle:Math.atan2(painted[0]*rotated[1]-painted[1]*rotated[0],dot(painted,rotated)),flex:lowerAngle-upperAngle};
}
export function runPose(record,phase,weight=1,contact=runContact(record),strideMultiplier=1){
 const {projection:p,physicalStride}=contact;
 const legHeight=record.legs.reduce((sum,leg)=>sum+leg.ankle[1]-leg.hip[1],0)/2;
 // A slightly lower hip keeps the longer workshop stride inside knee reach.
 const compression=legHeight*(.16+.15*(strideMultiplier-1));
 const bodyY=(compression+2.5*Math.cos(tau*2*(phase-.14)))*weight;
 const hem=landmarks[record.row][2];
 const centerX=(record.legs[0].hip[0]+record.legs[1].hip[0])/2;
 const legs=record.legs.map((l,side)=>{
  const foot=footPose(phase+side*.5),forward=foot.forward*physicalStride*strideMultiplier/gaitConfig.stride;
  const recovery=foot.height/gaitConfig.recovery;
  const trailing=Math.max(0,-foot.forward/(gaitConfig.stride*.24));
  const shoeAngle=p.c*recovery*(.16+.46*trailing)*weight;
  const hip=add(l.hip,[0,bodyY]);
  const groundY=l.ankle[1]+depth*p.s*forward*weight;
  // Guide the airborne foot through the opening of the narrow painted
  // skirt. Sole contact and horizontal travel stay exact during stance.
  const lift=legHeight*(.28+.26*trailing)*recovery*weight;
  const clearance=Math.max(1,groundY-hem-bodyY-3);
  const ankle=[l.ankle[0]+p.c*forward*weight,
               groundY-clearance*Math.tanh(lift/clearance)];
  const tuck=(.18+.22*Math.abs(2*p.c*p.s))*recovery*weight;
  ankle[0]+=(centerX-ankle[0])*tuck;
  // Lateral position and neutral depth come from the painted source view.
  // Forward ground travel and vertical lift share this single projection.
  const rest=p.unproject(sub(l.ankle,l.hip)),shoeDx=ankle[0]-l.ankle[0]-p.c*forward*weight,target=[rest[0]+forward*weight+p.c*shoeDx,rest[1]-p.s*shoeDx,0];target[2]=(depth*(p.s*target[0]+p.c*target[1])-(ankle[1]-hip[1]))/vertical;
  const solution=solveRunLeg(target,contact.legs[side].a,contact.legs[side].b);
  const nativeLean=Math.atan2(l.hip[0]-l.ankle[0],l.ankle[1]-l.hip[1]);
  const aim=Math.atan2(hip[0]-ankle[0],ankle[1]-hip[1])-nativeLean;
  const calfAngle=.75*Math.tanh(aim/.75);
  const knee=rigidPoint(l.knee,l.ankle,ankle,calfAngle);
  return {hip,knee,ankle,calfAngle,sole:rigidPoint(l.sole,l.ankle,ankle,shoeAngle),shoeAngle,foot,reach:solution.reach,poleLength:solution.poleLength};
 });
 const arms=record.arms.map((a,side)=>{
  if(record.row===2)return southArm(a,side,phase,bodyY,weight);
  if(record.row===1||record.row===3)return frontArm(a,side,legs,p,bodyY,weight);
  const t=tau*(phase+side*.5);
  const depthView=Math.abs(p.s);
  // The elbow leads. The fist follows through slightly later and stays
  // below the shoulder as it recedes in the frontal projections.
  const upper=-.26-.68*Math.cos(t);
  const flex=1.34-.38*depthView-.10*Math.cos(t-.48);
  const lower=upper+flex;
  const nativeSide=[[1],[1],[0,1],[0],[0],[0],[0,1],[1]][record.row].includes(side);
  const center=record.legs.reduce((n,l)=>n+l.hip[0],0)/2,inset=nativeSide?0:Math.max(-8,Math.min(8,(center-a.shoulder[0])*.22)),drop=nativeSide?0:2,attachment=add(a.shoulder,[inset,drop]),restUpper=p.unproject(sub(a.elbow,attachment)),restLower=p.unproject(sub(a.wrist,a.elbow)),A=Math.hypot(restUpper[0],restUpper[2]),B=Math.hypot(restLower[0],restLower[2]);
  // Keep the authored lateral elbow/wrist offsets. Replacing them with a
  // tiny generic spread pulled both back-view arms inside the opaque torso.
  const elbow3=[A*Math.sin(upper),restUpper[1],-A*Math.cos(upper)],wrist3=add(elbow3,[B*Math.sin(lower),restLower[1],-B*Math.cos(lower)]),shoulder=add(a.shoulder,[inset*weight,bodyY+drop*weight]);
  const sideElbow=p.project(elbow3),sideWrist=p.project(wrist3);
  // In a depth view the forearm goes away from the camera. Draw its
  // shortened length down the outside of the jacket instead of letting
  // the wrist project above the elbow and emerge from the shoulder.
  const swing=Math.cos(t-.25),towardCamera=p.s*swing;
  const upperDrop=a.elbow[1]-a.shoulder[1],lowerDrop=a.wrist[1]-a.elbow[1];
  const north=record.row===6;
  const depthElbow=[a.elbow[0]-attachment[0],upperDrop*(north ? .83-.21*towardCamera : .91-.09*towardCamera)];
  const inward=Math.sign(center-a.wrist[0])*(1+towardCamera)*2;
  const depthWrist=[a.wrist[0]-attachment[0]+inward,depthElbow[1]+lowerDrop*(north ? .60-.46*towardCamera : .62-.32*towardCamera)];
  const blend=depthView**7;
  const elbowOffset=mix(sideElbow,depthElbow,blend);
  const wristOffset=mix(sideWrist,depthWrist,blend);
  if(nativeSide&&(record.row===5||record.row===7)){
   // Follow the opposite foot through both extremes. A shoulder-relative
   // arc lets the near wrist pass behind the hip even in a shallow view.
   const counter=(legs[1-side].foot.forward-legs[side].foot.forward)/(.48*gaitConfig.stride);
   const heading=Math.sign(p.c);
   elbowOffset[0]=heading*(1.5+8.5*counter);
   wristOffset[0]=heading*(1.5+16*counter);
  }
  let idleElbow=sub(a.elbow,a.shoulder),idleWrist=sub(a.wrist,a.shoulder);
  if(record.row>=5){
   // The three rear studies settle with hands at the side seams. The
   // back view needs space around the hips; the diagonals compress it.
   const forearm=sub(a.wrist,a.elbow);
   const lowered=(segment,x)=>[x,Math.sqrt(dot(segment,segment)-x*x)];
   const forearmX=forearm[0]*.24;
   // From directly behind, the elbow clears the jacket and the forearm
   // drops at the hip. In the diagonal projection both bones hang close.
   const elbowX=north ? idleWrist[0]-forearmX : idleElbow[0]*.22;
   idleElbow=lowered(idleElbow,elbowX);
   idleWrist=add(idleElbow,lowered(forearm,forearmX));
  }
  if(record.row===4){
   // The visible W shoulder sits over the hip. Settle both sleeves on that
   // plumb line, with the far sleeve concealed behind the jacket.
   const tucked=(record.arms[0].shoulder[0]-a.shoulder[0])*(1-weight);
   shoulder[0]+=tucked;
   idleElbow=[0,length(idleElbow)];
   idleWrist=[0,idleElbow[1]+length(sub(a.wrist,a.elbow))];
  }
  const armWeight=record.row>=5 ? weight*weight*(2-weight) : weight;
  const elbow=add(shoulder,mix(idleElbow,elbowOffset,armWeight));
  const wrist=add(shoulder,mix(idleWrist,wristOffset,armWeight));
  const axis=sub(a.wrist,a.elbow),tangent=sub(wrist,elbow);
  const turn=Math.atan2(axis[0]*tangent[1]-axis[1]*tangent[0],dot(axis,tangent));
  const confidence=Math.min(1,length(tangent)/9);
  const handAngle=Math.max(-1.68,Math.min(1.68,turn))*confidence;
  return {shoulder,elbow,wrist,handAngle,flex:flex*weight};
 });
 return {bodyY,legs,arms};
}
// Affine painted-bone transform: longitudinal projection follows the skeleton;
// transverse pigment width is retained. Shoes, hands and round caps are rigid.
export function bonePoint(point,from,to,targetFrom,targetTo){
 const d=sub(to,from),n=length(d),u=mul(d,1/n),v=sub(point,from),along=dot(v,u),across=-v[0]*u[1]+v[1]*u[0],t=sub(targetTo,targetFrom),tn=length(t),tu=mul(t,1/tn);
 return [targetFrom[0]+t[0]*along/n-tu[1]*across,targetFrom[1]+t[1]*along/n+tu[0]*across];
}
// A painted sleeve can fold over itself in the front projection. Each
// segment keeps round end caps and a rigid cuff while its middle foreshortens.
export function projectedSleeve(from,to,start,end){
 const axis=sub(to,from),paintLength=length(axis),u=mul(axis,1/paintLength);
 const projected=sub(end,start),span=length(projected),v=mul(projected,1/span);
 const rim=Math.min(4,span*.27),middle=(span-2*rim)/(paintLength-2*rim);
 return point=>{
  const delta=sub(point,from),along=dot(delta,u),across=u[0]*delta[1]-u[1]*delta[0];
  const x=along<=rim?along:along>=paintLength-rim?span+along-paintLength:rim+(along-rim)*middle;
  return [start[0]+x*v[0]-across*v[1],start[1]+x*v[1]+across*v[0]];
 };
}
export function curvedLimbPoint(point,source,target,sideProjection){
 const vectors=[sub(source[1],source[0]),sub(source[2],source[1])],lengths=vectors.map(length),total=lengths[0]+lengths[1],joint=lengths[0]/total;
 let distance=Infinity,best;
 for(let i=0;i<2;i++){
  const u=mul(vectors[i],1/lengths[i]),v=sub(point,source[i]),along=dot(v,u),bounded=Math.max(0,Math.min(lengths[i],along)),closest=add(source[i],mul(u,bounded)),d=length(sub(point,closest));
  if(d<distance){distance=d;best={t:(i?lengths[0]:0)+along,across:-v[0]*u[1]+v[1]*u[0],normal:[-u[1],u[0]]};}
 }
 const t=best.t/total,root=add(point,sub(target[0],source[0]));if(t<=0)return root;
 const band=.18,a=joint-band,b=joint+band,upper=mul(sub(target[1],target[0]),1/joint),lower=mul(sub(target[2],target[1]),1/(1-joint));let center,tangent;
 if(t<=a){center=add(target[0],mul(upper,t));tangent=upper;}
 else if(t>=b){center=add(target[1],mul(lower,t-joint));tangent=lower;}
 else{
  const span=b-a,u=(t-a)/span,u2=u*u,u3=u2*u,A=add(target[0],mul(upper,a)),B=add(target[1],mul(lower,b-joint));
  center=A.map((n,i)=>(2*u3-3*u2+1)*n+(u3-2*u2+u)*span*upper[i]+(-2*u3+3*u2)*B[i]+(u3-u2)*span*lower[i]);
  tangent=A.map((n,i)=>((6*u2-6*u)*n+(3*u2-4*u+1)*span*upper[i]+(-6*u2+6*u)*B[i]+(3*u2-2*u)*span*lower[i])/span);
 }
 const n=length(tangent),normal=n>.0001?[-tangent[1]/n,tangent[0]/n]:best.normal,w=sideProjection**2,cross=mix(best.normal,normal,w),norm=length(cross),width=norm>.1?mul(cross,1/norm):best.normal;
 const result=add(center,mul(width,best.across)),attach=Math.min(1,t/.12),blend=attach*attach*(3-2*attach);return mix(root,result,blend);
}

// Preserve the painted calf profile. The ankle turns gently into the rigid
// shoe opening and the concealed thigh joins the moving leg to its hip.
export function paintedLegPoint(point, rest, pose) {
 const ankleBand=Math.min(1,Math.max(0,(rest.ankle[1]-3-point[1])/14));
 const rotate=pose.shoeAngle+(pose.calfAngle-pose.shoeAngle)*ankleBand*ankleBand*(3-2*ankleBand);
 const moving=rigidPoint(point,rest.ankle,pose.ankle,rotate);
 const span=rest.knee[1]-rest.hip[1];
 const t=Math.min(1,Math.max(0,(point[1]-rest.hip[1])/span));
 if(t===1)return moving;
 const attachment=point.map((v,i)=>v+pose.hip[i]-rest.hip[i]);
 const blend=t*t*t*(t*(t*6-15)+10);
 return moving.map((v,i)=>attachment[i]+(v-attachment[i])*blend);
}

// Transport transverse sections along a continuous shoulder-to-cuff curve.
// The section rotates with its tangent, so a projecting forearm retains its
// painted diameter. The terminal strip follows exactly the palm rotation.
export function diagonalSleeve(rest,pose){
 const a=rest.shoulder,b=rest.wrist,axis=sub(b,a);
 const angle=Math.atan2(axis[1],axis[0]),joinY=b[1]-4;
 const joinX=b[0]-4*axis[0]/axis[1],tip=rigidPoint([joinX,joinY],b,pose.wrist,pose.handAngle);
 const root=pose.shoulder;
 const upper=sub(pose.elbow,root),nativeUpper=sub(rest.elbow,a);
 const startAngle=angle+Math.atan2(upper[1],upper[0])-Math.atan2(nativeUpper[1],nativeUpper[0]);
 const endAngle=angle+pose.handAngle,handle=length(sub(tip,root))/3;
 const control1=add(root,[handle*Math.cos(startAngle),handle*Math.sin(startAngle)]);
 const control2=sub(tip,[handle*Math.cos(endAngle),handle*Math.sin(endAngle)]);
 const centerAt=(t,u)=>root.map((n,i)=>u*u*u*n+3*u*u*t*control1[i]+3*u*t*t*control2[i]+t*t*t*tip[i]);
 return point=>{
  if(point[1]>=joinY)return rigidPoint(point,b,pose.wrist,pose.handAngle);
  if(point[1]<=a[1])return rigidPoint(point,a,root,startAngle-angle);
  const t=(point[1]-a[1])/(joinY-a[1]),u=1-t;
  const lateral=point[0]-a[0]-t*(joinX-a[0]);
  const center=centerAt(t,u);
  const tangent=root.map((n,i)=>u*u*(control1[i]-n)+2*u*t*(control2[i]-control1[i])+t*t*(tip[i]-control2[i]));
  const turn=Math.atan2(tangent[1],tangent[0])-angle;
  return [center[0]+lateral*Math.cos(turn),center[1]+lateral*Math.sin(turn)];
 };
}
