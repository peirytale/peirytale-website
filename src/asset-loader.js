import {laterStages} from './content/loading.js';
const asset=name=>`${import.meta.env.BASE_URL}assets/${name}`;
export class AssetLoader{
 constructor(onProgress=()=>{}){this.onProgress=onProgress;this.abort=new AbortController();this.stages=new Map();this.urls=new Map();this.cache=new Map();this.videoProgress=new Map();}
 async fetchBytes(name,onBytes=()=>{}){
  const response=await fetch(asset(name),{signal:this.abort.signal});if(!response.ok)throw Error(`Unable to load ${name}`);
  const length=Number(response.headers.get('content-length'))||0,reader=response.body?.getReader();if(!reader){const blob=await response.blob();onBytes(blob.size,blob.size);return blob;}
  const chunks=[];let total=0;for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);total+=value.byteLength;onBytes(total,length);}return new Blob(chunks,{type:response.headers.get('content-type')||''});
 }
 load(name,onBytes){if(!this.cache.has(name)){const task=this.fetchBytes(name,onBytes).catch(error=>{this.cache.delete(name);throw error;});this.cache.set(name,task);}return this.cache.get(name);}
 async verifyVideo(url){
  const video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;
  try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Video decoder timed out')),12000);video.addEventListener('loadeddata',()=>{clearTimeout(timer);resolve();},{once:true});video.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Video decoder unavailable'));},{once:true});video.src=url;video.load();});}
  finally{video.removeAttribute('src');video.load();}
 }
 async prepareVideo(){
  if(this.video)return this.video;
  const video=document.createElement('video');const names=video.canPlayType('video/mp4; codecs="avc1.64001f"')?['castle-page-film.mp4','castle-page-film.webm']:['castle-page-film.webm','castle-page-film.mp4'];
  const results=await Promise.allSettled(names.map(async name=>{
   const blob=await this.load(name,(loaded,total)=>{this.videoProgress.set(name,{loaded,total});const items=names.map(key=>this.videoProgress.get(key));if(items.every(item=>item?.total))this.onProgress({loaded:items.reduce((sum,item)=>sum+item.loaded,0),total:items.reduce((sum,item)=>sum+item.total,0)});});
   const url=URL.createObjectURL(blob),previous=this.urls.get(name);if(previous)URL.revokeObjectURL(previous);this.urls.set(name,url);return {name,url};
  }));
  const fetched=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
  if(fetched.length===names.length){for(const item of fetched){try{await this.verifyVideo(item.url);return this.video={name:item.name,url:item.url,urls:Object.fromEntries(fetched.map(entry=>[entry.name,entry.url]))};}catch{}}}
  throw Error('Castle video unavailable');
 }
 startStage(stage){if(this.stages.has(stage))return this.stages.get(stage);const task=Promise.allSettled((laterStages[stage]||[]).map(name=>this.load(name)));this.stages.set(stage,task);return task;}
 dispose(){this.abort.abort();for(const url of this.urls.values())URL.revokeObjectURL(url);this.urls.clear();}
}
