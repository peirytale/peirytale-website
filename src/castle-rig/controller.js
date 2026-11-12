import * as THREE from 'three';
import config from './regions.json';
import {quadVertex,copyFragment,finalFragment,recessFragment,meshVertex,meshFragment,edgeVertex,edgeFragment} from './shaders.js';
const asset=name=>`${import.meta.env.BASE_URL}assets/castle-rig-${name}.webp`;
const ease=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
function loopDoor(seconds){const period=config.doorPeriod??config.period,p=((seconds%period)+period)%period/period,{start,end,ramp}=config.doorTiming;if(p<start||p>=end)return 0;const u=(p-start)/(end-start);return config.doorAngle*Math.sin(Math.PI*u)*ease(u/ramp)*ease((1-u)/ramp);}
// All time is absolute phase or an explicit frozen time. No integrated physics,
// accumulated mesh transforms, frame sequences or video element exist here.
export class CastleRig{
 constructor(renderer,onFrame,onState=()=>{}){
  this.renderer=renderer;this.onFrame=onFrame;this.onState=onState;this.complete=true;this.frames=0;this.elapsed=0;this.active=false;this.mode='loop';this.disposed=false;this.manual=false;this.needsBase=true;this.abort=new AbortController();document.addEventListener('visibilitychange',()=>{this.last=null;},{signal:this.abort.signal});
  this.scene=new THREE.Scene();this.finalScene=new THREE.Scene();this.camera=new THREE.Camera();
  const [w,h]=config.sourceSize;this.paint=new THREE.WebGLRenderTarget(w,h,{depthBuffer:false,stencilBuffer:false});this.target=new THREE.WebGLRenderTarget(w,h,{depthBuffer:false,stencilBuffer:false});
  this.restPaint=this.paint.clone();this.baseTarget=this.paint.clone();
  for(const target of [this.paint,this.target,this.restPaint,this.baseTarget]){target.texture.colorSpace=THREE.NoColorSpace;target.texture.generateMipmaps=false;}
  this.regions=config.parts.map(part=>{const pad=part.kind==='flag'?config.flagPadding+2:12,xs=part.polygon.map(p=>p[0]*w/config.size[0]),ys=part.polygon.map(p=>p[1]*h/config.size[1]),x=Math.max(0,Math.floor(Math.min(...xs))-pad),top=Math.max(0,Math.floor(Math.min(...ys))-pad),right=Math.min(w,Math.ceil(Math.max(...xs))+pad+1),bottom=Math.min(h,Math.ceil(Math.max(...ys))+pad+1);return new THREE.Vector4(x,h-bottom,right-x,bottom-top);});
  const spill=config.doorLight.spill.rect;this.regions.push(new THREE.Vector4(spill[0]-2,h-spill[3]-2,spill[2]-spill[0]+5,spill[3]-spill[1]+5));
  this.quad=new THREE.PlaneGeometry(2,2);
  const data=new THREE.TextureLoader();
  this.ready=Promise.all(['source','repair','masks','footprint'].map(async name=>{const t=await data.loadAsync(asset(name));t.colorSpace=THREE.NoColorSpace;t.generateMipmaps=false;t.minFilter=t.magFilter=THREE.LinearFilter;return t;})).then(textures=>{
   if(this.disposed){textures.forEach(t=>t.dispose());return;}
   [this.base,this.repair,this.masks,this.footprint]=textures;
   this.backMaterial=new THREE.ShaderMaterial({uniforms:{image:{value:this.repair},masks:{value:this.masks},pageSize:{value:new THREE.Vector2(...config.size)},lightCenter:{value:new THREE.Vector2(...config.doorLight.center)},lightSpread:{value:new THREE.Vector2(...config.doorLight.spread)},lightColor:{value:new THREE.Vector3(...config.doorLight.color.map(c=>c/255))},glow:{value:0},rightGlow:{value:0}},vertexShader:quadVertex,fragmentShader:recessFragment,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending});this.scene.add(new THREE.Mesh(this.quad,this.backMaterial));
   this.parts=config.parts.map(part=>this.makePart(part));this.parts.forEach(mesh=>this.scene.add(mesh));this.sides=[];this.makeDoorEdge(3);this.makeDoorEdge(4);this.side=this.sides[0];
   this.finalMaterial=new THREE.ShaderMaterial({uniforms:{base:{value:this.base},paint:{value:this.paint.texture},restPaint:{value:this.restPaint.texture},footprint:{value:this.footprint},restored:{value:true},sourceSize:{value:new THREE.Vector2(...config.sourceSize)},spillAmount:{value:0},seamX:{value:config.doorSeam*.8},hingeX:{value:config.parts[3].root*.8},opening:{value:0},perspective:{value:config.perspective*.8},footY:{value:config.doorLight.spill.footY},spillLength:{value:config.doorLight.spill.length},spillStrength:{value:config.doorLight.spill.strength},spillColor:{value:new THREE.Vector3(...config.doorLight.spill.color.map(c=>c/255))}},vertexShader:quadVertex,fragmentShader:finalFragment,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending});this.finalScene.add(new THREE.Mesh(this.quad,this.finalMaterial));this.captureRest();this.draw();this.emit();
  });
 }
 // Capture the exact final decoded/composited frame. No re-encoding or endpoint swap.
 capture(texture){
  const r=this.renderer,target=r.getRenderTarget(),auto=r.autoClear;
  const material=new THREE.ShaderMaterial({uniforms:{image:{value:texture}},vertexShader:quadVertex,fragmentShader:copyFragment,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending});const scene=new THREE.Scene();scene.add(new THREE.Mesh(this.quad,material));
  try{r.autoClear=true;r.setRenderTarget(this.baseTarget);r.render(scene,this.camera);}finally{r.setRenderTarget(target);r.autoClear=auto;material.dispose();}
  const [w,h]=config.sourceSize,bytes=new Uint8Array(w*h*4);r.readRenderTargetPixels(this.baseTarget,0,0,w,h,bytes);
  this.nativeSource?.dispose();this.nativeSource=new THREE.DataTexture(bytes,w,h,THREE.RGBAFormat,THREE.UnsignedByteType);this.nativeSource.colorSpace=THREE.NoColorSpace;this.nativeSource.minFilter=this.nativeSource.magFilter=THREE.LinearFilter;this.nativeSource.generateMipmaps=false;this.nativeSource.needsUpdate=true;this.finalMaterial.uniforms.base.value=this.nativeSource;
  this.parts.forEach(m=>m.material.uniforms.source.value=this.nativeSource);this.sides.forEach(m=>m.material.uniforms.source.value=this.nativeSource);this.captureRest();this.needsBase=true;this.stop();
 }
 get texture(){return this.target.texture;}
 makePart(part){
  const xs=part.polygon.map(p=>p[0]),ys=part.polygon.map(p=>p[1]),pad=part.kind==='flag'?9:2,x=Math.min(...xs)-pad,y=Math.min(...ys)-pad,w=Math.max(...xs)-x+pad,h=Math.max(...ys)-y+pad;
  const geometry=new THREE.PlaneGeometry(w,h,part.kind==='flag'?32:12,part.kind==='flag'?12:20);const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setXYZ(i,x+w/2+p.getX(i),y+h/2-p.getY(i),0);p.needsUpdate=true;
  const material=new THREE.ShaderMaterial({uniforms:{source:{value:this.base},masks:{value:this.masks},pageSize:{value:new THREE.Vector2(...config.size)},bounds:{value:new THREE.Vector4(x,y,w,h)},root:{value:part.root},amplitude:{value:part.amplitude||0},phase:{value:part.phase||0},frequency:{value:part.frequency||1},progress:{value:0},envelope:{value:0},opening:{value:0},perspective:{value:config.perspective},doorCenter:{value:config.doorCenter},doorSeam:{value:config.doorSeam},isFlag:{value:part.kind==='flag'},channel:{value:part.channel}},vertexShader:meshVertex,fragmentShader:meshFragment,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=part.kind==='flag'?2:1;return mesh;
 }
 makeDoorEdge(index){
  const p=config.parts[index],top=Math.min(...p.polygon.map(p=>p[1])),bottom=Math.max(...p.polygon.map(p=>p[1]));const geometry=new THREE.PlaneGeometry(1,bottom-top,1,32),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++)positions.setY(i,(top+bottom)/2+positions.getY(i));positions.needsUpdate=true;
  const material=new THREE.ShaderMaterial({uniforms:{source:{value:this.base},pageSize:{value:new THREE.Vector2(...config.size)},root:{value:p.root},doorSeam:{value:config.doorSeam},doorCenter:{value:config.doorCenter},opening:{value:0},perspective:{value:config.perspective},thickness:{value:config.doorThickness}},vertexShader:edgeVertex,fragmentShader:edgeFragment,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});const side=new THREE.Mesh(geometry,material);side.renderOrder=.5;side.frustumCulled=false;this.scene.add(side);this.sides.push(side);
 }
 captureRest(){
  const sides=this.sides.map(m=>m.material.uniforms.opening.value);this.sides.forEach(m=>m.material.uniforms.opening.value=0);
  const glow=this.backMaterial.uniforms.glow.value,rightGlow=this.backMaterial.uniforms.rightGlow.value;this.backMaterial.uniforms.glow.value=this.backMaterial.uniforms.rightGlow.value=0;
  const saved=this.parts.map(m=>{const u=m.material.uniforms,values=[u.progress.value,u.envelope.value,u.opening.value];u.progress.value=u.envelope.value=u.opening.value=0;return values;});
  const r=this.renderer,target=r.getRenderTarget(),auto=r.autoClear;
  try{r.autoClear=true;r.setRenderTarget(this.restPaint);r.render(this.scene,this.camera);}finally{r.setRenderTarget(target);r.autoClear=auto;this.backMaterial.uniforms.glow.value=glow;this.backMaterial.uniforms.rightGlow.value=rightGlow;this.sides.forEach((m,i)=>m.material.uniforms.opening.value=sides[i]);this.parts.forEach((m,i)=>{const u=m.material.uniforms;[u.progress.value,u.envelope.value,u.opening.value]=saved[i];});}
 }
 emit(){this.onState({state:this.active&&!this.quiet&&this.mode!=='stopped'?'playing':'finished',time:this.elapsed,active:this.active,frames:this.frames,source:'last-frame-rig',generation:0,recoveries:0,presentedTime:this.elapsed});}
 setActive(active,quiet=false){if(this.active===active&&this.quiet===quiet)return;this.active=active;this.quiet=quiet;this.last=null;this.draw();this.emit();}
 draw(){
  if(!this.finalMaterial||this.disposed)return;
  const phase=((this.elapsed%config.period)+config.period)%config.period/config.period;
  // One smooth open/close excursion per cycle; the peak has no hold interval.
  let openness=loopDoor(this.elapsed),right=0;
  if(this.mode==='opened'){openness=this.transitionTarget??Math.PI/2;right=this.transitionRightTarget||0;}
  else if(this.mode==='opening'){const t=this.transitionElapsed/this.transitionDuration;if(this.transitionProfile){({left:openness,right}=this.transitionProfile(t));}else{openness=this.transitionStart+(this.transitionTarget-this.transitionStart)*ease(t)+this.transitionVelocity*this.transitionDuration*t*(1-t)**3;right=this.transitionRightStart+(this.transitionRightTarget-this.transitionRightStart)*ease(t);}}
  this.opening=openness;this.rightOpening=right;this.sides[0].material.uniforms.opening.value=openness;this.sides[1].material.uniforms.opening.value=right;
  const restored=this.mode==='stopped'||(this.quiet&&this.mode==='loop')||(phase<1e-10&&openness<1e-10&&this.mode==='loop');
  this.parts.forEach((mesh,i)=>{const u=mesh.material.uniforms;u.progress.value=this.quiet?0:phase;u.envelope.value=1;u.opening.value=config.parts[i].id==='door-right'?right:openness;});
  this.backMaterial.uniforms.glow.value=config.doorLight.strength*THREE.MathUtils.clamp(openness/config.doorAngle,0,1);this.backMaterial.uniforms.rightGlow.value=config.doorLight.strength*THREE.MathUtils.clamp(right/config.doorAngle,0,1);this.finalMaterial.uniforms.spillAmount.value=THREE.MathUtils.clamp(openness/config.doorAngle,0,1);this.finalMaterial.uniforms.opening.value=openness;this.finalMaterial.uniforms.restored.value=restored;
  const r=this.renderer,target=r.getRenderTarget(),auto=r.autoClear;
  try{
   r.autoClear=true;
   if(restored||this.needsBase){this.target.scissorTest=false;r.setRenderTarget(this.target);this.finalMaterial.uniforms.restored.value=true;r.render(this.finalScene,this.camera);this.needsBase=false;}
   if(!restored){
    this.paint.scissorTest=true;for(const region of this.regions){this.paint.scissor.copy(region);r.setRenderTarget(this.paint);r.render(this.scene,this.camera);}
    this.target.scissorTest=true;this.finalMaterial.uniforms.restored.value=false;for(const region of this.regions){this.target.scissor.copy(region);r.setRenderTarget(this.target);r.render(this.finalScene,this.camera);}
   }
  }finally{r.setRenderTarget(target);r.autoClear=auto;}
  this.frames++;this.onFrame();
 }
 tick(){
  const now=performance.now();if(!this.active||this.quiet||this.mode==='stopped'||this.manual||document.hidden){this.last=null;return false;}
  const dt=this.last===null||this.last===undefined?0:(now-this.last)/1000;this.last=now;
  if(this.mode==='opening'){this.transitionElapsed=THREE.MathUtils.clamp(this.transitionClock?this.transitionClock():this.transitionElapsed+dt,0,this.transitionDuration);if(this.transitionElapsed===this.transitionDuration&&!this.transitionDelivered){this.transitionDelivered=true;const resolve=this.transitionResolve;this.transitionResolve=null;queueMicrotask(()=>resolve?.({cancelled:false}));}}
  // Keep the source clock monotonic: flags and door have independent periods.
  this.elapsed+=dt;
  this.draw();if(this.mode==='opening'&&this.transitionElapsed===this.transitionDuration)this.mode='opened';this.emit();return true;
 }
 // Explicit review/scrubbing API; deterministic even when rendering is delayed.
 seek(seconds){this.manual=true;this.elapsed=seconds;this.draw();this.emit();}
 stop(){this.cancelTransition();this.mode='stopped';this.manual=false;this.elapsed=0;this.last=null;this.draw();this.emit();}
 resume(){this.cancelTransition();this.mode='loop';this.manual=false;this.last=null;this.draw();this.emit();}
 cancelTransition(){this.transitionResolve?.({cancelled:true});this.transitionResolve=null;}
 moveDoorTo(angle,{duration=.9,clock=null,rightAngle=0,monotonic=false,profile=null}={}){
  const velocity=this.mode==='loop'?(loopDoor(this.elapsed+.001)-loopDoor(this.elapsed-.001))/.002:0;
  this.cancelTransition();this.transitionStart=this.opening||0;this.transitionTarget=THREE.MathUtils.clamp(angle,0,Math.PI/2);this.transitionRightStart=this.rightOpening||0;this.transitionRightTarget=THREE.MathUtils.clamp(rightAngle,0,Math.PI/2);this.transitionClock=clock;this.transitionDuration=Math.max(.01,duration);
  // Retain the incoming motion while bounding its excursion near either stop.
  const speed=Math.abs(this.transitionTarget-this.transitionStart)*2/this.transitionDuration;
  this.transitionVelocity=monotonic?0:THREE.MathUtils.clamp(velocity,-Math.min(speed,this.transitionStart*2/this.transitionDuration),Math.min(speed,(Math.PI/2-this.transitionStart)*2/this.transitionDuration));
  this.transitionProfile=profile;this.mode='opening';this.manual=false;this.transitionElapsed=0;this.transitionDelivered=false;this.last=null;return new Promise(resolve=>this.transitionResolve=resolve);
 }
 holdDoor(angle,{rightAngle=0}={}){this.cancelTransition();this.transitionTarget=THREE.MathUtils.clamp(angle,0,Math.PI/2);this.transitionRightTarget=THREE.MathUtils.clamp(rightAngle,0,Math.PI/2);this.mode='opened';this.manual=false;this.last=null;this.draw();}
 openFully(options={}){return this.moveDoorTo(Math.PI/2,{duration:2.4,rightAngle:Math.PI/2,...options});}
 restore(){if(this.disposed)return;if(this.nativeSource){this.nativeSource.needsUpdate=true;this.captureRest();}this.needsBase=true;this.draw();}
 dispose(){if(this.disposed)return;this.cancelTransition();this.disposed=true;this.abort.abort();this.parts?.forEach(m=>{m.geometry.dispose();m.material.dispose();});this.nativeSource?.dispose();this.sides?.forEach(m=>{m.geometry.dispose();m.material.dispose();});this.quad.dispose();this.backMaterial?.dispose();this.finalMaterial?.dispose();for(const t of [this.base,this.repair,this.masks,this.footprint])t?.dispose();this.paint.dispose();this.restPaint.dispose();this.baseTarget.dispose();this.target.dispose();}
}
