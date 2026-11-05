import {audioSettings} from './content/audio.js';
const asset=name=>`${import.meta.env.BASE_URL}assets/${name}`;
// One gesture-unlocked graph owns both the theme and short pencil recording.
// Decode lazily, retain one theme buffer, and create fresh sources on resume.
export class Music{
 constructor(onChange=()=>{}){
  this.enabled=false;this.onChange=onChange;this.abort=new AbortController();this.themeOffset=0;this.fadingSources=new Set();
  const listen=(event,fn)=>document.addEventListener(event,fn,{signal:this.abort.signal});
  listen('visibilitychange',()=>{if(this.enabled&&!document.hidden)this.context?.resume().then(()=>this.sync()).catch(()=>this.emit());this.sync();});
  const retry=event=>{if(event.target.closest?.('[data-action=music]'))return;if(this.enabled&&this.context?.state!=='running')this.context?.resume().then(()=>this.sync()).catch(()=>this.emit());};listen('pointerdown',retry);listen('keydown',retry);
 }
 get themeTime(){const time=this.themeOffset+(this.themeSource?(this.context.currentTime-this.themeStarted):0);return this.themeBuffer?time%this.themeBuffer.duration:0;}
 get state(){const themePlaying=Boolean(this.enabled&&this.themeSource&&!document.hidden&&this.context?.state==='running');return {enabled:this.enabled,playing:themePlaying||Boolean(this.source),themePlaying,pencilPlaying:Boolean(this.source),themeTime:this.themeTime,themeDuration:this.themeBuffer?.duration||0,themeAsset:this.themeAsset||'',context:this.context?.state||'idle'};}
 emit(){if(!this.disposed)this.onChange(this.state);}
 setEnabled(enabled){
  this.enabled=enabled;
  if(enabled){const Context=window.AudioContext||window.webkitAudioContext;if(Context){
   if(!this.context){this.context=new Context({sampleRate:48000});this.context.addEventListener('statechange',()=>{this.sync();this.emit();},{signal:this.abort.signal});}
   this.context.resume().then(()=>{this.sync();this.emit();}).catch(()=>this.emit());
  }}
  this.sync();this.emit();
 }
 async decode(names){
  for(const name of names){try{const response=await fetch(asset(name),{signal:this.abort.signal});if(!response.ok)throw Error('Audio unavailable');const buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(this.disposed)return null;return {buffer,name};}catch(error){if(this.disposed||error.name==='AbortError')return null;}}
  return null;
 }
 async loadTheme(){
  if(this.themeBuffer||this.themeLoading||this.themeUnavailable||!this.context||this.disposed)return;this.themeLoading=true;
  const result=await this.decode(audioSettings.theme.sources);this.themeLoading=false;if(this.disposed)return;
  if(result){
   this.themeBuffer=result.buffer;this.themeAsset=result.name;const n=Math.min(Math.round(this.themeBuffer.sampleRate*audioSettings.theme.edgeFade),Math.floor(this.themeBuffer.length/2));
   for(let channel=0;channel<this.themeBuffer.numberOfChannels;channel++){const samples=this.themeBuffer.getChannelData(channel);for(let i=0;i<n;i++){const gain=Math.sin(i/Math.max(1,n-1)*Math.PI/2)**2;samples[i]*=gain;samples[samples.length-1-i]*=gain;}}
  }else this.themeUnavailable=true;
  this.sync();this.emit();
 }
 syncTheme(){
  if(this.disposed)return;const context=this.context,wanted=this.enabled&&!document.hidden&&context?.state==='running';
  if(!wanted){this.stopTheme(document.hidden);return;}
  if(!this.themeBuffer){this.loadTheme();return;}
  if(!this.themeSource){
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=this.themeBuffer;source.loop=true;gain.gain.setValueAtTime(0,context.currentTime);source.connect(gain);gain.connect(context.destination);this.themeSource=source;this.themeGain=gain;this.themeStarted=context.currentTime;source.start(0,this.themeOffset%source.buffer.duration);
   source.onended=()=>{source.disconnect();gain.disconnect();this.fadingSources.delete(source);if(this.themeSource===source){this.themeSource=null;clearInterval(this.themeClock);this.emit();}this.suspendWhenIdle();};
   clearInterval(this.themeClock);this.themeClock=setInterval(()=>this.emit(),250);this.emit();
  }
  const target=this.source?audioSettings.theme.duringDrawing:audioSettings.theme.volume;if(this.themeGainTarget!==target){this.themeGainTarget=target;this.themeGain.gain.setTargetAtTime(target,context.currentTime,audioSettings.theme.fade);}
 }
 stopTheme(immediate=false){
  const source=this.themeSource;if(!source)return;this.themeOffset=this.themeTime;this.themeSource=null;const gain=this.themeGain;this.themeGain=null;this.themeGainTarget=null;clearInterval(this.themeClock);
  gain.gain.cancelScheduledValues(this.context.currentTime);gain.gain.setValueAtTime(gain.gain.value,this.context.currentTime);gain.gain.linearRampToValueAtTime(0,this.context.currentTime+(immediate?0:.10));this.fadingSources.add(source);source.stop(this.context.currentTime+(immediate?0:.12));this.emit();
 }
 async loadPencil(){
  if(this.buffer||this.loading||this.pencilUnavailable||!this.context||this.disposed)return;this.loading=true;
  const result=await this.decode(audioSettings.pencil.sources);this.loading=false;if(this.disposed)return;if(result)this.buffer=result.buffer;else this.pencilUnavailable=true;this.sync();
 }
 bind(video){
  this.video=video;video.muted=true;const listen=(event,fn)=>video.addEventListener(event,fn,{signal:this.abort.signal});
  for(const event of ['pause','waiting','seeking','ended','emptied'])listen(event,()=>{this.running=false;this.stopPencil();this.syncTheme();});
  for(const event of ['playing','seeked'])listen(event,()=>{this.running=!video.paused&&video.readyState>=3;this.sync();});listen('timeupdate',()=>this.sync());
 }
 stopPencil(immediate=false){
  const source=this.source;if(!source)return;this.source=null;const gain=this.gain;gain.gain.setTargetAtTime(0,this.context.currentTime,.008);this.fadingSources.add(source);source.stop(this.context.currentTime+(immediate?0:.04));source.onended=()=>{source.disconnect();gain.disconnect();this.fadingSources.delete(source);this.suspendWhenIdle();};this.emit();
 }
 sync(){
  if(this.disposed)return;const video=this.video,context=this.context;
  if(!this.enabled||!this.running||!video||video.paused||video.ended||document.hidden||context?.state!=='running'){this.stopPencil(document.hidden);this.syncTheme();this.suspendWhenIdle();return;}
  if(!this.buffer){if(!this.pencilUnavailable)this.loadPencil();this.syncTheme();return;}
  const time=video.currentTime;if(time>=this.buffer.duration){this.stopPencil();this.syncTheme();return;}
  if(this.source&&Math.abs(this.offset+(context.currentTime-this.started)-time)<audioSettings.pencil.drift){this.syncTheme();return;}
  this.stopPencil();const source=context.createBufferSource(),gain=context.createGain();source.buffer=this.buffer;gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(audioSettings.pencil.volume,context.currentTime+.015);source.connect(gain);gain.connect(context.destination);this.source=source;this.gain=gain;this.offset=time;this.started=context.currentTime;source.start(0,time);source.onended=()=>{source.disconnect();gain.disconnect();this.fadingSources.delete(source);if(this.source===source){this.source=null;this.syncTheme();this.emit();}this.suspendWhenIdle();};this.syncTheme();this.emit();
 }
 // Retire nodes on the audio clock before suspension. A wall-clock timer can
 // suspend WebKit before a scheduled stop has actually reached its audio time.
 suspendWhenIdle(){if(!this.disposed&&!this.enabled&&!this.source&&!this.themeSource&&!this.fadingSources.size&&this.context?.state==='running')this.context.suspend().catch(()=>{});}
 dispose(){this.disposed=true;this.abort.abort();clearInterval(this.themeClock);this.stopTheme(true);this.stopPencil(true);this.themeBuffer=null;this.buffer=null;this.fadingSources.clear();this.context?.close();}
}
