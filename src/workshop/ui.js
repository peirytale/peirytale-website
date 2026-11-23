import {teacupCopy} from '../content/teacup-dress.js';
import {objects,workshopCopy,toPage,room} from './layout.js';
import {inside} from './navigation.js';

const hotspots=[{id:'__floor__',polygon:room.floor},...objects].map(({id,polygon})=>{
 const points=polygon.map(toPage),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y;
 const clipPath=`polygon(${points.map(p=>`${(p[0]-x)/width*100}% ${(p[1]-y)/height*100}%`).join(',')})`;
 return {id,x,y,width,height,clipPath};
});
const rect=(x,y,width,height)=>({left:`${x}px`,top:`${y}px`,width:`${width}px`,height:`${height}px`});

export class WorkshopUI{
 constructor(stage,book,chapter,getLanguage,announce){this.book=book;this.chapter=chapter;this.lang=getLanguage;this.announce=announce;this.root=document.createElement('section');this.root.id='workshop-ui';this.root.hidden=true;stage.append(this.root);this.abort=new AbortController();this.root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-floor')){const q=event.detail?this.book.unprojectPagePoint(event.clientX,event.clientY):toPage(room.entry);if(q)this.walk([room.crop[0]+q[0]/960*room.crop[2],room.crop[1]+q[1]/672*room.crop[3]]);return;}if(b.matches('[data-teacup-outfit],[data-guide-outfit]')){
 this.chapter.actor.changeOutfit();
 return;
}if(b.dataset.object)this.select(b.dataset.object);if(b.dataset.workshop==='return'){chapter.onReturn?.();}if(b.dataset.workshop==='retry'){if(chapter.directRequested)chapter.onRetryDirect?.();else chapter.prepare();}if(b.dataset.workshop==='close')this.closeDescription();},{signal:this.abort.signal});this.root.addEventListener('keydown',e=>{if(e.target.hasAttribute?.('data-floor')){const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],Home:[-1,-1],PageUp:[1,-1],End:[-1,1],PageDown:[1,1]}[e.key];if(d){e.preventDefault();e.stopPropagation();const p=this.chapter.actor.getPosition();this.walk([p[0]+d[0]*48,p[1]+d[1]*48],true);return;}}if(e.key==='Escape'&&this.description){e.stopPropagation();this.closeDescription();}},{signal:this.abort.signal});}
 closeDescription(){
  this.description=false;
  this.render();
  const selected=this.hits.find(({button})=>button.dataset.object===this.chapter.workshop.selected)?.button;
  (selected?.tabIndex===0?selected:this.root.querySelector('[data-floor]'))?.focus({preventScroll:true});
 }
 select(id){const c=this.chapter,w=c.workshop;if(c.mode!=='workshop')return;this.description=false;const request=w.beginInteraction(id,{onActivate:data=>{if(c.mode!=='workshop')return;this.description=true;this.announce(workshopCopy[this.lang()].arrived+data.label[this.lang()]);this.render();}});if(!request)return;this.lastPlan=request.plan;this.render();const proceed=this.root.dispatchEvent(new CustomEvent('workshop:interact',{bubbles:true,cancelable:true,detail:request}));if(!proceed)return;if(w.actorAdapter?.moveTo){if(!c.quiet)this.announce(workshopCopy[this.lang()].moving+objects.find(o=>o.id===id).label[this.lang()]);Promise.resolve(w.actorAdapter.moveTo(request.plan,{signal:request.signal})).then(request.activate).catch(error=>{if(!request.signal.aborted)console.warn('Workshop approach interrupted.',error.message);});}else request.activate();}
 walk(point,keyboard=false){
  const c=this.chapter,w=c.workshop;if(c.mode!=='workshop'||!keyboard&&!inside(point,room.floor))return;
  this.description=false;const t=workshopCopy[this.lang()],request=w.beginWalk(point,{onActivate:()=>{this.announce(workshopCopy[this.lang()].floorArrived);this.render();}});if(!request)return;
  this.lastPlan=request.plan;this.render();this.announce(t.floorMoving);
  const proceed=this.root.dispatchEvent(new CustomEvent('workshop:walk',{bubbles:true,cancelable:true,detail:request}));if(!proceed)return;
  Promise.resolve(w.actorAdapter.moveTo(request.plan,{signal:request.signal})).then(request.activate).catch(error=>{if(!request.signal.aborted)console.warn('Workshop walk interrupted.',error.message);});
 }
 sync(visible=true){this.visible=visible;const show=visible&&(this.chapter.directRequested||this.chapter.mode==='workshop'||this.chapter.mode==='castle'&&this.chapter.adventure.state==='lit'&&!this.chapter.workshop.loaded);this.root.hidden=!show;if(show)this.render();}
 render(){const lang=this.lang(),t=workshopCopy[lang],c=this.chapter,w=c.workshop,selected=objects.find(o=>o.id===w.selected);this.root.setAttribute('aria-label',t.title);this.root.dataset.mode=c.mode;
  if(c.mode!=='workshop'){const error=c.error;this.hitPlane=null;this.guideHit=null;this.root.innerHTML=`<div class="workshop-loading" role="status"><span>${error?t.error:t.loading}</span>${error?`<button data-workshop="retry">${t.retry}</button>`:''}<button data-workshop="return">${t.return}</button></div>`;this.position();return;}
  const active=document.activeElement;
  let focus=null;
  if(this.root.contains(active)){
   if(active.hasAttribute('data-floor'))focus='[data-floor]';
   if(active.hasAttribute('data-guide-outfit'))focus='[data-guide-outfit]';
   if(active.hasAttribute('data-teacup-outfit'))focus='[data-teacup-outfit]';
   if(active.dataset.object)focus=`.workshop-hit[data-object="${active.dataset.object}"]`;
  }
  const actor=c.actor,entering=actor.state==='entering'||actor.state==='hidden';
  const outfit=teacupCopy[lang],locked=entering||Boolean(actor.change);
  this.root.innerHTML=`<p class="sr-only" id="workshop-floor-help">${t.floorHelp}</p><h2 class="sr-only">${t.title}</h2><p class="sr-only">${t.description}</p><div class="workshop-hit-plane"><div class="workshop-shield" aria-hidden="true"></div><button class="workshop-floor" data-floor aria-label="${t.floor}" aria-describedby="workshop-floor-help"></button><div class="workshop-objects" role="group" aria-label="${t.choose}">${[...objects].sort((a,b)=>a.depth-b.depth).map(o=>`<button class="workshop-hit" data-object="${o.id}" aria-label="${o.label[lang]}" aria-pressed="${w.selected===o.id}"></button>`).join('')}</div><button type="button" class="workshop-hit workshop-guide-hit" data-guide-outfit aria-label="${actor.wearDress?outfit.actorRestore:outfit.actorWear}" aria-disabled="${locked}" ${entering?'hidden':''}></button></div>${selected&&this.description?`<div class="workshop-description" role="status"><strong>${selected.label[lang]}</strong><span>${t.detail[selected.kind]}</span>${selected.id==='dress-teacups'?`<button type="button" data-teacup-outfit aria-disabled="${locked}">${teacupCopy[lang][c.actor.wearDress?'restore':'wear']}</button>`:''}<button data-workshop="close" aria-label="${t.close}">×</button></div>`:''}`;
  this.hitPlane=this.root.querySelector('.workshop-hit-plane');
  this.guideHit=this.hitPlane.querySelector('[data-guide-outfit]');
  Object.assign(this.hitPlane.style,rect(0,0,...room.size));
  this.hits=hotspots.map(({id,x,y,width,height,clipPath})=>{
   const button=this.hitPlane.querySelector(id==='__floor__'?'[data-floor]':`.workshop-hit[data-object="${id}"]`);
   Object.assign(button.style,rect(x,y,width,height),{clipPath});
   return {button,x,y,width,height};
  });
  this.position();if(focus){
   const previous=this.root.querySelector(focus);
   if(previous?.tabIndex===0)previous.focus({preventScroll:true});
   else this.root.querySelector('[data-floor]')?.focus({preventScroll:true});
  }
 }
 position(){
  if(this.root.hidden)return;
  const stage=this.root.parentElement,portrait=stage.dataset.readingPortrait==='true';
  const project=this.book.pageProjection();
  const corners=[[8,8],[952,8],[952,664],[8,664]].map(project);
  const left=Math.min(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y));
  const width=Math.max(...corners.map(p=>p.x))-left,height=Math.max(...corners.map(p=>p.y))-top;
  Object.assign(this.root.style,portrait?rect(0,0,this.book.width,this.book.height):rect(left,top,width,height));
  if(!this.hitPlane)return;
  const origin=project([0,0]),right=project([1,0]),bottom=project([0,1]);
  const a=right.x-origin.x,b=right.y-origin.y,c=bottom.x-origin.x,d=bottom.y-origin.y;
  this.hitPlane.style.transform=`matrix(${a},${b},${c},${d},${origin.x-(portrait?0:left)},${origin.y-(portrait?0:top)})`;
  this.positionGuide(true);
  for(const {button,x,y,width,height} of this.hits){
   const minX=origin.x+a*x+c*y+Math.min(0,a*width)+Math.min(0,c*height);
   const minY=origin.y+b*x+d*y+Math.min(0,b*width)+Math.min(0,d*height);
   const maxX=minX+Math.abs(a*width)+Math.abs(c*height),maxY=minY+Math.abs(b*width)+Math.abs(d*height);
   const clipped=portrait&&(maxX<=0||minX>=this.book.width||maxY<=0||minY>=this.book.height);
   const tabIndex=clipped?-1:0;
   if(button.tabIndex!==tabIndex)button.tabIndex=tabIndex;
  }
 }
 positionGuide(reproject=false){
  const button=this.guideHit;
  if(this.root.hidden||!button||button.hidden)return;
  const actor=this.chapter.actor,[x,y]=actor.position,height=actor.height;
  const key=`${x},${y},${height}`;
  if(!reproject&&button.dataset.bounds===key)return;
  const [left,top]=toPage([x-height*.32,y-height*.99]);
  const [right,bottom]=toPage([x+height*.32,y+height*.035]);
  const bounds=[left,top,right-left,bottom-top];
  if(button.dataset.bounds!==key){
   Object.assign(button.style,rect(...bounds));
   button.dataset.bounds=key;
  }
  const r=button.getBoundingClientRect(),stage=this.root.parentElement.getBoundingClientRect();
  const visible=r.right>stage.left&&r.left<stage.right&&r.bottom>stage.top&&r.top<stage.bottom;
  if(button.tabIndex!==Number(visible)-1)button.tabIndex=visible?0:-1;
 }
 dispose(){this.abort.abort();this.root.remove();}
}
