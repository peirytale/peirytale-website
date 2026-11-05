import * as THREE from 'three';
import {pageFilmMedia} from '../content/page-film.js';
const asset=name=>`${import.meta.env.BASE_URL}assets/castle-page-${name}`;
export class PageFilm{
 constructor(renderer,onFrame,onState=()=>{},preloaded=null){
  this.preloaded=preloaded;this.renderer=renderer;this.onFrame=onFrame;this.onState=onState;this.active=false;this.complete=false;this.quiet=false;this.disposed=false;this.state='loading';this.abort=new AbortController();this.frames=0;this.generation=0;this.playWanted=false;this.recoveries=0;this.reloads=0;this.deliveredFrames=0;this.pendingSeek=null;
  this.video=document.createElement('video');Object.assign(this.video,{muted:true,playsInline:true,controls:false,loop:false,preload:'auto',defaultPlaybackRate:pageFilmMedia.playbackRate,playbackRate:pageFilmMedia.playbackRate,disablePictureInPicture:true,disableRemotePlayback:true});this.video.setAttribute('playsinline','');
  this.sources=['film.mp4','film.webm'];this.sourceIndex=preloaded?this.sources.indexOf(preloaded.name.replace('castle-page-','')):this.video.canPlayType('video/mp4; codecs="avc1.64001f"')?0:1;this.sourceAssigned=false;
  this.target=new THREE.WebGLRenderTarget(960,672,{depthBuffer:false,stencilBuffer:false,generateMipmaps:false});this.target.texture.colorSpace=THREE.NoColorSpace;
  this.copyScene=new THREE.Scene();this.camera=new THREE.Camera();this.geometry=new THREE.PlaneGeometry(2,2);this.material=new THREE.ShaderMaterial({uniforms:{frame:{value:null},ornament:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D frame,ornament;varying vec2 vUv;void main(){vec3 fixedInk=texture2D(ornament,vec2(vUv.x*.5,vUv.y)).rgb;float allowed=texture2D(ornament,vec2(.5+vUv.x*.5,vUv.y)).r;vec3 ink=fixedInk+(texture2D(frame,vUv).rgb-vec3(128./255.))*allowed;gl_FragColor=vec4(clamp(ink,0.,1.),1.);}',depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});this.copyScene.add(new THREE.Mesh(this.geometry,this.material));
  this.neutral=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);this.neutral.needsUpdate=true;this.material.uniforms.ornament.value=this.neutral;this.copy(this.neutral);
  this.makeVideoTexture();
  const listen=(target,event,fn)=>target.addEventListener(event,fn,{signal:this.abort.signal});
  listen(this.video,'ended',()=>{if(this.video.ended||this.hasDecodedEnd())this.finishPlayback();});
  listen(this.video,'error',()=>{if(this.video.error)this.alternateSource();});
  // play() already loads the resource. Starting it again during loadeddata
  // races WebKit's preroll; this event only makes a frame available.
  listen(this.video,'loadeddata',()=>{this.pendingFrame=true;this.onFrame();});
  listen(this.video,'loadedmetadata',()=>{if(this.pendingSeek!==null)this.video.currentTime=Math.min(this.pendingSeek,Math.max(0,this.video.duration-.05));});
  listen(this.video,'seeked',()=>{if(this.pendingSeek!==null){this.pendingSeek=null;this.pendingFrame=true;this.resetProgress();this.sync();this.onFrame();}});
  listen(this.video,'playing',()=>{if(!this.playWanted||this.complete){if(!this.video.paused)this.video.pause();return;}if(this.video.paused||this.pendingSeek!==null)return;this.nativePlaying=true;this.policyBlocked=false;this.state='playing';this.pendingFrame=true;this.onFrame();this.emit();});
  for(const event of ['waiting','pause'])listen(this.video,event,()=>{this.nativePlaying=false;if(this.playWanted&&!this.complete){this.state='waiting';this.emit();}});
  // stalled describes network fetching; already-buffered frames may continue.
  listen(this.video,'stalled',()=>this.watchProgress());
  listen(this.video,'timeupdate',()=>{if(!this.video.requestVideoFrameCallback){this.pendingFrame=true;this.onFrame();}this.emit();});
  listen(document,'visibilitychange',()=>this.sync());
  const retry=()=>{if(this.state==='waiting'&&this.policyBlocked){this.policyBlocked=false;this.resetProgress();this.sync();}};listen(document,'pointerdown',retry);listen(document,'keydown',retry);
  const request=()=>{this.frameRequest=this.video.requestVideoFrameCallback((_now,metadata)=>{if(this.disposed)return;this.lastPresentedTime=metadata.mediaTime;this.deliveredFrames++;this.pendingFrame=true;this.onFrame();request();});};if(this.video.requestVideoFrameCallback)request();
  const load=async name=>{const t=await new THREE.TextureLoader().loadAsync(asset(name));t.colorSpace=THREE.NoColorSpace;t.generateMipmaps=false;return t;};
  this.ready=Promise.all([load('blank.webp'),load('final.webp'),load('border.webp')]).then(([blank,final,border])=>{if(this.disposed){blank.dispose();final.dispose();border.dispose();return;}this.blank=blank;this.final=final;this.border=border;this.material.uniforms.ornament.value=border;this.copy(this.quiet||this.complete?final:blank);if(this.state==='loading')this.state=this.complete?(this.finalState||'finished'):'ready';this.sync();this.emit();});
  this.ready.catch(()=>{this.state='unavailable';this.emit();});
 }
 get texture(){return this.target.texture;}
 emit(){this.onState({state:this.state,time:this.video.currentTime,active:this.active,frames:this.frames,source:this.sources[this.sourceIndex],generation:this.generation,recoveries:this.recoveries,presentedTime:this.lastPresentedTime??-1});}
 makeVideoTexture(){this.videoTexture?.dispose();this.videoTexture=new THREE.VideoTexture(this.video);this.videoTexture.colorSpace=THREE.NoColorSpace;this.videoTexture.minFilter=this.videoTexture.magFilter=THREE.LinearFilter;}
 copy(texture){const r=this.renderer,previous=r.getRenderTarget(),auto=r.autoClear;this.material.uniforms.frame.value=texture;r.autoClear=true;r.setRenderTarget(this.target);r.render(this.copyScene,this.camera);r.setRenderTarget(previous);r.autoClear=auto;this.onFrame();}
 tick(){if(this.disposed||!this.pendingFrame||this.quiet||this.staticFinal||this.pendingSeek!==null||(!this.nativePlaying&&!this.finishedNaturally)||this.video.readyState<2)return false;this.pendingFrame=false;this.copy(this.videoTexture);this.frames++;this.emit();return true;}
 setActive(active,quiet=this.quiet){
  const resume=this.quiet&&!quiet&&this.complete&&!this.finishedNaturally&&this.finalState!=='fallback';this.active=active;
  if(quiet&&!this.quiet)this.showFinal();this.quiet=quiet;
  if(resume){this.complete=false;this.staticFinal=false;this.state=this.blank?'ready':'loading';if(this.sourceAssigned)this.video.currentTime=0;if(this.blank)this.copy(this.blank);}
  this.sync();this.emit();
 }

 showFinal(state='finished'){this.staticFinal=true;this.complete=true;this.finalState=state;this.sync();this.state=this.final?state:'loading';if(this.final)this.copy(this.final);this.pendingFrame=false;this.emit();}

 sync(){
  if(this.disposed)return;const wanted=this.active&&!this.quiet&&!this.complete&&!document.hidden;
  if(!wanted){if(this.playWanted){this.generation++;this.playRequest=null;if(!this.complete)this.state='paused';}this.playWanted=false;this.nativePlaying=false;clearTimeout(this.watchTimer);this.watchTimer=null;if(!this.video.paused)this.video.pause();return;}
  if(!this.playWanted){this.playWanted=true;this.generation++;this.resetProgress();}
  if(!this.blank)return;
  if(this.sourceAssigned&&this.hasDecodedEnd()){this.finishPlayback();return;}
  if(!this.sourceAssigned)this.assignSource();
  this.requestPlayback();this.watchProgress();
 }

 assignSource(resume=0){
  this.generation++;this.playRequest=null;this.nativePlaying=false;this.policyBlocked=false;this.pendingFrame=false;this.lastPresentedTime=-1;this.pendingSeek=resume>.04?resume:null;
  if(!this.video.paused)this.video.pause();
  if(this.sourceAssigned){this.makeVideoTexture();this.material.uniforms.frame.value=this.neutral;}
  this.sourceAssigned=true;this.state='starting';this.video.src=this.preloaded?.urls?.[`castle-page-${this.sources[this.sourceIndex]}`]||asset(this.sources[this.sourceIndex]);this.video.load();this.resetProgress();
 }
 requestPlayback(){
  if(!this.playWanted||this.policyBlocked||this.pendingSeek!==null||this.playRequest||!this.video.paused)return;
  const request={generation:this.generation};this.playRequest=request;this.state='starting';
  let promise;try{promise=this.video.play();}catch(error){promise=Promise.reject(error);}
  Promise.resolve(promise).catch(error=>{
   if(this.disposed||request.generation!==this.generation||!this.playWanted||this.complete)return;
   this.policyBlocked=error.name==='NotAllowedError';this.state='waiting';
   if(error.name==='NotSupportedError')this.alternateSource();else this.emit();
  }).finally(()=>{if(this.playRequest===request)this.playRequest=null;});
 }
 resetProgress(){this.progressSample={time:this.video.currentTime,frames:this.deliveredFrames,at:performance.now()};}
 hasDecodedEnd(){const v=this.video;return this.pendingSeek===null&&!v.seeking&&Number.isFinite(v.duration)&&v.duration>0&&v.currentTime>=v.duration-.002&&this.lastPresentedTime>=v.duration-1/pageFilmMedia.fps-.005;}
 finishPlayback(){if(this.complete)return;this.finishedNaturally=true;this.complete=true;this.pendingFrame=true;this.videoTexture.needsUpdate=true;this.state='finished';this.sync();this.onFrame();this.emit();}
 watchProgress(){
  if(this.watchTimer||!this.playWanted||this.disposed)return;
  this.watchTimer=setTimeout(()=>{
   this.watchTimer=null;if(!this.playWanted||this.disposed)return;
   const v=this.video,now=performance.now(),sample=this.progressSample;
   // Some WebKit seeks reach duration - 1 ns without dispatching ended.
   // Require the actual final frame timestamp as well as terminal media time.
   if(this.hasDecodedEnd()){this.finishPlayback();return;}
   // The complete blob is local: a decoder stuck before its first frame cannot
   // be waiting for network data. Try the already-preloaded alternate format.
   if(this.preloaded&&!this.policyBlocked&&this.deliveredFrames===0&&v.currentTime<.05&&now-sample.at>5000){this.recoveries++;this.alternateSource();this.emit();return;}
   if(v.currentTime>sample.time+.01||this.deliveredFrames>sample.frames)this.resetProgress();
   else if(!this.policyBlocked&&v.readyState>=2){
    let future=0,bufferedEnd=-1;for(let i=0;i<v.buffered.length;i++)if(v.buffered.start(i)<=v.currentTime+.1){bufferedEnd=Math.max(bufferedEnd,v.buffered.end(i));future=Math.max(future,v.buffered.end(i)-v.currentTime);}
    const bufferedToEnd=Number.isFinite(v.duration)&&bufferedEnd>=v.duration-.005;
    if((future>.5||bufferedToEnd)&&now-sample.at>3500){
     this.lastRecovery={time:v.currentTime,ready:v.readyState,network:v.networkState,paused:v.paused};this.recoveries++;
     if(this.reloads++===0){this.assignSource(v.currentTime);this.sync();}else this.alternateSource(v.currentTime);
     this.emit();
    }
   }
   if(this.playWanted){this.requestPlayback();this.watchProgress();}
  },500);
 }
 alternateSource(resume=this.video.currentTime){
  if(this.disposed||this.complete)return;
  if(this.sourceIndex===0){this.sourceIndex=1;this.reloads=0;this.assignSource(resume);this.sync();this.emit();}else this.showFinal('fallback');
 }

 restore(){if(this.complete&&this.final)this.copy(this.final);else if(this.video.readyState>=2){this.videoTexture.needsUpdate=true;this.copy(this.videoTexture);}else if(this.blank)this.copy(this.blank);}
 dispose(){if(this.disposed)return;this.disposed=true;this.generation++;this.playWanted=false;clearTimeout(this.watchTimer);this.abort.abort();if(this.frameRequest)this.video.cancelVideoFrameCallback(this.frameRequest);this.video.pause();this.videoTexture.dispose();this.video.removeAttribute('src');this.video.load();this.target.dispose();this.neutral.dispose();this.blank?.dispose();this.final?.dispose();this.border?.dispose();this.geometry.dispose();this.material.dispose();}
}
