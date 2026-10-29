import './style.css';
import {copy,sequence,pageTypography,pageTextRows} from './content/book.js';
import {BookScene} from './book-scene.js';
const app=document.querySelector('#app');
const stored=(k,d)=>{try{return localStorage.getItem(k)||d}catch{return d}};
const save=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
let lang=new URLSearchParams(location.search).get('lang')||stored('peiry-language','zh-TW');if(!copy[lang])lang='zh-TW';
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
let quiet=motionQuery.matches||stored('peiry-quiet','false')==='true';
let index=-1,targetIndex=-1,playing=false,paused=false,turning=false,contents=false,run=0,navigation=0,scene,rotationDrag,touch;
const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.innerHTML='<main class="stage"><canvas id="world" aria-hidden="true"></canvas><div id="book-ui"></div><div id="cover-copy" class="cover-heading"></div><p id="announcement" class="sr-only" aria-live="polite"></p></main>';
const canvas=document.querySelector('#world'),ui=document.querySelector('#book-ui'),coverCopy=document.querySelector('#cover-copy');
ui.style.setProperty('--printed-label-top',`${pageTypography.layout.labelY/1408*100}%`);ui.style.setProperty('--printed-heading-top',`${pageTypography.layout.headingY/1408*100}%`);ui.style.setProperty('--printed-center',`${pageTypography.layout.x/1024*100}%`);
ui.style.setProperty('--cover-image',`url("${import.meta.env.BASE_URL}assets/storybook-cover.webp")`);
canvas.addEventListener('bookresize',({detail:r})=>{ui.style.setProperty('--book-width',`${r.width}px`);ui.style.setProperty('--book-height',`${r.height}px`);});
try{scene=new BookScene(canvas,()=>document.documentElement.dataset.texture='ready');document.documentElement.dataset.renderer='webgl';}
catch(error){document.documentElement.dataset.renderer='fallback';document.documentElement.dataset.texture='ready';console.warn('WebGL unavailable; using accessible book pages.',error.message);}
function render(){
 const t=copy[lang],page=t.chapters[index],printed=page?pageTextRows(page):null;
 document.documentElement.lang=lang;document.documentElement.dataset.quiet=quiet;document.documentElement.dataset.open=String(index>=0);
 document.documentElement.dataset.coverVisible=String(index<0&&!turning);
 coverCopy.setAttribute('aria-hidden',String(index>=0||turning||contents));coverCopy.inert=contents;
 if(coverCopy.lang!==lang){coverCopy.lang=lang;coverCopy.innerHTML=`<span class="eyebrow">${t.coverEyebrow}</span><h1>${t.coverHeading}</h1>`;}
 document.title=t.title;for(const sel of ['meta[name="description"]','meta[property="og:description"]'])document.querySelector(sel)?.setAttribute('content',t.description);document.querySelector('meta[property="og:title"]')?.setAttribute('content',t.title);
 ui.dataset.playing=String(playing);ui.dataset.paused=String(paused);ui.dataset.page=page?.id||'cover';ui.classList.toggle('turning',turning);
 ui.innerHTML=`<header><a href="#cover" class="wordmark" aria-label="Peiry Tale"><img src="${import.meta.env.BASE_URL}assets/brand-logo.webp" alt="" width="48" height="48"><span class="wordmark-name">Peiry Tale<span>THE EVERYDAY FAIRYTALE</span></span></a><nav aria-label="${t.contents}"><button data-action="contents" aria-expanded="${contents}">${t.contents}</button><button data-action="language">${t.language}</button><button data-action="quiet" aria-pressed="${quiet}">${quiet?t.motion:t.quiet}</button></nav></header>
 ${index<0?`<section class="cover-ui" aria-label="Peiry Tale"><div class="fallback-cover" aria-hidden="true"></div><button class="open-book" data-action="open">${t.open} <span aria-hidden="true">↗</span></button></section><div class="book-rotation" tabindex="0" role="group" aria-label="${t.rotateBook}" aria-describedby="rotation-help"></div><span id="rotation-help" class="sr-only">${t.rotateHelp}</span><span class="rotation-hint">${t.rotateHint}</span>`:
 `<section class="spread" aria-label="${page.label}" aria-busy="${turning}" data-left="${page.left}" data-right="${page.right}"><div class="fallback-leaf left-leaf ${page.left}" aria-hidden="true"></div><div class="right-leaf ${page.right}"><div class="page-copy" ${page.heading?'':'hidden'}><p class="printed-label eyebrow">${e(printed.label)}</p><h1 id="page-title" class="printed-heading ${page.id==='title-page'?'page-subtitle':''}" tabindex="-1">${printed.lines.map(line=>`<span class="printed-line">${e(line)}</span>`).join(' ')}</h1></div></div></section>
 <nav class="page-navigation" aria-label="${t.contents}"><button data-action="previous" aria-label="${index===0?t.cover:t.previous}">←</button><span class="page-state">${page.label}</span><button data-action="next" aria-label="${index===4?t.cover:t.next}">→</button></nav>
 <div class="playback-controls">${playing?`<button data-action="pause" aria-pressed="${paused}">${paused?t.resume:t.pause}</button><button data-action="skip">${t.skip}</button>`:`<button data-action="replay">${t.replay}</button>`}</div>`}
 ${index<0&&playing?`<div class="playback-controls"><button data-action="pause" aria-pressed="${paused}">${paused?t.resume:t.pause}</button><button data-action="skip">${t.skip}</button></div>`:''}
 ${contents?`<section class="contents" role="dialog" aria-modal="true" aria-labelledby="contents-title"><h2 id="contents-title">${t.contents}</h2><a href="#cover">${t.cover}</a>${t.chapters.map(p=>`<a href="#${p.id}" ${page?.id===p.id?'aria-current="page"':''}>${p.label}</a>`).join('')}<button data-action="dismiss">${t.close} ×</button></section>`:''}`;
 if(contents){const modal=ui.querySelector('.contents');for(const child of ui.children)if(child!==modal)child.inert=true;}
}
function announce(){document.querySelector('#announcement').textContent=index<0?copy[lang].cover:copy[lang].chapters[index].label;}
function address(){history.replaceState(null,'',`?lang=${lang}#${index<0?'cover':copy[lang].chapters[index].id}`);}
async function stop(){run++;playing=false;paused=false;scene?.setPaused(false);await scene?.finishMotion();index=targetIndex;turning=false;}
async function move(next,{immediate=false,duration=sequence.leafTurn}={}){
 const page=copy[lang].chapters[next];targetIndex=next;turning=true;render();
 if(next<0)await scene?.close(quiet||immediate);
 else if(index<0){scene?.setSpread(page,next,lang);await scene?.open(quiet||immediate,sequence.opening);}
 else await scene?.turn(page,next,lang,{duration,quiet:quiet||immediate});
 index=next;turning=false;render();address();announce();
}
async function go(next,{immediate=false}={}){
 if(next<-1||next>4)return;const ticket=++navigation;await stop();if(ticket!==navigation)return;contents=false;
 if(next!==index)await move(next,{immediate});else render();
 document.querySelector('#page-title')?.focus({preventScroll:true});
}
async function hold(ms,id){
 if(id!==run)return false;
 if(scene)await scene.animate(ms,()=>{},{linear:true,paint:false});
 else await new Promise(resolve=>setTimeout(resolve,ms));
 return id===run;
}
async function intro(){
 const ticket=++navigation;await stop();if(ticket!==navigation)return;contents=false;
 if(index>=0)await move(-1,{immediate:true});
 if(quiet||!scene){await move(2,{immediate:true});return;}
 const id=++run;playing=true;paused=false;
 await move(0);if(id!==run)return;
 if(!await hold(sequence.firstPause,id))return;
 await move(1);if(id!==run)return;
 if(!await hold(sequence.mixedPause,id))return;
 turning=true;targetIndex=2;render();await scene.riffle(copy[lang].chapters[2],2,lang,sequence.riffling);if(id!==run)return;
 index=2;turning=false;render();address();announce();
 if(!await hold(sequence.titlePause,id))return;
 await move(3);if(id!==run)return;
 if(!await hold(sequence.prologuePause,id))return;
 await move(4);if(id!==run)return;
 playing=false;render();
}
ui.addEventListener('click',async ev=>{
 const anchor=ev.target.closest('a[href^="#"]');if(anchor){ev.preventDefault();const i=copy[lang].chapters.findIndex(p=>p.id===anchor.hash.slice(1));await go(i);return;}
 const b=ev.target.closest('button');if(!b)return;const action=b.dataset.action;
 if(action==='open'||action==='replay'){intro();return;}
 if(action==='pause'){paused=!paused;scene?.setPaused(paused);render();ui.querySelector('[data-action=pause]')?.focus();return;}
 if(action==='skip'){await go(2,{immediate:true});return;}
 if(action==='next'){await go(targetIndex===4?-1:targetIndex+1);return;}
 if(action==='previous'){await go(targetIndex-1);return;}
 if(action==='language'){
  await stop();lang=lang==='en'?'zh-TW':'en';save('peiry-language',lang);if(index>=0)scene?.setSpread(copy[lang].chapters[index],index,lang);render();address();ui.querySelector('[data-action=language]')?.focus();return;
 }
 if(action==='quiet'){
  const wasPlaying=playing;await stop();quiet=!quiet;save('peiry-quiet',String(quiet));if(wasPlaying&&quiet)await go(2,{immediate:true});render();ui.querySelector('[data-action=quiet]')?.focus();return;
 }
 if(action==='contents'){if(playing){paused=true;scene?.setPaused(true);}contents=!contents;render();ui.querySelector('.contents a')?.focus();return;}
 if(action==='dismiss'){contents=false;render();ui.querySelector('[data-action=contents]')?.focus();}
});
window.addEventListener('keydown',ev=>{
 if(contents){
  if(ev.key==='Escape'){contents=false;render();ui.querySelector('[data-action=contents]')?.focus();return;}
  if(ev.key==='Tab'){const nodes=[...ui.querySelectorAll('.contents a,.contents button')],first=nodes[0],last=nodes.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}
  return;
 }
 if(index<0&&!turning&&ev.target.closest('.book-rotation')){
  const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[ev.key];if(d){ev.preventDefault();scene?.rotateInspection(...d);return;}
  if(ev.key==='Home'){ev.preventDefault();scene?.resetInspection();return;}
  if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();intro();return;}
 }
 if(ev.key==='ArrowRight'){ev.preventDefault();go(targetIndex===4?-1:targetIndex+1);}
 if(ev.key==='ArrowLeft'&&targetIndex>=0){ev.preventDefault();go(targetIndex-1);}
});
ui.addEventListener('pointerdown',ev=>{
 if(index<0&&!turning&&ev.target.closest('.book-rotation')&&ev.isPrimary&&ev.button===0){rotationDrag={id:ev.pointerId,x:ev.clientX,y:ev.clientY};ui.setPointerCapture(ev.pointerId);ev.preventDefault();return;}
 if(ev.pointerType==='touch'&&index>=0&&!ev.target.closest('button,a,.contents'))touch={x:ev.clientX,y:ev.clientY};
});
ui.addEventListener('pointermove',ev=>{if(rotationDrag?.id!==ev.pointerId)return;scene?.rotateInspection(ev.clientX-rotationDrag.x,ev.clientY-rotationDrag.y);rotationDrag.x=ev.clientX;rotationDrag.y=ev.clientY;ev.preventDefault();});
ui.addEventListener('pointerup',ev=>{
 if(rotationDrag){rotationDrag=null;if(ui.hasPointerCapture(ev.pointerId))ui.releasePointerCapture(ev.pointerId);return;}
 if(!touch)return;const dx=ev.clientX-touch.x,dy=ev.clientY-touch.y;touch=null;if(Math.abs(dx)>65&&Math.abs(dy)<45)go(dx<0?(targetIndex===4?-1:targetIndex+1):targetIndex-1);
});
ui.addEventListener('pointercancel',()=>{rotationDrag=null;touch=null;});
window.addEventListener('blur',()=>{rotationDrag=null;touch=null;});
window.addEventListener('hashchange',()=>go(copy[lang].chapters.findIndex(p=>p.id===location.hash.slice(1)),{immediate:quiet}));
motionQuery.addEventListener('change',async ev=>{if(ev.matches){await stop();quiet=true;render();}});
render();if(location.hash&&location.hash!=='#cover')go(copy[lang].chapters.findIndex(p=>p.id===location.hash.slice(1)),{immediate:true});
