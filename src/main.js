import './style.css';
import {copy,sequence,pageTypography,pageTextRows,chapterIndex} from './content/book.js';
import {BookScene} from './book-scene.js';
import {Music} from './music.js';
import {pageFilmCopy} from './content/page-film.js';
import {AssetLoader} from './asset-loader.js';
import {loadingCopy} from './content/loading.js';
import {adventure as adventureConfig,adventureCopy} from './castle-adventure/config.js';
const app=document.querySelector('#app');
const stored=(k,d)=>{try{return localStorage.getItem(k)||d}catch{return d}};
const save=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
let lang=new URLSearchParams(location.search).get('lang')||stored('peiry-language','zh-TW');if(!copy[lang])lang='zh-TW';
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
let quiet=motionQuery.matches;
let index=-1,targetIndex=-1,playing=false,turning=false,contents=false,run=0,navigation=0,scene,rotationDrag,pageDrag,suppressPageClick=false;
let film,filmPromise,rig,rigPromise,adventure,rigHandoff=false,filmCompletionAnnounced=false,startupReady=false,preloadedVideo=null;
const music=new Music(updateMusic);
const loader=new AssetLoader(({loaded,total})=>{const progress=document.querySelector('#loading-progress');if(progress){if(total){progress.value=Math.min(90,Math.floor(loaded/total*90));progress.textContent=`${progress.value}%`;}else progress.removeAttribute('value');}});
const rigTest=new URLSearchParams(location.search).has('rig-test');
const filmTest=rigTest||import.meta.env.DEV&&new URLSearchParams(location.search).has('film-test');
const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.innerHTML=`<main class="stage"><canvas id="world" aria-hidden="true"></canvas><div id="book-ui"></div><div class="rotation-arrows" aria-hidden="true"><svg class="rotation-arrow left" viewBox="0 0 64 72"><defs><linearGradient id="arrow-ink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e0cbbc"/><stop offset=".55" stop-color="#a98280"/><stop offset="1" stop-color="#735e60"/></linearGradient></defs><path d="M51 11C27 13 16 25 16 39c0 10 6 16 17 19"/><path d="m25 50 9 9-12 3"/></svg><svg class="rotation-arrow right" viewBox="0 0 64 72"><path d="M51 11C27 13 16 25 16 39c0 10 6 16 17 19"/><path d="m25 50 9 9-12 3"/></svg></div><div id="cover-copy" class="cover-heading"></div><button id="open-prompt" class="open-book" data-action="open"></button><p id="announcement" class="sr-only" aria-live="polite"></p></main>`;
const canvas=document.querySelector('#world'),ui=document.querySelector('#book-ui'),coverCopy=document.querySelector('#cover-copy'),openPrompt=document.querySelector('#open-prompt'),arrows=document.querySelector('.rotation-arrows');
const castleHit=document.createElement('button');
castleHit.id='castle-enter';castleHit.hidden=true;castleHit.dataset.action='castle-enter';app.querySelector('.stage').append(castleHit);
let announcedAdventure='idle';
function syncAdventureUI(state){
 if(!scene)return;
 if(state){canvas.dataset.adventureState=state.state;canvas.dataset.adventureTime=state.time.toFixed(3);if(scene.pageFilm===adventure){scene.filmMap.value=adventure.texture;scene.dirty=true;}if(state.state!==announcedAdventure){announcedAdventure=state.state;const message={approaching:'running',pushing:'pushing',lit:'lit'}[state.state];if(message)document.querySelector('#announcement').textContent=adventureCopy[lang][message];}}
 const visible=startupReady&&index===4&&!turning&&!contents&&!playing&&canvas.dataset.rigHandoff==='complete';
 castleHit.hidden=!visible||!adventure?.loaded;castleHit.disabled=adventure?.state!=='idle';castleHit.setAttribute('aria-label',adventureCopy[lang].enter);
 if(visible){const points=adventureConfig.hitPolygon.map(p=>scene.projectPagePoint(...p)),xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left,h=Math.max(...ys)-top;Object.assign(castleHit.style,{left:`${left}px`,top:`${top}px`,width:`${w}px`,height:`${h}px`,clipPath:`polygon(${points.map(p=>`${(p.x-left)/w*100}% ${(p.y-top)/h*100}%`).join(',')})`});}
}
castleHit.addEventListener('click',()=>{if(adventure?.start()){scene.filmMap.value=adventure.texture;scene.dirty=true;}});
canvas.addEventListener('bookresize',()=>syncAdventureUI());
ui.style.setProperty('--printed-label-top',`${pageTypography.layout.labelY/1408*100}%`);ui.style.setProperty('--printed-heading-top',`${pageTypography.layout.headingY/1408*100}%`);ui.style.setProperty('--printed-center',`${pageTypography.layout.x/1024*100}%`);
ui.style.setProperty('--cover-image',`url("${import.meta.env.BASE_URL}assets/storybook-cover.webp")`);
canvas.addEventListener('bookresize',({detail:r})=>{ui.style.setProperty('--book-width',`${r.width}px`);ui.style.setProperty('--book-height',`${r.height}px`);ui.style.setProperty('--book-center-y',`${r.y}px`);openPrompt.style.setProperty('--book-height',`${r.height}px`);arrows.style.setProperty('--book-height',`${r.height}px`);});
try{scene=new BookScene(canvas,()=>document.documentElement.dataset.texture='ready');document.documentElement.dataset.renderer='webgl';}
catch(error){document.documentElement.dataset.renderer='fallback';document.documentElement.dataset.texture='ready';console.warn('WebGL unavailable; using accessible book pages.',error.message);}
if(filmTest&&scene)window.__peiryBook=scene;
function updateMusic(state){
 const button=ui.querySelector('[data-action=music]');if(button){const label=state.enabled?copy[lang].musicOff:copy[lang].musicOn;button.querySelector('.music-label').textContent=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(state.enabled));}
 if(typeof canvas!=='undefined'){canvas.dataset.musicEnabled=String(state.enabled);canvas.dataset.musicPlaying=String(state.playing);canvas.dataset.musicContext=state.context;canvas.dataset.musicThemePlaying=String(state.themePlaying);canvas.dataset.musicPencilPlaying=String(state.pencilPlaying);canvas.dataset.musicThemeTime=state.themeTime.toFixed(3);canvas.dataset.musicThemeDuration=state.themeDuration.toFixed(3);canvas.dataset.musicThemeAsset=state.themeAsset;}
}
function forwardLocked(){return index===4&&Boolean(scene)&&!quiet&&(!film||!film.complete);}
function syncNavigation(){const next=ui.querySelector('[data-action=next]');if(next)next.disabled=turning||forwardLocked();canvas.dataset.nextLocked=String(forwardLocked());}
function advance(){if(!forwardLocked())go(targetIndex===4?-1:targetIndex+1);}
function prepareRig(){
 rigPromise??=Promise.all([import('./castle-rig/controller.js'),import('./castle-adventure/controller.js')]).then(async([{CastleRig},{CastleAdventure}])=>{rig=new CastleRig(scene.renderer,()=>scene.dirty=true,()=>{canvas.dataset.rigActive=String(Boolean(rig?.active));canvas.dataset.rigMode=rig?.mode||'loading';});if(rigTest){window.__peiryCastleRig=rig;window.__peiryBook=scene;}await rig.ready;const [atlas,flow]=await Promise.all([loader.load(adventureConfig.atlas),loader.load(adventureConfig.flowAtlas)]);adventure=new CastleAdventure(rig,syncAdventureUI,atlas,flow);if(rigTest)window.__peiryCastleAdventure=adventure;await adventure.ready;canvas.dataset.rigReady='true';return rig;});return rigPromise;
}
async function handoffRig(){
 if(rigHandoff)return;rigHandoff=true;
 try{await prepareRig();if(rig.disposed||film.disposed)return;film.tick();rig.capture(film.texture);
 // Let the existing completion glints finish before the local-only loop starts.
 const canAttach=await new Promise(resolve=>{const settled=()=>{if(rig.disposed||film.disposed){resolve(false);return;}if(index===4&&!turning&&!contents&&!playing&&scene.bindingMotion==='open'&&!scene.animation&&(!scene.completion||quiet)){resolve(true);return;}requestAnimationFrame(settled);};requestAnimationFrame(settled);});if(!canAttach)return;
 if(rig.disposed||film.disposed)return;scene.attachPageFilm(adventure);rig.resume();adventure.setActive(startupReady&&index===4&&!turning&&!contents&&!playing,quiet);canvas.dataset.rigHandoff='complete';syncAdventureUI();
 }catch(error){rigHandoff=false;console.warn('Local castle animation unavailable; keeping completed artwork.',error.message);}
}
function filmState(state){if(scene&&state.state==='playing')prepareRig().catch(()=>{});if(scene&&state.state==='finished'&&(film?.finishedNaturally||(quiet&&film?.complete)))handoffRig();if(state.active&&(state.state==='playing'||(quiet&&state.state==='finished')))loader.startStage('castlePlaying');canvas.dataset.filmState=state.state;canvas.dataset.filmTime=state.time.toFixed(4);canvas.dataset.filmActive=String(state.active);canvas.dataset.filmFrames=String(state.frames);canvas.dataset.filmSource=state.source;canvas.dataset.filmGeneration=String(state.generation);canvas.dataset.filmRecoveries=String(state.recoveries);canvas.dataset.filmPresentedTime=state.presentedTime.toFixed(4);syncNavigation();if(state.state==='finished'&&state.active&&film?.finishedNaturally&&!filmCompletionAnnounced){filmCompletionAnnounced=true;announce();}if(state.state==='finished'&&state.active&&film?.finishedNaturally&&!quiet)scene?.startCompletionSparkle();}
async function syncFilm(){
 const active=()=>startupReady&&index===4&&!turning&&!contents&&!playing;film?.setActive(active(),quiet);
 if(rigHandoff&&film&&!film.complete){adventure?.cancel();rigHandoff=false;delete canvas.dataset.rigHandoff;scene.attachPageFilm(film);}
 if(index!==4||turning)adventure?.cancel();adventure?.setActive(Boolean(rigHandoff&&canvas.dataset.rigHandoff==='complete'&&active()),quiet);syncAdventureUI();
 if(!scene||index<2||film)return;
 filmPromise??=import('./page-film/controller.js').then(({PageFilm})=>{film=new PageFilm(scene.renderer,()=>scene.dirty=true,filmState,preloadedVideo);scene.attachPageFilm(film);music.bind(film.video);if(filmTest){window.__peiryPageFilm=film;window.__peiryBook=scene;}film.setActive(active(),quiet);return film;});
 await filmPromise;
}
canvas.addEventListener('webglcontextlost',()=>{film?.setActive(false);adventure?.setActive(false,quiet);});
canvas.addEventListener('webglcontextrestored',()=>{film?.restore();rig?.restore();adventure?.restore();scene?.filmCompositor?.invalidate();if(scene){scene.renderer.shadowMap.needsUpdate=true;scene.dirty=true;}syncFilm();});
window.addEventListener('pagehide',ev=>{if(ev.persisted){film?.setActive(false);adventure?.setActive(false,quiet);}else{film?.dispose();adventure?.dispose();rig?.dispose();music.dispose();loader.dispose();scene?.filmCompositor?.dispose();if(scene)cancelAnimationFrame(scene.frame);}});
window.addEventListener('pageshow',ev=>{if(ev.persisted)syncFilm();});
function render(){
 const t=copy[lang],page=t.chapters[index],printed=page?pageTextRows(page):null;
 document.documentElement.lang=lang;document.documentElement.dataset.quiet=quiet;document.documentElement.dataset.open=String(index>=0);
 document.documentElement.dataset.coverVisible=String(index<0&&!turning);
 openPrompt.innerHTML=`<span class="open-main">${t.open} <span aria-hidden="true">↗</span></span><span class="open-help">${t.openHelp}</span>`;openPrompt.disabled=!startupReady||index>=0||turning||contents;openPrompt.setAttribute('aria-hidden',String(openPrompt.disabled));
 syncFilm();
 if(startupReady&&index===4&&!scene)loader.startStage('castlePlaying');
 if(quiet)scene?.stopCompletionSparkle();
 scene?.setPageHint(startupReady&&!quiet&&!playing&&!turning&&!contents&&(index===2||index===3));
 coverCopy.setAttribute('aria-hidden',String(index>=0||turning||contents));coverCopy.inert=contents;
 if(coverCopy.lang!==lang){coverCopy.lang=lang;coverCopy.innerHTML=`<span class="eyebrow">${t.coverEyebrow}</span><h1>${t.coverHeading}</h1>`;}
 document.title=t.title;for(const sel of ['meta[name="description"]','meta[property="og:description"]'])document.querySelector(sel)?.setAttribute('content',t.description);document.querySelector('meta[property="og:title"]')?.setAttribute('content',t.title);
 ui.dataset.playing=String(playing);ui.dataset.page=page?.id||'cover';ui.classList.toggle('turning',turning);
 ui.innerHTML=`<header><a href="#cover" class="wordmark" aria-label="Peiry Tale"><img src="${import.meta.env.BASE_URL}assets/brand-logo.webp" alt="" width="48" height="48"><span class="wordmark-name">Peiry Tale<span>THE EVERYDAY FAIRYTALE</span></span></a><nav aria-label="${t.contents}"><button data-action="contents" aria-expanded="${contents}">${t.contents}</button><button data-action="language">${t.language}</button><button data-action="music" aria-label="${music.enabled?t.musicOff:t.musicOn}" aria-pressed="${music.enabled}"><svg class="music-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5 5 9H2v6h3l5 4Z"/><path class="music-waves" d="M14 8q4 4 0 8M17 5q7 7 0 14"/><path class="music-muted" d="m14 9 6 6m0-6-6 6"/></svg><span class="music-label">${music.enabled?t.musicOff:t.musicOn}</span></button></nav></header>
 ${index<0?`<section class="cover-ui" aria-label="Peiry Tale"><div class="fallback-cover" aria-hidden="true"></div></section><div class="book-rotation" tabindex="0" role="group" aria-label="${t.rotateBook}" aria-describedby="rotation-help"></div><span id="rotation-help" class="sr-only">${t.rotateHelp}</span>`:
 `<section class="spread" aria-label="${page.label}" aria-busy="${turning}" data-left="${page.left}" data-right="${page.right}">${page.id==='castle'?`<p class="sr-only">${pageFilmCopy[lang].description}</p>${!scene?`<img class="page-film-fallback" src="${import.meta.env.BASE_URL}assets/castle-page-fallback.webp" alt="" aria-hidden="true">`:""}`:''}<div class="fallback-leaf left-leaf ${page.left}" aria-hidden="true"></div><div class="right-leaf ${page.right}"><div class="page-copy" ${page.heading?'':'hidden'}><p class="printed-label eyebrow">${e(printed.label)}</p><h1 id="page-title" class="printed-heading ${page.id==='title-page'?'page-subtitle':''}" tabindex="-1">${printed.lines.map(line=>`<span class="printed-line">${e(line)}</span>`).join(' ')}</h1></div></div></section>
 <div class="page-turn-zones"><button class="page-hit left-hit" data-action="previous" aria-label="${index===0?t.cover:t.previous}" ${turning?'disabled':''}></button><button class="page-hit right-hit" data-action="next" aria-label="${index===4?t.cover:t.next}" ${turning?'disabled':''}></button></div>
 `}
 ${contents?`<section class="contents" role="dialog" aria-modal="true" aria-labelledby="contents-title"><h2 id="contents-title">${t.contents}</h2><a href="#cover">${t.cover}</a>${t.chapters.map(p=>`<a href="#${p.id}" ${page?.id===p.id?'aria-current="page"':''}>${p.label}</a>`).join('')}<button data-action="dismiss">${t.close} ×</button></section>`:''}`;
 syncNavigation();updateMusic(music.state);
 if(contents){const modal=ui.querySelector('.contents');for(const child of ui.children)if(child!==modal)child.inert=true;}
}
function announce(){document.querySelector('#announcement').textContent=index<0?copy[lang].cover:index===4&&filmCompletionAnnounced?pageFilmCopy[lang].finished:copy[lang].chapters[index].label;}
function address(){history.replaceState(null,'',`?lang=${lang}${rigTest?'&rig-test=1':filmTest?'&film-test=1':''}#${index<0?'cover':copy[lang].chapters[index].id}`);}
async function stop(){run++;playing=false;scene?.setPaused(false);await scene?.finishMotion();index=targetIndex;turning=false;}
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
 const ticket=++navigation;turning=true;render();await stop();if(ticket!==navigation)return;contents=false;
 if(index>=0)await move(-1,{immediate:true});
 if(quiet||!scene){await move(2,{immediate:true});return;}
 const id=++run;playing=true;
 await move(0);if(id!==run)return;
 if(!await hold(sequence.firstPause,id))return;
 await move(1);if(id!==run)return;
 if(!await hold(sequence.mixedPause,id))return;
 turning=true;targetIndex=2;render();await scene.riffle(copy[lang].chapters[2],2,lang,sequence.riffling);if(id!==run)return;
 index=2;turning=false;render();address();announce();
 playing=false;render();
}
app.addEventListener('click',async ev=>{
 if(!startupReady)return;
 const anchor=ev.target.closest('a[href^="#"]');if(anchor){ev.preventDefault();const i=chapterIndex(lang,anchor.hash);await go(i);return;}
 const b=ev.target.closest('button');if(!b)return;const action=b.dataset.action;
 if(b.classList.contains('page-hit')&&((suppressPageClick&&ev.detail!==0)||turning))return;
 if(action==='open'){intro();return;}
 if(action==='next'){advance();return;}
 if(action==='previous'){await go(targetIndex-1);return;}
 if(action==='language'){
  await stop();lang=lang==='en'?'zh-TW':'en';save('peiry-language',lang);if(index>=0)scene?.setSpread(copy[lang].chapters[index],index,lang);render();address();announce();ui.querySelector('[data-action=language]')?.focus();return;
 }
 if(action==='music'){music.setEnabled(!music.enabled);return;}
 if(action==='contents'){contents=!contents;scene?.setPaused(contents&&playing);render();ui.querySelector('.contents a')?.focus();return;}
 if(action==='dismiss'){contents=false;scene?.setPaused(false);render();ui.querySelector('[data-action=contents]')?.focus();}
});
window.addEventListener('keydown',ev=>{
 if(!startupReady)return;
 if(contents){
  if(ev.key==='Escape'){contents=false;scene?.setPaused(false);render();ui.querySelector('[data-action=contents]')?.focus();return;}
  if(ev.key==='Tab'){const nodes=[...ui.querySelectorAll('.contents a,.contents button')],first=nodes[0],last=nodes.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}
  return;
 }
 if(index<0&&!turning&&ev.target.closest?.('.book-rotation')){
  const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[ev.key];if(d){ev.preventDefault();scene?.rotateInspection(...d);return;}
  if(ev.key==='Home'){ev.preventDefault();scene?.resetInspection();return;}
  if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();intro();return;}
 }
 if(ev.key==='ArrowRight'){ev.preventDefault();advance();}
 if(ev.key==='ArrowLeft'&&targetIndex>=0){ev.preventDefault();go(targetIndex-1);}
});
ui.addEventListener('pointerdown',ev=>{
 if(index<0&&!turning&&ev.target.closest?.('.book-rotation')&&ev.isPrimary&&ev.button===0){rotationDrag={id:ev.pointerId,x:ev.clientX,y:ev.clientY};ui.setPointerCapture(ev.pointerId);ev.preventDefault();return;}
 const leaf=ev.target.closest('.page-hit');
 if(leaf&&index>=0&&!turning&&!contents&&ev.isPrimary&&ev.button===0){suppressPageClick=false;pageDrag={id:ev.pointerId,x:ev.clientX,y:ev.clientY,target:leaf};leaf.setPointerCapture(ev.pointerId);}
});
ui.addEventListener('pointermove',ev=>{if(rotationDrag?.id!==ev.pointerId)return;scene?.rotateInspection(ev.clientX-rotationDrag.x,ev.clientY-rotationDrag.y);rotationDrag.x=ev.clientX;rotationDrag.y=ev.clientY;ev.preventDefault();});
ui.addEventListener('pointerup',ev=>{
 if(rotationDrag){rotationDrag=null;if(ui.hasPointerCapture(ev.pointerId))ui.releasePointerCapture(ev.pointerId);return;}
 if(pageDrag?.id!==ev.pointerId)return;const drag=pageDrag,dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;pageDrag=null;
 if(drag.target.hasPointerCapture(ev.pointerId))drag.target.releasePointerCapture(ev.pointerId);
 const moved=Math.hypot(dx,dy)>12;suppressPageClick=moved;
 if(moved&&Math.abs(dx)>Math.max(35,Math.min(65,innerWidth*.09))&&Math.abs(dx)>Math.abs(dy)*1.35){if(dx<0)advance();else go(targetIndex-1);}
});
ui.addEventListener('pointercancel',()=>{rotationDrag=null;pageDrag=null;suppressPageClick=false;});
window.addEventListener('blur',()=>{rotationDrag=null;pageDrag=null;suppressPageClick=false;});
window.addEventListener('hashchange',()=>{if(startupReady)go(chapterIndex(lang,location.hash),{immediate:quiet});});
motionQuery.addEventListener('change',async ev=>{quiet=ev.matches;if(quiet&&playing)await go(2,{immediate:true});else render();});
const loading=document.querySelector('#loading-screen'),retry=document.querySelector('#loading-retry'),loadingText=loadingCopy[lang];
document.querySelector('#loading-title').textContent=loadingText.title;document.querySelector('#loading-detail').textContent=loadingText.detail;retry.textContent=loadingText.retry;ui.inert=true;coverCopy.inert=true;render();
async function prepareStory(){
 retry.hidden=true;document.querySelector('#loading-detail').textContent=loadingText.detail;document.querySelector('#loading-progress').removeAttribute('value');
 const results=await Promise.allSettled([loader.prepareVideo(),music.prepare(),...['castle-page-blank.webp','castle-page-final.webp','castle-page-border.webp','castle-page-fallback.webp'].map(name=>loader.load(name))]);
 if(results.some(result=>result.status==='rejected')){document.querySelector('#loading-detail').textContent=loadingText.error;retry.hidden=false;return;}
 preloadedVideo=results[0].value;
 // Settle the GPU and requested spread beneath the same screen that was painted
 // by index.html. In particular, a chapter URL must never reveal the cover first.
 await scene?.ready;
 if(location.hash&&location.hash!=='#cover')await go(chapterIndex(lang,location.hash),{immediate:true});
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 document.querySelector('#loading-progress').value=100;music.setEnabled(true);
 loading.classList.add('leaving');
 if(!quiet)await new Promise(resolve=>{const done=()=>{loading.removeEventListener('transitionend',ended);clearTimeout(timer);resolve();};const ended=event=>{if(event.target===loading&&event.propertyName==='opacity')done();};const timer=setTimeout(done,1100);loading.addEventListener('transitionend',ended);});
 loading.hidden=true;startupReady=true;ui.inert=false;render();coverCopy.inert=false;
}
retry.addEventListener('click',prepareStory);prepareStory();
