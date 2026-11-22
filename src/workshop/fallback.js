import {drawStandingGuide} from '../guide-rig/proportions.js';
import {objects,workshopCopy,room} from './layout.js';
import {actorHeight,facing} from './actor-motion.js';
import {WorkshopNavigation,inside} from './navigation.js';
// Same-viewport static reading path for devices without a WebGL context.
export class WorkshopFallback{
 constructor(stage,onMode=()=>{},onPosition=()=>{}){this.onMode=onMode;this.onPosition=onPosition;this.root=document.createElement('section');this.root.id='workshop-fallback';this.root.hidden=true;stage.append(this.root);this.mode='castle';this.navigation=new WorkshopNavigation();this.root.addEventListener('click',e=>{if(e.target.closest('[data-fallback-enter]')){this.mode='workshop';this.render();this.onMode(this.mode);}if(e.target.closest('[data-fallback-return]')){this.mode='castle';this.render();this.onMode(this.mode);}if(e.target.closest('[data-fallback-floor]')){const r=this.root.querySelector('.workshop-fallback-art').getBoundingClientRect(),p=e.detail?[room.crop[0]+(e.clientX-r.x)/r.width*room.crop[2],room.crop[1]+(e.clientY-r.y)/r.height*room.crop[3]]:room.entry;this.walk(p);}});this.root.addEventListener('keydown',e=>{if(!e.target.hasAttribute('data-fallback-floor'))return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],Home:[-1,-1],PageUp:[1,-1],End:[-1,1],PageDown:[1,1]}[e.key];if(d){e.preventDefault();e.stopPropagation();const p=this.point||room.entry;this.walk([p[0]+d[0]*48,p[1]+d[1]*48],true);}});this.root.addEventListener('change',e=>{const o=objects.find(o=>o.id===e.target.value),from=this.getPoint();if(o){this.row=['book','fabric'].includes(o.kind)?facing(from,o.approach):facing(o.approach,[o.polygon.reduce((s,p)=>s+p[0],0)/o.polygon.length,o.polygon.reduce((s,p)=>s+p[1],0)/o.polygon.length]);this.point=[...o.approach];}this.selected=e.target.value;this.render();this.onPosition();this.root.querySelector('select')?.focus({preventScroll:true});});}
 sync({visible,lang,reset=false,direct=false}){this.lang=lang;this.root.hidden=!visible;if(reset){this.mode='castle';this.selected=null;this.point=null;this.row=6;}this.mode=direct?'workshop':'castle';if(visible)this.render();}
 getPoint(){return objects.find(o=>o.id===this.selected)?.approach||this.point||room.entry;}
 walk(point,keyboard=false){if(!keyboard&&!inside(point,room.floor))return;const key=this.navigation.nearest(point);if(key==null)return;const destination=this.navigation.walkable(point)?point:this.navigation.point(key),from=this.getPoint();if(Math.hypot(destination[0]-from[0],destination[1]-from[1])>.1)this.row=facing(from,destination);this.point=destination;this.selected=null;this.render();this.onPosition();this.root.querySelector('[data-fallback-floor]')?.focus({preventScroll:true});}
 render(){const t=workshopCopy[this.lang],selected=objects.find(o=>o.id===this.selected),point=selected?.approach||this.point||room.entry,tile=actorHeight(point)/230*256,row=this.row??6;this.root.setAttribute('aria-label',t.title);this.root.innerHTML=this.mode==='castle'?`<button data-fallback-enter>${t.title} →</button>`:`<div class="workshop-fallback-art"><img src="${import.meta.env.BASE_URL}assets/${room.assets[0]}" alt="${t.description}"><button class="workshop-fallback-floor" data-fallback-floor aria-label="${t.floor}" aria-describedby="fallback-floor-help" style="clip-path:polygon(${room.floor.map(p=>`${(p[0]-room.crop[0])/room.crop[2]*100}% ${(p[1]-room.crop[1])/room.crop[3]*100}%`).join(',')})"></button><p class="sr-only" id="fallback-floor-help">${t.floorHelp}</p><canvas width="256" height="256" class="workshop-fallback-guide" role="img" aria-label="${t.guide}" style="left:${(point[0]-tile/2-room.crop[0])/room.crop[2]*100}%;top:${(point[1]-tile*248/256-room.crop[1])/room.crop[3]*100}%;width:${tile/room.crop[2]*100}%;height:${tile/room.crop[3]*100}%"></canvas></div><div class="workshop-fallback-tools"><button data-fallback-return>‹ ${t.return}</button><label class="sr-only" for="workshop-fallback-select">${t.choose}</label><select id="workshop-fallback-select"><option value="">${t.choose}</option>${objects.map(o=>`<option value="${o.id}" ${o.id===this.selected?'selected':''}>${o.label[this.lang]}</option>`).join('')}</select></div>${selected?`<p class="workshop-fallback-description" role="status">${selected.label[this.lang]} · ${t.detail[selected.kind]}</p>`:''}`;this.position();
  const canvas=this.root.querySelector('.workshop-fallback-guide');
  if(canvas){
   if(!this.atlas){
    const image=new Image();
    image.src=import.meta.env.BASE_URL+'assets/guide-run-parts.webp';
    this.atlas=image.decode().then(()=>image).catch(()=>{this.atlas=null;return null;});
   }
   this.atlas.then(image=>{if(image&&canvas.isConnected)drawStandingGuide(canvas,image,row);});
  }
 }
 position(){
  if(this.root.hidden)return;
  const stage=this.root.parentElement,r=stage.querySelector('.spread')?.getBoundingClientRect();
  if(!r)return;
  const bounds=stage.getBoundingClientRect();
  const art=this.root.querySelector('.workshop-fallback-art');
  const portrait=Boolean(art)&&stage.dataset.readingPortrait==='true';
  const rect=(x,y,w,h)=>({left:`${x}px`,top:`${y}px`,width:`${w}px`,height:`${h}px`});
  const paper=rect(r.x-bounds.x,r.y-bounds.y,r.width,r.height);
  Object.assign(this.root.style,portrait?rect(0,0,bounds.width,bounds.height):paper);
  if(art){
   if(portrait)Object.assign(art.style,paper);
   else art.removeAttribute('style');
  }
 }
 dispose(){this.root.remove();}
}
