import * as THREE from 'three';
import {room} from './layout.js';
import {WorkshopScene} from './scene.js';
import {WorkshopActor} from './actor.js';
// Owns the scene handoff; the castle's film, captured pixels and clocks retain
// their existing contracts. All output remains ink on the actual book surfaces.
export class WorkshopChapter{
 constructor(adventure,loader,onState=()=>{},onFrame=()=>{}){
  this.adventure=adventure;this.onState=onState;this.onFrame=onFrame;this.complete=true;this.mode='castle';this.time=0;this.active=false;this.last=null;
  this.workshop=new WorkshopScene(adventure.renderer,loader,onFrame);this.target=adventure.target.clone();this.target.depthBuffer=false;
  this.actor=new WorkshopActor(this.workshop,adventure.atlas,adventure.flow,()=>this.emit(),adventure.guide);
  this.geometry=new THREE.PlaneGeometry(2,2);this.scene=new THREE.Scene();this.camera=new THREE.Camera();this.material=new THREE.ShaderMaterial({uniforms:{gold:{value:adventure.texture},room:{value:this.workshop.texture},reveal:{value:0}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D gold,room;uniform float reveal;varying vec2 p;void main(){float t=reveal*reveal*(3.-2.*reveal);gl_FragColor=vec4(mix(texture2D(gold,p).rgb,texture2D(room,p).rgb,t),1.);}',depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending});this.scene.add(new THREE.Mesh(this.geometry,this.material));
  this.prepare();
 }
 get texture(){return ['workshop','prepared'].includes(this.mode)?this.workshop.texture:this.mode==='revealing'?this.target.texture:this.adventure.texture;}
 prepare(){if(this.workshop.loaded)return Promise.resolve();if(this.preparation)return this.preparation;this.error=null;this.preparing=true;this.emit();this.preparation=(async()=>{try{await this.workshop.prepare();}catch(e){this.error=e.message;}finally{this.preparing=false;this.preparation=null;this.emit();}})();return this.preparation;}
 setActive(active,quiet=false){this.active=active;this.quiet=quiet;this.last=null;this.actor.setQuiet(quiet);this.adventure.setActive(active&&this.mode==='castle',quiet);if(quiet&&this.mode==='revealing')this.enter();this.emit();}
 cancel(){this.directRequested=false;this.mode='castle';this.time=0;this.last=null;this.workshop.cancelInteraction();this.actor.stop();this.workshop.selected=null;this.workshop.draw();this.adventure.cancel();this.emit();}
 back(){this.cancel();this.adventure.setActive(this.active,this.quiet);this.onFrame();}
 prepareDirectView(){this.workshop.cancelInteraction();this.actor.stop();this.workshop.selected=null;this.workshop.draw();this.mode='prepared';this.time=0;this.adventure.setActive(false,this.quiet);this.emit();this.onFrame();}
 reveal(){this.mode='revealing';this.time=0;this.last=null;this.adventure.setActive(false,this.quiet);this.blend(0);this.emit();if(this.quiet)this.enter();}
 enter(){this.directRequested=false;this.mode='workshop';this.time=0;this.adventure.setActive(false,this.quiet);this.actor.enter(this.quiet);this.workshop.dirty=true;this.workshop.draw();this.emit();this.onFrame();}
 tick(){
  if(!this.active||document.hidden||this.disposed){this.last=null;return false;}
  const now=performance.now(),elapsed=this.last==null?0:Math.max(0,(now-this.last)/1000),dt=Math.min(.1,elapsed);this.last=now;
  if(this.mode==='castle'){
   const changed=this.adventure.tick();
   if(this.adventure.state==='lit'&&(!this.adventure.manual||this.quiet)){this.time+=dt;if(this.time>=room.transition.hold||this.quiet){if(this.workshop.loaded){this.mode='turning';this.time=0;this.adventure.setActive(false,this.quiet);this.emit();this.onTurn?.();}else this.emit();}}
   else this.time=0;
   return changed;
  }
  if(this.mode==='revealing'){this.time+=dt;this.blend(Math.min(1,this.time/room.transition.reveal));if(this.time>=room.transition.reveal)this.enter();return true;}
  if(this.mode!=='workshop')return false;
  // Match the castle guide's wall-clock travel even on a slow renderer. The
  // shared active/visibility gate above already resets time during real pauses.
  const actorChanged=this.actor.tick(elapsed,this.quiet);return this.workshop.draw()||actorChanged;
 }
 blend(amount){const r=this.adventure.renderer,previous=r.getRenderTarget(),auto=r.autoClear;this.material.uniforms.gold.value=this.adventure.texture;this.material.uniforms.reveal.value=amount;try{r.autoClear=true;r.setRenderTarget(this.target);r.render(this.scene,this.camera);}finally{r.setRenderTarget(previous);r.autoClear=auto;}this.onFrame();}
 emit(){if(this.disposed)return;const state={mode:this.mode,directRequested:Boolean(this.directRequested),loading:this.preparing,error:this.error,waiting:this.adventure.state==='lit'&&this.mode==='castle',selected:this.workshop.selected,actorState:this.actor?.state||'hidden',actorTarget:this.actor?.target||null},key=JSON.stringify(state);if(key===this.emission)return;this.emission=key;this.onState(state);}
 restore(){this.actor.restore();this.workshop.restore();if(this.mode==='revealing')this.blend(Math.min(1,this.time/room.transition.reveal));this.onFrame();}
 releaseGPU(){this.adventure.guide?.releaseGPU();this.actor.releaseGPU();this.workshop.releaseGPU();if(!this.adventure.renderer.getContext().isContextLost())return;this.geometry.dispose();this.material.dispose();this.target.dispose();}
 dispose(){this.disposed=true;this.actor.dispose();this.workshop.dispose();this.geometry.dispose();this.material.dispose();this.target.dispose();}
}
