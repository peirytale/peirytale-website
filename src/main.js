import './style.css';
import {copy,sequence,pageTypography,pageTextRows,chapterIndex,readingViewCopy} from './content/book.js';
import {BookScene} from './book-scene.js';
import {Music} from './music.js';
import {pageFilmCopy} from './content/page-film.js';
import {AssetLoader} from './asset-loader.js';
import {loadingCopy} from './content/loading.js';
import {adventure as adventureConfig,adventureCopy} from './castle-adventure/config.js';
import {workshopCopy,room as workshopRoom,objects,toPage} from './workshop/layout.js';
import {clampReadingCenter,isPortraitBook,overviewFrame,readingFrame} from './reading-frame.js';
const app=document.querySelector('#app');
const stored=(k,d)=>{try{return localStorage.getItem(k)||d}catch{return d}};
const save=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
let lang=new URLSearchParams(location.search).get('lang')||stored('peiry-language','zh-TW');if(!copy[lang])lang='zh-TW';
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
let quiet=motionQuery.matches;
let index=-1,targetIndex=-1,playing=false,turning=false,contents=false,run=0,navigation=0,scene,rotationDrag,pageDrag,suppressPointerClick=false;
let film,filmPromise,rig,rigPromise,adventure,chapter,workshopUI,fallbackWorkshop,fallbackPromise,rigHandoff=false,filmCompletionAnnounced=false,startupReady=false,preloadedVideo=null;
let directWorkshop=location.hash==='#workshop',workshopBridge=null,handoffIntent=0;
const music=new Music(updateMusic);
const loader=new AssetLoader(({loaded,total})=>{const progress=document.querySelector('#loading-progress');if(progress){if(total){progress.value=Math.min(90,Math.floor(loaded/total*90));progress.textContent=`${progress.value}%`;}else progress.removeAttribute('value');}});
const rigTest=new URLSearchParams(location.search).has('rig-test');
const filmTest=rigTest||import.meta.env.DEV&&new URLSearchParams(location.search).has('film-test');
const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.innerHTML=`<main class="stage"><canvas id="world" aria-hidden="true"></canvas><div id="book-ui"></div><div class="rotation-arrows" aria-hidden="true"><svg class="rotation-arrow left" viewBox="0 0 64 72"><defs><linearGradient id="arrow-ink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e0cbbc"/><stop offset=".55" stop-color="#a98280"/><stop offset="1" stop-color="#735e60"/></linearGradient></defs><path d="M51 11C27 13 16 25 16 39c0 10 6 16 17 19"/><path d="m25 50 9 9-12 3"/></svg><svg class="rotation-arrow right" viewBox="0 0 64 72"><path d="M51 11C27 13 16 25 16 39c0 10 6 16 17 19"/><path d="m25 50 9 9-12 3"/></svg></div><div id="cover-copy" class="cover-heading"></div><button id="open-prompt" class="open-book" data-action="open"></button><p id="announcement" class="sr-only" aria-live="polite"></p></main>`;
const canvas=document.querySelector('#world'),ui=document.querySelector('#book-ui'),coverCopy=document.querySelector('#cover-copy'),openPrompt=document.querySelector('#open-prompt'),arrows=document.querySelector('.rotation-arrows');
const stage=canvas.parentElement,readingToggle=document.createElement('button'),readingHelp=document.createElement('p');
readingToggle.className='reading-toggle';
readingToggle.dataset.action='reading-view';
readingToggle.hidden=true;
readingHelp.id='reading-help';
readingHelp.className='sr-only';
stage.append(readingToggle,readingHelp);
const workshopBounds=new Map(objects.map(({id,polygon})=>{
 const xs=polygon.map(point=>toPage(point)[0]/workshopRoom.size[0]);
 return [id,[Math.min(...xs),Math.max(...xs)]];
}));
let readerOverview=false,readingCenter=null,readingLayout;
const textSpread=page=>page===2||page===3;
function getReadingView(portrait){
 if((stage.dataset.readingPortrait==='true')!==portrait)stage.dataset.readingPortrait=String(portrait);
 const actor=chapter?.mode==='workshop'?chapter.actor:null;
 const workshopEntered=!scene||actor?.state==='idle'||actor?.state==='moving';
 let chapterView=null;
 if(portrait&&!playing){
  if(textSpread(index)&&(!turning||textSpread(targetIndex)))chapterView='text';
  if(!turning&&index===4&&(!scene||film?.complete&&!scene.completion))chapterView='castle';
  if(!turning&&index===5&&workshopEntered)chapterView='workshop';
 }
 const hidden=!startupReady||contents||!chapterView;
 if(readingToggle.hidden!==hidden)readingToggle.hidden=hidden;
 const label=readingViewCopy[lang][readerOverview?'detail':'overview'];
 if(readingToggle.textContent!==label)readingToggle.textContent=label;
 const help=readingViewCopy[lang].pan;
 if(readingHelp.textContent!==help)readingHelp.textContent=help;
 const view={chapter:readerOverview?null:chapterView,instant:quiet||!startupReady,center:readingCenter};
 if(view.chapter==='workshop'){
  const point=actor?.getPosition()||fallbackWorkshop?.getPoint()||workshopRoom.entry;
  view.subject=toPage(point)[0]/workshopRoom.size[0];
  view.object=workshopBounds.get(actor?.target||fallbackWorkshop?.selected);
 }
 return view;
}
function positionReadingUI({width,height,x,y,scale}){
 readingLayout={width,x};
 const pannable=scale>1&&width>(scene?.width??stage.clientWidth)+1;
 if((stage.dataset.readingPannable==='true')!==pannable){
  stage.dataset.readingPannable=String(pannable);
  if(pannable)readingToggle.setAttribute('aria-describedby',readingHelp.id);
  else readingToggle.removeAttribute('aria-describedby');
 }
 ui.style.setProperty('--book-width',`${width}px`);
 ui.style.setProperty('--book-height',`${height}px`);
 ui.style.setProperty('--book-center-x',`${x}px`);
 ui.style.setProperty('--book-center-y',`${y}px`);
}
function positionFallback(){
 const w=stage.clientWidth,h=stage.clientHeight;
 const view=getReadingView(isPortraitBook(w,h));
 if(view.chapter){
  const width=Math.min(.84*w,(h-160)*1.428571,943),height=Math.min(.588*w,h-160,660);
  const frame=readingFrame(w,h,width,height,{...view,instant:true},overviewFrame);
  positionReadingUI({width:width*frame.scale,height:height*frame.scale,
   x:w/2-(frame.center-.5)*width*frame.scale,y:h/2-frame.lift,scale:frame.scale});
 }else{
  stage.dataset.readingPannable='false';
  readingToggle.removeAttribute('aria-describedby');
  for(const property of ['--book-width','--book-height','--book-center-x','--book-center-y'])ui.style.removeProperty(property);
 }
 fallbackWorkshop?.position();
}
const castleHit=document.createElement('button');
castleHit.id='castle-enter';castleHit.hidden=true;castleHit.dataset.action='castle-enter';app.querySelector('.stage').append(castleHit);
let announcedAdventure='idle';
function syncAdventureUI(state){
 if(!scene)return;
 if(state){canvas.dataset.adventureState=state.state;canvas.dataset.adventureTime=state.time.toFixed(3);refreshChapter();if(state.state!==announcedAdventure){announcedAdventure=state.state;const message={approaching:'running',pushing:'pushing',lit:'lit'}[state.state];if(message)document.querySelector('#announcement').textContent=adventureCopy[lang][message];}}
 const visible=startupReady&&index===4&&!turning&&!contents&&!playing&&canvas.dataset.rigHandoff==='complete';
 castleHit.hidden=!visible||!adventure?.loaded||chapter?.mode!=='castle';castleHit.disabled=adventure?.state!=='idle';castleHit.setAttribute('aria-label',adventureCopy[lang].enter);
 if(visible){const points=adventureConfig.hitPolygon.map(p=>scene.projectPagePoint(...p)),xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left,h=Math.max(...ys)-top;Object.assign(castleHit.style,{left:`${left}px`,top:`${top}px`,width:`${w}px`,height:`${h}px`,clipPath:`polygon(${points.map(p=>`${(p.x-left)/w*100}% ${(p.y-top)/h*100}%`).join(',')})`});}
}
function refreshChapter(){if(scene&&chapter&&scene.pageFilm===chapter)scene.updatePageFilmMaps();}
function workshopVisible(){return startupReady&&!turning&&!contents&&!playing&&(index===5||index===4&&chapter?.mode==='castle');}
let announcedWorkshop=false;
function syncWorkshopUI(state){
 if(!scene)return;
 if(state){
  const previousMode=canvas.dataset.workshopState,previousActor=canvas.dataset.workshopActorState;
  canvas.dataset.workshopState=state.mode;canvas.dataset.workshopLoading=String(state.loading);canvas.dataset.workshopError=state.error||'';canvas.dataset.workshopActorState=state.actorState;canvas.dataset.workshopActorTarget=state.actorTarget||'';
  if(state.mode==='workshop'&&!announcedWorkshop){announcedWorkshop=true;document.querySelector('#announcement').textContent=workshopCopy[lang].ready;}
  if(state.mode==='workshop'&&state.actorState==='entering'&&previousActor!=='entering')document.querySelector('#announcement').textContent=workshopCopy[lang].entering;
  if(state.mode==='workshop'&&state.actorState==='idle'&&previousActor==='entering')document.querySelector('#announcement').textContent=workshopCopy[lang].actorReady;
  if(state.mode==='castle')announcedWorkshop=false;
 }
 refreshChapter();syncAdventureUI();workshopUI?.sync(workshopVisible());
}
castleHit.addEventListener('click',()=>{if(adventure?.start())refreshChapter();});
canvas.addEventListener('bookresize',()=>{syncAdventureUI();workshopUI?.position();});
ui.style.setProperty('--printed-label-top',`${pageTypography.layout.labelY/1408*100}%`);ui.style.setProperty('--printed-heading-top',`${pageTypography.layout.headingY/1408*100}%`);ui.style.setProperty('--printed-center',`${pageTypography.layout.x/1024*100}%`);
ui.style.setProperty('--cover-image',`url("${import.meta.env.BASE_URL}assets/storybook-cover.webp")`);
canvas.addEventListener('bookresize',({detail:r})=>{positionReadingUI(r);openPrompt.style.setProperty('--book-height',`${r.height}px`);arrows.style.setProperty('--book-height',`${r.height}px`);});
try{scene=new BookScene(canvas,()=>document.documentElement.dataset.texture='ready');scene.getReadingView=getReadingView;document.documentElement.dataset.renderer='webgl';}
catch(error){document.documentElement.dataset.renderer='fallback';document.documentElement.dataset.texture='ready';console.warn('WebGL unavailable; using accessible book pages.',error.message);}
if(filmTest&&scene)window.__peiryBook=scene;
function updateMusic(state){
 const button=ui.querySelector('[data-action=music]');if(button){const label=state.enabled?copy[lang].musicOff:copy[lang].musicOn;button.querySelector('.music-label').textContent=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(state.enabled));}
 if(typeof canvas!=='undefined'){canvas.dataset.musicEnabled=String(state.enabled);canvas.dataset.musicPlaying=String(state.playing);canvas.dataset.musicContext=state.context;canvas.dataset.musicThemePlaying=String(state.themePlaying);canvas.dataset.musicPencilPlaying=String(state.pencilPlaying);canvas.dataset.musicThemeTime=state.themeTime.toFixed(3);canvas.dataset.musicThemeDuration=state.themeDuration.toFixed(3);canvas.dataset.musicThemeAsset=state.themeAsset;}
}
function forwardLocked(){return index===4&&Boolean(scene)&&!quiet&&(!film||!film.complete);}
function syncNavigation(){const next=ui.querySelector('[data-action=next]');if(next)next.disabled=turning||forwardLocked();canvas.dataset.nextLocked=String(forwardLocked());}
function advance(){if(!forwardLocked())go(targetIndex===5?-1:targetIndex+1);}
function prepareRig(){
 rigPromise??=Promise.all([import('./castle-rig/controller.js'),import('./castle-adventure/controller.js'),import('./workshop/chapter.js'),import('./workshop/ui.js')]).then(async([{CastleRig},{CastleAdventure},{WorkshopChapter},{WorkshopUI}])=>{rig=new CastleRig(scene.renderer,()=>scene.dirty=true,()=>{canvas.dataset.rigActive=String(Boolean(rig?.active));canvas.dataset.rigMode=rig?.mode||'loading';});if(rigTest){window.__peiryCastleRig=rig;window.__peiryBook=scene;}await rig.ready;const [atlas,flow,repair,run]=await Promise.all([loader.load(adventureConfig.atlas),loader.load(adventureConfig.flowAtlas),loader.load(adventureConfig.repairAtlas),loader.load(adventureConfig.runAtlas)]);adventure=new CastleAdventure(rig,syncAdventureUI,atlas,flow,repair,run);if(rigTest)window.__peiryCastleAdventure=adventure;await adventure.ready;chapter=new WorkshopChapter(adventure,loader,syncWorkshopUI,refreshChapter);workshopUI=new WorkshopUI(app.querySelector('.stage'),scene,chapter,()=>lang,text=>document.querySelector('#announcement').textContent=text);if(rigTest){window.__peiryWorkshop=chapter;window.__peiryWorkshopUI=workshopUI;}chapter.onTurn=turnToWorkshop;chapter.onReturn=()=>go(4);chapter.onRetryDirect=()=>go(5,{immediate:true});canvas.dataset.rigReady='true';return rig;}).catch(error=>{rigPromise=null;adventure?.dispose();rig?.dispose();adventure=null;rig=null;throw error;});return rigPromise;
}
async function handoffRig(){
 if(rigHandoff)return;rigHandoff=true;const intent=++handoffIntent;
 try{await prepareRig();if(intent!==handoffIntent||rig.disposed||film.disposed)return;film.tick();rig.capture(film.texture);
 // Let the existing completion glints finish before the local-only loop starts.
 const canAttach=await new Promise(resolve=>{const settled=()=>{if(intent!==handoffIntent||rig.disposed||film.disposed){resolve(false);return;}if(index===4&&!turning&&!contents&&!playing&&scene.bindingMotion==='open'&&!scene.animation&&(!scene.completion||quiet)){resolve(true);return;}requestAnimationFrame(settled);};requestAnimationFrame(settled);});if(!canAttach)return;
 if(rig.disposed||film.disposed)return;scene.attachPageFilm(chapter);rig.resume();chapter.setActive(startupReady&&index===4&&!turning&&!contents&&!playing,quiet);canvas.dataset.rigHandoff='complete';syncAdventureUI();
 }catch(error){rigHandoff=false;console.warn('Local castle animation unavailable; keeping completed artwork.',error.message);}
}
function filmState(state){
 // Prefetch bytes while painting. Decode and build the next scenes after the
 // movie ends, so their texture uploads and shader work cannot stall it.
 if(state.active&&(state.state==='playing'||(quiet&&state.state==='finished')))loader.startStage('castlePlaying');
 if(scene&&!directWorkshop&&state.state==='finished'&&(film?.finishedNaturally||(quiet&&film?.complete)))handoffRig();
 canvas.dataset.filmState=state.state;canvas.dataset.filmTime=state.time.toFixed(4);canvas.dataset.filmActive=String(state.active);canvas.dataset.filmFrames=String(state.frames);canvas.dataset.filmSource=state.source;canvas.dataset.filmGeneration=String(state.generation);canvas.dataset.filmRecoveries=String(state.recoveries);canvas.dataset.filmPresentedTime=state.presentedTime.toFixed(4);
 syncNavigation();
 if(state.state==='finished'&&state.active&&film?.finishedNaturally&&!filmCompletionAnnounced){filmCompletionAnnounced=true;announce();}
 if(state.state==='finished'&&state.active&&film?.finishedNaturally&&!quiet)scene?.startCompletionSparkle();
}
async function syncFilm(){
 const active=()=>startupReady&&[4,5].includes(index)&&!turning&&!contents&&!playing;
 const castleActive=()=>active()&&index===4&&!directWorkshop;
 film?.setActive(castleActive(),quiet,{retainComplete:directWorkshop||index===5});
 if(rigHandoff&&film&&!film.complete&&!workshopBridge&&!directWorkshop){chapter?.cancel();rigHandoff=false;delete canvas.dataset.rigHandoff;scene.attachPageFilm(film);}
 chapter?.setActive(Boolean(rigHandoff&&canvas.dataset.rigHandoff==='complete'&&active()),quiet);syncAdventureUI();workshopUI?.sync(workshopVisible());
 if(!scene||!preloadedVideo||index<2&&!directWorkshop||film)return;
 filmPromise??=import('./page-film/controller.js').then(({PageFilm})=>{film=new PageFilm(scene.renderer,()=>scene.dirty=true,filmState,preloadedVideo);scene.attachPageFilm(film);music.bind(film.video);if(filmTest){window.__peiryPageFilm=film;window.__peiryBook=scene;}film.setActive(castleActive(),quiet,{retainComplete:directWorkshop||index===5});return film;});
 await filmPromise;
}
canvas.addEventListener('webglcontextlost',()=>{film?.setActive(false);chapter?.setActive(false,quiet);chapter?.releaseGPU();});
canvas.addEventListener('webglcontextrestored',()=>{film?.restore();rig?.restore();adventure?.restore();chapter?.restore();scene?.filmCompositor?.invalidate();if(scene){scene.renderer.shadowMap.needsUpdate=true;scene.dirty=true;}syncFilm();});
window.addEventListener('pagehide',ev=>{if(ev.persisted){film?.setActive(false);chapter?.setActive(false,quiet);}else{film?.dispose();chapter?.dispose();workshopUI?.dispose();adventure?.dispose();rig?.dispose();music.dispose();loader.dispose();scene?.filmCompositor?.dispose();if(scene)cancelAnimationFrame(scene.frame);}});
window.addEventListener('pageshow',ev=>{if(ev.persisted)syncFilm();});
function render(){
 const t=copy[lang],page=t.chapters[index],printed=page?pageTextRows(page):null;
 document.documentElement.lang=lang;document.documentElement.dataset.quiet=quiet;document.documentElement.dataset.open=String(index>=0);
 document.documentElement.dataset.coverVisible=String(index<0&&!turning);
 openPrompt.innerHTML=`<span class="open-main">${t.open} <span aria-hidden="true">↗</span></span><span class="open-help">${t.openHelp}</span>`;openPrompt.disabled=!startupReady||index>=0||turning||contents;openPrompt.setAttribute('aria-hidden',String(openPrompt.disabled));
 syncFilm();
 if(startupReady&&[4,5].includes(index)&&!scene)loader.startStage('castlePlaying');
 if(quiet)scene?.stopCompletionSparkle();
 scene?.setPageHint(startupReady&&!quiet&&!playing&&!turning&&!contents&&(index===2||index===3));
 coverCopy.setAttribute('aria-hidden',String(index>=0||turning||contents));coverCopy.inert=contents;
 if(coverCopy.lang!==lang){coverCopy.lang=lang;coverCopy.innerHTML=`<span class="eyebrow">${t.coverEyebrow}</span><h1>${t.coverHeading}</h1>`;}
 document.title=t.title;for(const sel of ['meta[name="description"]','meta[property="og:description"]'])document.querySelector(sel)?.setAttribute('content',t.description);document.querySelector('meta[property="og:title"]')?.setAttribute('content',t.title);
 ui.dataset.playing=String(playing);ui.dataset.page=page?.id||'cover';ui.classList.toggle('turning',turning);
 ui.innerHTML=`<header><a href="#cover" class="wordmark" aria-label="Peiry Tale"><img src="${import.meta.env.BASE_URL}assets/brand-logo.webp" alt="" width="48" height="48"><span class="wordmark-name">Peiry Tale<span>THE EVERYDAY FAIRYTALE</span></span></a><nav aria-label="${t.contents}"><button data-action="contents" aria-expanded="${contents}">${t.contents}</button><button data-action="language">${t.language}</button><button data-action="music" aria-label="${music.enabled?t.musicOff:t.musicOn}" aria-pressed="${music.enabled}"><svg class="music-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5 5 9H2v6h3l5 4Z"/><path class="music-waves" d="M14 8q4 4 0 8M17 5q7 7 0 14"/><path class="music-muted" d="m14 9 6 6m0-6-6 6"/></svg><span class="music-label">${music.enabled?t.musicOff:t.musicOn}</span></button></nav></header>
 ${index<0?`<section class="cover-ui" aria-label="Peiry Tale"><div class="fallback-cover" aria-hidden="true"></div></section><div class="book-rotation" tabindex="0" role="group" aria-label="${t.rotateBook}" aria-describedby="rotation-help"></div><span id="rotation-help" class="sr-only">${t.rotateHelp}</span>`:
 `<section class="spread" aria-label="${page.label}" aria-busy="${turning}" data-left="${page.left}" data-right="${page.right}">${page.id==='castle'?`<p class="sr-only">${pageFilmCopy[lang].description}</p>${!scene?`<img class="page-film-fallback" src="${import.meta.env.BASE_URL}assets/castle-page-fallback.webp" alt="" aria-hidden="true">`:""}`:''}<div class="fallback-leaf left-leaf ${page.left}" aria-hidden="true"></div><div class="right-leaf ${page.right}"><div class="page-copy" ${page.heading?'':'hidden'}><p class="printed-label eyebrow">${e(printed.label)}</p><h1 id="page-title" class="printed-heading ${page.id==='title-page'?'page-subtitle':''}" tabindex="-1">${printed.lines.map(line=>`<span class="printed-line">${e(line)}</span>`).join(' ')}</h1></div></div></section>
 <div class="page-turn-zones"><button class="page-hit left-hit" data-action="previous" aria-label="${index===0?t.cover:t.previous}" ${turning?'disabled':''}></button><button class="page-hit right-hit" data-action="next" aria-label="${index===5?t.cover:t.next}" ${turning?'disabled':''}></button></div>
 `}
 ${contents?`<section class="contents" role="dialog" aria-modal="true" aria-labelledby="contents-title"><h2 id="contents-title">${t.contents}</h2><a href="#cover">${t.cover}</a>${t.chapters.map(p=>`<a href="#${p.id}" ${page?.id===p.id?'aria-current="page"':''}>${p.label}</a>`).join('')}<button data-action="dismiss">${t.close} ×</button></section>`:''}`;
 syncNavigation();updateMusic(music.state);
 if(contents){const modal=ui.querySelector('.contents');for(const child of ui.children)if(child!==modal)child.inert=true;}
 if(scene)getReadingView(isPortraitBook(stage.clientWidth,stage.clientHeight));
 else{
  positionFallback();
  fallbackPromise??=import('./workshop/fallback.js').then(({WorkshopFallback})=>fallbackWorkshop=new WorkshopFallback(stage,mode=>go(mode==='workshop'?5:4,{immediate:true}),()=>{readingCenter=null;positionFallback();}));
  fallbackPromise.then(f=>{f.sync({visible:startupReady&&[4,5].includes(index)&&!turning&&!contents,lang,reset:index!==5,direct:index===5});positionFallback();});
 }
}
window.addEventListener('resize',()=>{if(!scene)positionFallback();});
function announce(){document.querySelector('#announcement').textContent=index<0?copy[lang].cover:index===5?workshopCopy[lang].title:index===4&&filmCompletionAnnounced?pageFilmCopy[lang].finished:copy[lang].chapters[index].label;}
function address(){history.replaceState(null,'',`?lang=${lang}${rigTest?'&rig-test=1':filmTest?'&film-test=1':''}#${index<0?'cover':copy[lang].chapters[index].id}`);}
async function stop(){run++;playing=false;scene?.setPaused(false);await scene?.finishMotion();index=targetIndex;turning=false;}
async function move(next,{immediate=false,duration=sequence.leafTurn,ticket=null}={}){
 const page=copy[lang].chapters[next];readingCenter=null;targetIndex=next;turning=true;render();
 if(next<0)await scene?.close(quiet||immediate);
 else if(index<0){scene?.setSpread(page,next,lang);await scene?.open(quiet||immediate,sequence.opening);}
 else await scene?.turn(page,next,lang,{duration,quiet:quiet||immediate});
 if(ticket!==null&&ticket!==navigation)return false;index=next;turning=false;render();address();announce();return true;
}
async function prepareWorkshopTarget(ticket){
 if(!scene)return;
 await syncFilm();if(ticket!==navigation)return;
 await film.ready;if(ticket!==navigation)return;
 if(!film.finishedNaturally)film.showFinal('fallback');
 await prepareRig();if(ticket!==navigation)return;
 chapter.directRequested=true;chapter.emit();await chapter.prepare();if(ticket!==navigation)return;
 if(!chapter.workshop.loaded)throw Error(chapter.error||'Workshop unavailable');
 handoffIntent++;rig.capture(film.texture);chapter.adventure.cancel();scene.attachPageFilm(chapter);rigHandoff=true;canvas.dataset.rigHandoff='complete';
 // Remove the previous guide from the actual texture before any new leaf is
 // exposed, including the first frame of a returning workshop page turn.
 chapter.prepareDirectView();
}
async function go(next,{immediate=false,duration=sequence.leafTurn,fromDoor=false}={}){
 if(next<-1||next>=copy[lang].chapters.length)return null;
 const ticket=++navigation;if(!fromDoor)workshopBridge=null;directWorkshop=next===5;
 await stop();if(ticket!==navigation)return null;
 if(index===5&&next!==5){chapter?.adventure.cancel();refreshChapter();}
 if(next===5&&!fromDoor){try{await prepareWorkshopTarget(ticket);}catch(error){if(chapter){chapter.error=error.message;chapter.directRequested=true;chapter.emit();}}if(ticket!==navigation)return null;}
 contents=false;
 if(next!==index)await move(next,{immediate,duration,ticket});else render();
 if(ticket!==navigation)return null;
 if(next===5&&!fromDoor&&chapter?.workshop.loaded){chapter.setActive(startupReady&&!turning&&!contents,quiet);chapter.enter();}
 if(next!==5){if(next===4)chapter?.back();else chapter?.cancel();render();}
 address();document.querySelector('#page-title')?.focus({preventScroll:true});return ticket;
}
async function turnToWorkshop(){
 if(workshopBridge||index!==4||chapter?.mode!=='turning')return;
 const bridge={chapter};workshopBridge=bridge;
 const ticket=await go(5,{fromDoor:true,duration:workshopRoom.transition.turn*1000});
 if(!ticket||ticket!==navigation||workshopBridge!==bridge||index!==5||turning||chapter!==bridge.chapter)return;
 workshopBridge=null;chapter.reveal();chapter.setActive(startupReady&&!contents&&!turning,quiet);syncWorkshopUI();
}
async function goToHash(hash,{immediate=false}={}){await go(chapterIndex(lang,hash),{immediate});}
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
 const anchor=ev.target.closest('a[href^="#"]');if(anchor){ev.preventDefault();await goToHash(anchor.hash);return;}
 const b=ev.target.closest('button');if(!b)return;const action=b.dataset.action;
 if(b.classList.contains('page-hit')&&turning)return;
 if(action==='open'){intro();return;}
 if(action==='reading-view'){
  readerOverview=!readerOverview;readingCenter=null;
  if(scene)getReadingView(isPortraitBook(stage.clientWidth,stage.clientHeight));else positionFallback();
  return;
 }
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
 if(ev.target.closest?.('select,input,textarea,[contenteditable="true"]'))return;
 if(index<0&&!turning&&ev.target.closest?.('.book-rotation')){
  const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[ev.key];if(d){ev.preventDefault();scene?.rotateInspection(...d);return;}
  if(ev.key==='Home'){ev.preventDefault();scene?.resetInspection();return;}
  if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();intro();return;}
 }
 if(ev.key==='ArrowRight'){ev.preventDefault();advance();}
 if(ev.key==='ArrowLeft'&&targetIndex>=0){ev.preventDefault();go(targetIndex-1);}
});
const panSurface='.page-hit, #castle-enter, .workshop-hit-plane, .workshop-fallback-art';
const closeUp=()=>!readerOverview&&stage.dataset.readingPannable==='true';
const resetReadingCenter=event=>{if(!event.defaultPrevented)readingCenter=null;};
stage.addEventListener('workshop:interact',resetReadingCenter);
stage.addEventListener('workshop:walk',resetReadingCenter);
stage.addEventListener('pointerdown',ev=>{
 if(!ev.isPrimary||ev.button!==0||pageDrag||rotationDrag)return;
 suppressPointerClick=false;
 if(!startupReady||turning||contents)return;
 if(index<0&&ev.target.closest('.book-rotation')){rotationDrag={id:ev.pointerId,x:ev.clientX,y:ev.clientY};ui.setPointerCapture(ev.pointerId);ev.preventDefault();return;}
 const leaf=ev.target.closest('.page-hit');
 if(closeUp()&&ev.target.closest(panSurface)){
  pageDrag={id:ev.pointerId,x:ev.clientX,y:ev.clientY,pan:true};
 }else if(leaf){
  pageDrag={id:ev.pointerId,x:ev.clientX,y:ev.clientY};
  leaf.setPointerCapture(ev.pointerId);
 }
});
ui.addEventListener('pointermove',ev=>{if(rotationDrag?.id!==ev.pointerId)return;scene?.rotateInspection(ev.clientX-rotationDrag.x,ev.clientY-rotationDrag.y);rotationDrag.x=ev.clientX;rotationDrag.y=ev.clientY;ev.preventDefault();});
window.addEventListener('pointermove',ev=>{
 const drag=pageDrag;
 if(!drag?.pan||drag.id!==ev.pointerId||turning||contents||!closeUp()||scene?.readingZoom)return;
 const dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;
 if(!drag.active){
  if(Math.abs(dy)>12&&Math.abs(dy)>=Math.abs(dx)){drag.vertical=true;return;}
  if(drag.vertical||Math.abs(dx)<10||Math.abs(dx)<=Math.abs(dy)*1.35)return;
  drag.active=true;
  suppressPointerClick=true;
  stage.dataset.readingDragging='true';
  stage.setPointerCapture(ev.pointerId);
 }
 const {width,x}=readingLayout,visible=(scene?.width??stage.clientWidth)/width;
 const center=clampReadingCenter(readingCenter??(.5+visible/2-x/width),visible);
 readingCenter=clampReadingCenter(center-dx/width,visible);
 drag.x=ev.clientX;
 if(!scene)positionFallback();
 ev.preventDefault();
});
window.addEventListener('pointerup',ev=>{
 if(rotationDrag?.id===ev.pointerId){rotationDrag=null;return;}
 if(pageDrag?.id!==ev.pointerId)return;const drag=pageDrag,dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;pageDrag=null;
 if(drag.pan){
  delete stage.dataset.readingDragging;
  suppressPointerClick=drag.active||Math.hypot(dx,dy)>12;
  return;
 }
 const moved=Math.hypot(dx,dy)>12;suppressPointerClick=moved;
 if(moved&&Math.abs(dx)>Math.max(35,Math.min(65,innerWidth*.09))&&Math.abs(dx)>Math.abs(dy)*1.35){if(dx<0)advance();else go(targetIndex-1);}
});
window.addEventListener('pointercancel',ev=>{
 if(rotationDrag?.id===ev.pointerId)rotationDrag=null;
 if(pageDrag?.id===ev.pointerId){pageDrag=null;delete stage.dataset.readingDragging;}
});
window.addEventListener('blur',()=>{rotationDrag=null;pageDrag=null;delete stage.dataset.readingDragging;});
stage.addEventListener('click',ev=>{
 if(suppressPointerClick&&ev.detail!==0){ev.preventDefault();ev.stopImmediatePropagation();}
},true);
window.addEventListener('hashchange',()=>{if(startupReady)goToHash(location.hash,{immediate:quiet});});
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
 directWorkshop=location.hash==='#workshop';
 if(location.hash&&location.hash!=='#cover')await go(chapterIndex(lang,location.hash),{immediate:true});
 if(directWorkshop&&scene&&!chapter?.workshop.loaded){document.querySelector('#loading-detail').textContent=loadingText.error;retry.hidden=false;return;}
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 document.querySelector('#loading-progress').value=100;music.setEnabled(true);
 loading.classList.add('leaving');
 if(!quiet)await new Promise(resolve=>{const done=()=>{loading.removeEventListener('transitionend',ended);clearTimeout(timer);resolve();};const ended=event=>{if(event.target===loading&&event.propertyName==='opacity')done();};const timer=setTimeout(done,1100);loading.addEventListener('transitionend',ended);});
 loading.hidden=true;startupReady=true;ui.inert=false;render();coverCopy.inert=false;
}
retry.addEventListener('click',prepareStory);prepareStory();
