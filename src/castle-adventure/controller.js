import * as THREE from 'three';
import {adventure as config} from './config.js';
import {vertex,fragment} from './shaders.js';
import {roundedRoute,perspectiveTravel,travelProgress} from './route.js';
import {runPose} from './running.js';
import clips from './run-clips.json';
import rigConfig from '../castle-rig/regions.json';
import {pairedOpening} from './door-motion.js';
const doorProgress=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
export class CastleAdventure{
 constructor(rig,onState=()=>{},atlasBlob=null,flowBlob=null){
  this.rig=rig;this.renderer=rig.renderer;this.onState=onState;this.complete=true;this.state='idle';this.time=0;this.active=false;this.disposed=false;
  this.target=rig.target.clone();this.target.scissorTest=false;
  this.geometry=new THREE.PlaneGeometry(2,2);this.scene=new THREE.Scene();this.camera=new THREE.Camera();
  this.material=new THREE.ShaderMaterial({uniforms:{base:{value:rig.texture},atlas:{value:null},flowMap:{value:null},doorMasks:{value:rig.masks},pageSize:{value:new THREE.Vector2(...config.size)},entryClip:{value:new THREE.Vector4(...config.entryClip)},feet:{value:new THREE.Vector2()},cell:{value:new THREE.Vector2()},nextCell:{value:new THREE.Vector2()},flowCell:{value:new THREE.Vector2()},poseMix:{value:0},flowScale:{value:clips.flowRange/clips.flowCell},useFlow:{value:false},lift:{value:0},lean:{value:0},door:{value:new THREE.Vector2(...config.door)},aperture:{value:new THREE.Vector2(config.door[0],config.door[0])},coreColor:{value:new THREE.Vector3(...config.lighting.core)},edgeColor:{value:new THREE.Vector3(...config.lighting.edge)},lightRange:{value:config.lighting.range},lightStrength:{value:config.lighting.strength},veilStart:{value:config.lighting.veilStart},height:{value:156},visible:{value:0},light:{value:0},flood:{value:0}},vertexShader:vertex,fragmentShader:fragment,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});
  this.scene.add(new THREE.Mesh(this.geometry,this.material));
  const travel=perspectiveTravel(roundedRoute(config.route,config.cornerRadius),config.route[0][2],config.perspectiveSpeedPower);
  this.route=travel.route;this.lengths=travel.lengths;this.travelTimes=travel.times;
  this.totalLength=this.lengths.at(-1);this.totalTravelTime=this.travelTimes.at(-1);
  const load=async(blob,name)=>{const url=blob?URL.createObjectURL(blob):`${import.meta.env.BASE_URL}assets/${name}`;try{const t=await new THREE.TextureLoader().loadAsync(url);t.colorSpace=THREE.NoColorSpace;t.generateMipmaps=false;t.minFilter=t.magFilter=THREE.LinearFilter;return t;}finally{if(blob)URL.revokeObjectURL(url);}};
  this.ready=Promise.allSettled([load(atlasBlob,config.atlas),load(flowBlob,config.flowAtlas)]).then(results=>{const failed=results.find(r=>r.status==='rejected');if(this.disposed||failed){results.forEach(r=>{if(r.status==='fulfilled')r.value.dispose();});if(failed)throw failed.reason;return;}const [atlas,flow]=results.map(r=>r.value);this.atlas=atlas;this.flow=flow;this.material.uniforms.atlas.value=atlas;this.material.uniforms.flowMap.value=flow;this.loaded=true;this.emit();});
  this.abort=new AbortController();document.addEventListener('visibilitychange',()=>{this.last=null;},{signal:this.abort.signal});
 }
 get texture(){return this.state==='idle'?this.rig.texture:this.target.texture;}
 setActive(active,quiet=false){this.active=active;this.quiet=quiet;this.last=null;this.rig.setActive(active,quiet);if(quiet&&this.state!=='idle')this.finishQuiet();this.emit();}
 start(){
  if(!this.loaded||!this.active||this.state!=='idle'||this.disposed)return false;
  this.time=0;this.last=null;this.state='approaching';this.manual=false;
  // Never close the inviting leaf on activation, even during its closing phase.
  this.entryOpening=this.rig.opening||0;this.invitationTarget=Math.max(this.entryOpening,config.invitationAngle);
  this.rig.moveDoorTo(this.invitationTarget,{duration:config.normalize,rightAngle:0,monotonic:true,clock:()=>this.time});
  if(this.quiet)this.finishQuiet();else{this.update();this.draw();this.emit();}
  return true;
 }
 finishQuiet(){this.time=config.approach+config.settle+config.push;this.state='lit';this.rig.holdDoor(Math.PI/2,{rightAngle:Math.PI/2});this.update();this.draw();this.emit();}
 cancel(){if(this.state==='idle')return;this.state='idle';this.time=0;this.light=0;this.flood=0;this.feet=null;this.last=null;this.manual=false;this.rig.resume();this.emit();}
 pathAt(time){
  const f=THREE.MathUtils.clamp(time/config.approach,0,1),travel=this.totalTravelTime*travelProgress(f,config.arrivalSlowdown);let i=1;while(i<this.travelTimes.length-1&&travel>this.travelTimes[i])i++;
  const a=this.route[i-1],b=this.route[i],s=(travel-this.travelTimes[i-1])/(this.travelTimes[i]-this.travelTimes[i-1]);return a.map((x,k)=>THREE.MathUtils.lerp(x,b[k],s));
 }
 headingAt(time){const a=this.pathAt(time-config.running.turnWindow/2),b=this.pathAt(time+config.running.turnWindow/2);return Math.atan2(b[1]-a[1],b[0]-a[0]);}
 update(){
  const u=this.material.uniforms,t=this.time,arrival=config.approach,contact=arrival+config.settle,end=contact+config.push;
  let feet=config.route.at(-1),row=config.facing,frame=0,next=0,mix=0,flowIndex=0,lift=0,lean=0;
  if(t<arrival){
   this.state='approaching';
   feet=this.pathAt(t);const heading=this.headingAt(t);
   row=(Math.round(heading/(Math.PI/4))+8)%8;
   const pose=runPose(t,arrival,row,config.running);frame=pose.from;next=pose.to;mix=pose.mix;flowIndex=pose.index;lift=pose.lift*feet[2]/config.route[0][2];
   const turn=Math.sin(this.headingAt(t+.06)-this.headingAt(t-.06));lean=THREE.MathUtils.clamp((Math.cos(heading)+turn)*config.running.lean,-.055,.055)*pose.weight;
  }else if(t<contact){this.state='at-door';}
  else if(t<end){this.state='pushing';}
  else {this.state='lit';}
  this.feet=[feet[0],feet[1]];this.row=row;this.frame=frame;this.nextFrame=next;this.poseMix=mix;this.lift=lift;this.lean=lean;
  this.light=doorProgress((t-contact)/config.push);this.flood=this.light;
  const scale=config.size[0]/rigConfig.size[0],seam=rigConfig.doorSeam*scale;
  const edge=(part,angle)=>{const hinge=rigConfig.parts[part].root*scale,dx=seam-hinge;return seam+(hinge+dx*Math.cos(angle)-seam)/(1-Math.abs(dx)*Math.sin(angle)/(rigConfig.perspective*scale));};u.aperture.value.set(edge(3,this.rig.opening||0),edge(4,this.rig.rightOpening||0));
  u.feet.value.set(...this.feet);u.height.value=feet[2];u.cell.value.set(frame,row);u.nextCell.value.set(next,row);u.flowCell.value.set(flowIndex,row);u.poseMix.value=mix;u.useFlow.value=frame!==next&&mix>0;u.lift.value=lift;u.lean.value=lean;u.visible.value=1;u.light.value=this.light;u.flood.value=this.flood;
 }
 draw(){if(!this.loaded||this.state==='idle'||this.disposed)return;const r=this.renderer,previous=r.getRenderTarget(),auto=r.autoClear;this.material.uniforms.base.value=this.rig.texture;try{r.autoClear=true;r.setRenderTarget(this.target);r.render(this.scene,this.camera);}finally{r.setRenderTarget(previous);r.autoClear=auto;}this.rig.onFrame();}
 tick(){
  if(!this.active||document.hidden||this.disposed||this.manual||this.state==='idle'||this.quiet){this.last=null;return this.rig.tick();}
  const now=performance.now(),dt=this.last==null?0:Math.max(0,(now-this.last)/1000);this.last=now;
  const before=this.time;this.time=Math.min(config.approach+config.settle+config.push,this.time+dt);
  if(before<config.approach+config.settle&&this.time>=config.approach+config.settle){this.rig.holdDoor(this.invitationTarget);this.rig.openFully({duration:config.push,rightAngle:Math.PI/2,profile:p=>pairedOpening(p,this.invitationTarget,config.pairedDoor),clock:()=>this.time-config.approach-config.settle});}
  this.rig.tick();
  this.update();this.draw();this.emit();return true;
 }
 // Deterministic visual review API; the live UI never calls seek().
 seek(seconds){this.entryOpening??=this.rig.opening||0;this.invitationTarget??=Math.max(this.entryOpening,config.invitationAngle);this.manual=true;this.time=THREE.MathUtils.clamp(seconds,0,config.approach+config.settle+config.push);const initial=THREE.MathUtils.lerp(this.entryOpening,this.invitationTarget,doorProgress(this.time/config.normalize)),pose=this.time<config.approach+config.settle?{left:initial,right:0}:pairedOpening((this.time-config.approach-config.settle)/config.push,this.invitationTarget,config.pairedDoor);this.rig.holdDoor(pose.left,{rightAngle:pose.right});this.rig.manual=true;this.update();this.draw();this.emit();}
 emit(){this.onState({state:this.state,time:this.time,loaded:Boolean(this.loaded),active:this.active,feet:this.feet,row:this.row,frame:this.frame,light:this.light||0,flood:this.flood||0});}
 restore(){if(this.atlas)this.atlas.needsUpdate=true;if(this.flow)this.flow.needsUpdate=true;this.draw();this.emit();}
 dispose(){if(this.disposed)return;this.disposed=true;this.abort.abort();this.atlas?.dispose();this.flow?.dispose();this.material.dispose();this.geometry.dispose();this.target.dispose();}
}
