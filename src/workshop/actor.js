import * as THREE from 'three';
import {actorConfig as config} from './actor-config.js';
import {actorHeight,facing,makeMotion,motionSample,motionHeading,clamp} from './actor-motion.js';
import {gaitPose} from '../guide-rig/gait.js';
import {gaitTravel,travelPhase} from '../guide-rig/travel.js';
import clips from '../castle-adventure/run-clips.json';
import {vertex,fragment,shadowFragment} from './actor-shaders.js';
import {outfitDuration,outfitReveal,outfitLightFragment} from './outfit-light.js';
import {makeSilhouette} from './silhouette.js';
import footPoints from './foot-points.json';

const abortError=()=>new DOMException('Workshop movement canceled','AbortError');
const smooth=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
export class WorkshopActor{
 constructor(workshop,atlas,flow,onState=()=>{},guide){
  this.workshop=workshop;this.onState=onState;this.position=[...config.rest];this.footPoints=footPoints;
  this.state='hidden';this.wearDress=false;this.change=null;this.row=6;this.angle=-Math.PI/2;this.frame=0;this.nextFrame=0;this.poseMix=0;
  this.elapsed=0;this.target=null;this.quiet=false;this.manual=false;this.disposed=false;this.carryPhase=null;this.carryWeight=null;this.gaitPhase=0;this.gaitWeight=0;this.guide=guide;
  // Own GPU views while sharing the existing, already downloaded CPU atlases.
  this.atlas=atlas.clone();this.flow=flow.clone();this.silhouette=makeSilhouette(atlas);
  // Clamp each sampled cell and keep its native outline; mipmaps otherwise
  // average transparent gutters into small guide silhouettes.
  this.atlas.generateMipmaps=false;this.atlas.minFilter=THREE.LinearFilter;this.atlas.needsUpdate=true;
  this.group=new THREE.Group();this.group.name='workshop-guide';this.group.visible=false;
  const clip=()=>({value:new THREE.Vector4(...config.clip)});
  this.material=new THREE.ShaderMaterial({uniforms:{atlas:{value:this.atlas},flowMap:{value:this.flow},silhouette:{value:this.silhouette},cell:{value:new THREE.Vector2(0,6)},nextCell:{value:new THREE.Vector2(0,6)},flowCell:{value:new THREE.Vector2()},feet:{value:new THREE.Vector4()},nextFeet:{value:new THREE.Vector4()},poseMix:{value:0},flowScale:{value:clips.flowRange/clips.flowCell},useFlow:{value:false},clip:clip()},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:false,toneMapped:false,side:THREE.DoubleSide});
  Object.assign(this.material.uniforms,{guideAtlas:{value:guide.texture},useGuide:{value:false}});
  this.geometry=new THREE.PlaneGeometry(1,1);this.sprite=new THREE.Mesh(this.geometry,this.material);this.sprite.name='workshop-guide-sprite';this.sprite.renderOrder=2;
  this.spritePivot=new THREE.Group();this.spritePivot.add(this.sprite);this.group.add(this.spritePivot);
  this.outfitMaterial=new THREE.ShaderMaterial({
   uniforms:{guideAtlas:{value:guide.texture},progress:{value:0},heading:{value:6},clip:clip()},
   vertexShader:vertex,fragmentShader:outfitLightFragment,transparent:true,
   depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide
  });
  this.outfitLight=new THREE.Mesh(this.geometry,this.outfitMaterial);
  this.outfitLight.renderOrder=3;this.outfitLight.visible=false;this.spritePivot.add(this.outfitLight);
  this.shadowMaterial=new THREE.ShaderMaterial({uniforms:{opacity:{value:0},clip:clip()},vertexShader:vertex,fragmentShader:shadowFragment,transparent:true,depthWrite:false,depthTest:false,toneMapped:false,side:THREE.DoubleSide});
  this.shadowGeometry=new THREE.PlaneGeometry(1,1);this.shadow=new THREE.Mesh(this.shadowGeometry,this.shadowMaterial);this.shadow.name='workshop-guide-shadow';this.shadow.renderOrder=1;this.group.add(this.shadow);
  this.detach=workshop.attachActor(this.group);workshop.setActorAdapter(this);
  this.updateFrame();
 }
 changeOutfit(wear=!this.wearDress){
  if(this.change||this.state==='entering'||this.state==='hidden'||wear===this.wearDress)return false;
  if(this.quiet){
   this.wearDress=wear;
   this.updateFrame();
  }else{
   this.change={wear,time:0};
   this.updateOutfitLight(0);
  }
  this.onState();
  this.workshop.draw();
  return true;
 }
 updateOutfitLight(progress){
  this.outfitLight.visible=Boolean(this.change);
  this.outfitMaterial.uniforms.progress.value=progress;
  this.workshop.dirty=true;
 }
 advanceOutfit(dt){
  if(!this.change)return false;
  const change=this.change;
  change.time+=dt;
  const progress=this.quiet?1:Math.min(1,change.time/outfitDuration);
  if(progress>=outfitReveal&&this.wearDress!==change.wear){
   this.wearDress=change.wear;
   this.updateFrame();
  }
  if(progress===1){
   this.change=null;
   this.onState();
  }
  this.updateOutfitLight(progress);
  return true;
 }
 getPosition(){return [...this.position];}
 setState(state){if(this.state===state)return;this.state=state;this.onState();}
 enter(quiet=false){
  this.cancelRequest();this.wearDress=false;this.change=null;this.updateOutfitLight(0);this.carryPhase=null;this.carryWeight=null;this.gaitPhase=0;this.quiet=quiet;this.manual=false;this.target=null;this.angle=-Math.PI/2;this.row=6;this.group.visible=true;
  this.position=[...config.entryStart];this.elapsed=0;
  this.motion=this.planGait(makeMotion([config.entryStart,config.rest],{entry:true,duration:config.entryDuration}),0,1);
  this.setState('entering');
  if(quiet)this.completeMotion();else this.updateFrame();
 }
 setQuiet(quiet){this.quiet=quiet;if(!quiet)return;if(this.motion)this.completeMotion();this.advanceOutfit(0);}
 moveTo(plan,{signal}={}){
  if(this.disposed||signal?.aborted)return Promise.reject(abortError());
  this.cancelRequest();
  return new Promise((resolve,reject)=>{
   const request={plan,signal,resolve,reject};
   request.abort=()=>{if(this.request!==request)return;this.request=null;signal?.removeEventListener('abort',request.abort);reject(abortError());if(this.state==='moving'){this.carryPhase=this.gaitPhase;this.carryWeight=this.gaitWeight;this.motion=null;this.setState('idle');this.updateFrame();}};
   this.request=request;signal?.addEventListener('abort',request.abort,{once:true});
   // Early clicks queue until the central entrance has reached its lower stop.
   if(this.state!=='entering')this.startRequest();
  });
 }
 startRequest(){
  const request=this.request;if(!request||request.signal?.aborted)return;
  const route=this.workshop.navigation.route(this.position,request.plan.approach);
  if(!route){this.request=null;request.signal?.removeEventListener('abort',request.abort);request.reject(Error('No walkable approach'));return;}
  request.plan.route=route;request.plan.floorRoute=route.map(p=>this.workshop.floorPoint(p));
  request.plan.directions=route.slice(1).map((p,i)=>this.workshop.navigation.direction(route[i],p));
  this.target=request.plan.id;this.elapsed=0;this.manual=false;
  if(Math.hypot(this.position[0]-route.at(-1)[0],this.position[1]-route.at(-1)[1])<.1){this.motion=makeMotion([this.position,route.at(-1)]);this.completeMotion();return;}
  this.motion=this.planGait(makeMotion(route,{navigation:this.workshop.navigation,fromRest:!this.carryWeight}),this.carryPhase??this.gaitPhase,this.carryWeight??0);this.carryPhase=null;this.carryWeight=null;this.lastMotion=this.motion;
  this.setState('moving');if(this.quiet)this.completeMotion();else this.updateFrame();
 }
 arrivalFacing(motion){
  if(motion.entry)return 6;
  const last=motion.route.at(-1);
  const object=this.workshop.nodes.get(this.target)?.userData;
  if(object&&!['book','fabric'].includes(object.kind)){
   return facing(last,[(object.bounds.left+object.bounds.right)/2,(object.bounds.top+object.bounds.bottom)/2]);
  }
  return motion.length>.01?facing(motion.route.at(-2),last):this.row;
 }
 planGait(motion,phase,startWeight){const amplitude=motion.entry?1:Math.max(.25,Math.min(1,motion.length/motion.duration/config.speed));motion.gait={phase,startWeight,amplitude};
  // Route translation reaches the destination first. The last planted step
  // releases the arms and shoulders on the same meshes before interaction.
  motion.travelDuration=motion.duration;
  motion.duration+=config.running.followThrough;
  const last=motion.route.at(-1),prev=motion.route.at(-2);
  motion.arrivalRow=this.arrivalFacing(motion);
  const endHeading=Math.atan2(last[1]-prev[1],last[0]-prev[0]);
  const delta=motion.arrivalRow*Math.PI/4-endHeading;
  motion.arrivalTurn=Math.atan2(Math.sin(delta),Math.cos(delta));
  motion.gaitPlan=gaitTravel(motion.route,row=>this.guide.strideScale(row)*config.running.strideMultiplier,amplitude);return motion;}
 completeMotion(){
  if(!this.motion)return;
  const motion=this.motion,entry=motion.entry;this.elapsed=motion.duration;this.position=motion.route.at(-1).slice(0,2);if(motion.gaitPlan)this.gaitPhase=travelPhase(motion.gaitPlan,motion.route.length-1,1,motion.gait.phase);this.lastMotion=motion;this.motion=null;this.carryPhase=null;this.carryWeight=null;
  if(entry){this.angle=-Math.PI/2;this.row=6;}else{
   this.row=motion.arrivalRow??this.arrivalFacing(motion);
   this.angle=this.row*Math.PI/4;
  }
  this.setState('idle');this.updateFrame();
  if(entry){this.changeOutfit(true);if(this.request)this.startRequest();}
  else if(this.request){const request=this.request;this.request=null;request.signal?.removeEventListener('abort',request.abort);request.resolve();}
 }
 tick(dt,quiet=false){
  this.setQuiet(quiet);
  if(this.state==='hidden'||this.disposed)return false;
  const changed=this.advanceOutfit(Math.min(dt,.10));
  if(this.manual||!this.motion)return changed;
  this.elapsed=Math.min(this.motion.duration,this.elapsed+dt);
  if(this.elapsed>=this.motion.duration)this.completeMotion();else this.updateFrame(dt);
  return true;
 }
 updateFrame(dt=0,forceHeading=false){
  let height=actorHeight(this.position),lift=0,lean=0,weight=0,phase=this.gaitPhase;
  if(this.motion){
   const sample=motionSample(this.motion,this.elapsed),point=sample.point;this.position=point.slice(0,2);height=point[2];
   const remaining=this.motion.duration-this.elapsed;
   const turnWindow=Math.min(.38,this.motion.duration*.5);
   const settling=smooth(1-remaining/turnWindow);
   const heading=motionHeading(this.motion,this.elapsed)+(this.motion.arrivalTurn||0)*settling;
   if(forceHeading||this.motion.entry)this.angle=heading;
   else {
    const delta=Math.atan2(Math.sin(heading-this.angle),Math.cos(heading-this.angle));
    const turnRate=settling>0?Math.max(10,1.875*Math.abs(this.motion.arrivalTurn)/turnWindow):10;
    const limit=Math.min(Math.PI/4,dt*turnRate);
    this.angle+=Math.max(-limit,Math.min(limit,delta));
   }
   this.row=((Math.round(this.angle/(Math.PI/4))%8)+8)%8;
   phase=travelPhase(this.motion.gaitPlan,sample.index,sample.t,this.motion.gait.phase);const g=this.motion.gait,landing=config.running.followThrough+Math.min(.13,this.motion.travelDuration*.24),start=g.startWeight+(g.amplitude-g.startWeight)*smooth(this.elapsed/.1);weight=start*(1-smooth((this.elapsed-this.motion.duration+landing)/landing));const gait=gaitPose(phase);lift=Math.min(gait.left.foot.height,gait.right.foot.height)*height/230*.2*weight;lean=Math.cos(this.angle)*config.running.lean*weight;
  }
  const active=weight>1e-4;this.height=height;this.gaitPhase=this.phase=phase;this.gaitWeight=weight;const cell=phase*12;this.frame=active?1+Math.floor(cell):0;this.nextFrame=active?1+(Math.floor(cell)+1)%12:0;this.poseMix=active?cell-Math.floor(cell):0;
  if(this.group.visible){
   const dress=this.wearDress?this.workshop.dressAtlas.image:null;
   this.guide.drawArticulated(this.row,phase,weight,config.running.strideMultiplier,dress);
   this.material.uniforms.cell.value.set(0,this.row);
   this.material.uniforms.useGuide.value=true;
   this.material.uniforms.useFlow.value=false;
  }
  const ground=this.workshop.floorWorld(this.position),tile=height/230*320;
  this.spritePivot.position.set(ground.x,ground.y,ground.z+config.depthClearance);this.spritePivot.rotation.z=-lean;
  this.sprite.scale.set(tile,tile,1);this.sprite.position.set(0,height/230*120,0);
  this.outfitLight.scale.copy(this.sprite.scale);
  this.outfitLight.position.copy(this.sprite.position);
  this.outfitMaterial.uniforms.heading.value=this.row;
  // The shadow lies on the same sloping floor, rather than a screen-space oval.
  const width=height*.49,depth=height*.105,p=this.shadowGeometry.attributes.position,d=915*282+347*157;
  for(let i=0;i<p.count;i++){const uv=this.shadowGeometry.attributes.uv,x=(uv.getX(i)-.5)*width,y=(uv.getY(i)-.5)*depth;p.setXYZ(i,x,y,440*(-157*x-915*y)/d);}
  p.needsUpdate=true;this.shadow.position.copy(ground);this.shadow.position.z+=.6;
  this.shadowMaterial.uniforms.opacity.value=.19*(1-clamp(lift/(height*.05))*.45)*clamp((config.clip[3]-this.position[1])/(height*.13));
  this.workshop.dirty=true;
 }
 setSourcePose(row,pose){const u=this.material.uniforms;u.useGuide.value=false;u.cell.value.set(pose.from,row);u.nextCell.value.set(pose.to,row);u.flowCell.value.set(pose.index,row);u.poseMix.value=pose.mix;u.useFlow.value=pose.from!==pose.to&&pose.mix>0;u.feet.value.fromArray(footPoints[row][pose.from].flat().map(n=>n/256));u.nextFeet.value.fromArray(footPoints[row][pose.to].flat().map(n=>n/256));}
 // Review-only deterministic clock; live pointer/keyboard actions use moveTo.
 seek(seconds){if(!this.motion)return false;this.manual=true;this.elapsed=Math.max(0,Math.min(this.motion.duration,seconds));if(this.elapsed>=this.motion.duration)this.completeMotion();else this.updateFrame(0,true);this.workshop.draw();return true;}
 resume(){this.manual=false;}
 cancelRequest(){if(this.request)this.request.abort();}
 stop(){this.cancelRequest();this.change=null;this.updateOutfitLight(0);this.motion=null;this.carryPhase=null;this.carryWeight=null;this.manual=false;this.group.visible=false;this.target=null;this.setState('hidden');this.workshop.dirty=true;}
 releaseGPU(){if(!this.workshop.renderer.getContext().isContextLost())return;this.atlas.dispose();this.flow.dispose();this.silhouette.dispose();this.geometry.dispose();this.shadowGeometry.dispose();this.material.dispose();this.shadowMaterial.dispose();this.outfitMaterial.dispose();}
 restore(){this.atlas.needsUpdate=true;this.flow.needsUpdate=true;this.silhouette.needsUpdate=true;this.updateFrame();}
 dispose(){if(this.disposed)return;this.stop();this.disposed=true;this.detach();this.atlas.dispose();this.flow.dispose();this.silhouette.dispose();this.geometry.dispose();this.shadowGeometry.dispose();this.material.dispose();this.shadowMaterial.dispose();this.outfitMaterial.dispose();}
}
