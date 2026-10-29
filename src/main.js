import './style.css';
import {copy,links,credits} from './content/book.js';
import {BookScene} from './book-scene.js';
const app=document.querySelector('#app');
const stored=(key,fallback)=>{try{return localStorage.getItem(key)||fallback}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
let lang=new URLSearchParams(location.search).get('lang')||stored('peiry-language','zh-TW');if(!copy[lang])lang='zh-TW';
let quiet=stored('peiry-quiet','false')==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches;
let index=-1,busy=false,scene,detail='',contents=false,visual=false;
const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=name=>`${import.meta.env.BASE_URL}assets/${name}`;
app.innerHTML='<main class="stage"><canvas id="world" aria-hidden="true"></canvas><div id="book-ui"></div><p id="announcement" class="sr-only" aria-live="polite"></p></main>';
const ui=document.querySelector('#book-ui');
ui.style.setProperty('--cover-image',`url("${asset('storybook-cover.webp')}")`);
const layout=({detail:r})=>{ui.style.setProperty('--book-width',`${r.width}px`);ui.style.setProperty('--book-height',`${r.height}px`);requestAnimationFrame(updateReadingOverflow);};
document.querySelector('#world').addEventListener('bookresize',layout);
try{scene=new BookScene(document.querySelector('#world'),()=>document.documentElement.dataset.texture='ready');document.documentElement.dataset.renderer='webgl';}
catch(error){document.documentElement.dataset.renderer='fallback';console.warn('WebGL unavailable; using accessible book view.',error.message);}
function render(){
 const t=copy[lang],c=t.chapters[index];
 document.documentElement.lang=lang;document.documentElement.dataset.quiet=quiet;
 document.documentElement.dataset.open=String(index>=0);
 document.title=t.title;for(const sel of ['meta[name="description"]','meta[property="og:description"]'])document.querySelector(sel)?.setAttribute('content',t.description);document.querySelector('meta[property="og:title"]')?.setAttribute('content',t.title);
 if(scene){scene.quiet=quiet;scene.showVisual(visual);}
 ui.innerHTML=`<header><a href="#cover" class="wordmark"><img src="${asset('brand-logo.webp')}" alt="" width="48" height="48"><span class="wordmark-name">Peiry Tale<span>THE EVERYDAY FAIRYTALE</span></span></a><nav aria-label="${t.contents}"><button data-action="contents" aria-expanded="${contents}">${t.contents}</button><button data-action="language">${t.language}</button><button data-action="quiet" aria-pressed="${quiet}">${quiet?t.motion:t.quiet}</button></nav></header>
 ${index<0?`<section class="cover-ui" aria-labelledby="cover-title"><div class="cover-heading"><span class="eyebrow">${t.coverEyebrow}</span><h1 id="cover-title">${t.subtitle}</h1></div><div class="fallback-cover" aria-hidden="true"></div><button class="open-book" data-action="open">${t.open} <span aria-hidden="true">↗</span></button><a class="direct-link" href="#collections">${t.shop} →</a></section>`:
 `<section class="spread immersive-spread" aria-labelledby="chapter-title" aria-busy="${busy}">
 <div class="chapter-heading"><span class="eyebrow">${c.number} / ${c.eyebrow}</span><h1 id="chapter-title" tabindex="-1">${e(c.title).replace('\n',' ')}</h1></div>
 <div class="world-content">${index===2||index===3?`<figure class="world-photo"><img src="${asset(index===2?'notebook.webp':'dress-study-01.webp')}" alt="${index===2?t.products[0].name:lang==='en'?'Strap-dress study':'吊帶洋裝練習作品'}"></figure><p class="scene-source">${index===2?(lang==='en'?'A past piece · sold':'過往作品 · 已售出'):(lang==='en'?'A making study · 24 October 2026':'製作練習 · 2026 年 10 月 24 日')}</p>`:''}</div>
 ${index===0?`<button class="door-knock" data-action="knock" aria-label="${e(t.knock)}"><span aria-hidden="true">✧</span><small>${e(t.knock)}</small></button>`:''}
 ${index===1?`<button class="garden-secret" data-action="interact" aria-label="${t.letter}" title="${t.letter}">✿</button>`:''}
 <section class="chapter-reading ${detail?'inset reading-detail':''}" role="region" aria-label="${t.chapter}" tabindex="0">
 ${detail?`${detail}<button class="close-inset" data-action="close">${t.close} ×</button>`:`${index===2?`<div class="chapter-actions">${t.products.map(p=>`<button data-product="${p.id}">${p.name} ↗</button>`).join('')}</div>`:''}${c.body.map(p=>`<p>${e(p)}</p>`).join('')}
 ${index===3?`<a href="https://www.instagram.com/p/De4ZlX3gaXX/" target="_blank" rel="noopener noreferrer">${t.source} ↗</a>`:index===4?`<a href="${links.instagram}" target="_blank" rel="noopener noreferrer">${t.instagram} ↗</a>`:''}`}
 </section><span class="reading-scroll-cue" hidden aria-hidden="true">↓</span>
 <nav class="page-turns" aria-label="${t.chapter}"><button class="page-corner previous-corner" data-action="previous" ${busy?'disabled':''}>← <span>${index===0?t.cover:t.previous}</span></button><span>${c.number} / V</span><button class="page-corner next-corner" data-action="next" ${busy?'disabled':''}><span>${index===4?t.cover:t.next}</span> →</button></nav></section>`}

 ${contents?`<section class="contents inset" aria-labelledby="contents-title"><span class="eyebrow">PEIRY TALE</span><h2 id="contents-title">${t.contents}</h2>${t.chapters.map(c=>`<a href="#${c.id}"><span>${c.number}</span> ${e(c.title.replace('\n',' '))}</a>`).join('')}<details class="credits"><summary>${credits[lang].title}</summary><p>${credits[lang].text}</p><a href="https://studio.blender.org/characters/rain/v3/" target="_blank" rel="noopener noreferrer">${credits[lang].source}</a><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">${credits[lang].license}</a></details><button data-action="close">${t.close} ×</button></section>`:''}`;
 requestAnimationFrame(updateReadingOverflow);
}
function updateReadingOverflow(){const region=ui.querySelector('.chapter-reading'),cue=ui.querySelector('.reading-scroll-cue');if(region&&cue)cue.hidden=region.scrollHeight<=region.clientHeight+2||region.scrollTop+region.clientHeight>=region.scrollHeight-2;}
ui.addEventListener('scroll',ev=>{if(ev.target.matches?.('.chapter-reading'))updateReadingOverflow();},true);
window.addEventListener('resize',updateReadingOverflow);
async function go(next){
 if(busy||next===index)return;busy=true;detail='';contents=false;visual=false;
 ui.classList.add('turning');
 const old=index;
 if(next<0){await scene?.close(quiet);}
 else if(old<0){await scene?.open(quiet,copy[lang]);}
 else await scene?.turn(next>old?1:-1,quiet,copy[lang].chapters[old],copy[lang].chapters[next],next);
 index=next;if(scene&&scene.chapter!==index)scene.setChapter(index);busy=false;
 history.replaceState(null,'',`?lang=${lang}#${index<0?'cover':copy[lang].chapters[index].id}`);
 save('peiry-bookmark',index<0?'cover':copy[lang].chapters[index].id);
 render();ui.classList.remove('turning');
 document.querySelector('#chapter-title')?.focus({preventScroll:true});
 document.querySelector('#announcement').textContent=index<0?copy[lang].cover:copy[lang].chapters[index].title.replace('\n',' ');
}
async function enterGarden(){
 if(busy)return;busy=true;ui.classList.add('turning','door-cinematic');
 try{await scene?.knockDoor(quiet);}catch(error){console.warn('Door approach unavailable; continuing to the next page.',error.message);}
 busy=false;ui.classList.remove('turning','door-cinematic');go(1);
}
let returnFocus='';
function closeInsert(){detail='';contents=false;render();const target=returnFocus?document.querySelector(returnFocus):null;(target||document.querySelector('#chapter-title'))?.focus({preventScroll:true});}
function showDetail(html){const active=document.activeElement;const scope=active?.closest('.visual-page')?'.visual-page ':active?.closest('.chapter-actions')?'.chapter-actions ':'';returnFocus=active?.dataset.product?`${scope}[data-product="${active.dataset.product}"]`:active?.dataset.action?`${scope}[data-action="${active.dataset.action}"]`:'';detail=html;scene?.interact();render();document.querySelector('.reading-detail')?.focus({preventScroll:true});}
ui.addEventListener('click',ev=>{
 const anchor=ev.target.closest('a[href^="#"]');if(anchor){ev.preventDefault();const id=anchor.hash.slice(1);go(copy[lang].chapters.findIndex(c=>c.id===id));return;}
 const b=ev.target.closest('button');if(!b||busy)return;const a=b.dataset.action,t=copy[lang];
 if(a==='visual'){visual=!visual;render();document.querySelector('[data-action=visual]').focus();}
 if(a==='open')go(0);
 if(a==='knock'){enterGarden();return;}
 if(a==='next')go(index===4?-1:index+1);
 if(a==='previous')go(index-1);
 if(a==='language'){lang=lang==='en'?'zh-TW':'en';save('peiry-language',lang);detail='';history.replaceState(null,'',`?lang=${lang}${location.hash}`);render();document.querySelector('[data-action=language]').focus();}
 if(a==='quiet'){quiet=!quiet;save('peiry-quiet',String(quiet));render();document.querySelector('[data-action=quiet]').focus();}
 if(a==='contents'){returnFocus='[data-action=contents]';contents=!contents;render();document.querySelector('.contents a')?.focus();}
 if(a==='close')closeInsert();
 if(a==='future')showDetail(`<span class="eyebrow">${t.futureEyebrow}</span><h2 id="detail-title">${t.future}</h2><p>${e(t.chapters[4].body[0])}</p><a href="${links.instagram}" target="_blank" rel="noopener noreferrer">${t.instagram} ↗</a>`);
 if(a==='interact'&&index===4){document.querySelector('[data-action=future]')?.click();return;}
 if(a==='interact')showDetail(`<span class="eyebrow">${t.letterNote}</span><h2 id="detail-title">${index===1?t.letterTitle:lang==='en'?'A little guide, a quiet journey.':'一位小小引路人，一段慢慢走的旅程。'}</h2><p>${index===1?t.letterText:lang==='en'?'Follow me through fabric, paper, and the things we love. Turn a page whenever you are ready.':'讓我陪你走過布料、紙張與生活裡的小小喜歡。準備好時，就翻開下一頁。'}</p><div class="signature">Peiry Tale</div>`);
 if(a==='journal')showDetail(`<span class="eyebrow">${t.journalDate}</span><h2 id="detail-title">${lang==='en'?'Learning, stitch by stitch':'一針一線，慢慢學習'}</h2><img class="detail-photo" src="${asset('dress-study-02.webp')}" alt="${lang==='en'?'Detail of the dress study':'洋裝練習細節'}"><p>${e(t.chapters[3].body[0])}</p><a href="https://www.instagram.com/p/De4ZlX3gaXX/" target="_blank" rel="noopener noreferrer">${t.source} ↗</a>`);
 if(b.dataset.product){const p=t.products.find(p=>p.id===b.dataset.product);showDetail(`<span class="eyebrow">${p.category}</span><h2 id="detail-title">${p.name}</h2><p>${p.description}</p><dl><dt>${t.material}</dt><dd>${p.material}</dd><dt>${t.size}</dt><dd>${t.consult}</dd></dl><a href="${links.shop}" target="_blank" rel="noopener noreferrer">${t.buy} ↗</a><a href="${links.instagram}" target="_blank" rel="noopener noreferrer">${t.inquiry} ↗</a>`);}
});
ui.addEventListener('pointerover',ev=>{const b=ev.target.closest('.page-corner');if(b&&!busy)scene?.previewCorner(b.dataset.action==='next'?1:-1);});
ui.addEventListener('pointerout',ev=>{if(ev.target.closest('.page-corner'))scene?.previewCorner(0);});
ui.addEventListener('focusin',ev=>{const b=ev.target.closest('.page-corner');if(b&&!busy)scene?.previewCorner(b.dataset.action==='next'?1:-1);});
ui.addEventListener('focusout',ev=>{if(ev.target.closest('.page-corner'))scene?.previewCorner(0);});
window.addEventListener('keydown',ev=>{if(ev.target.closest('input,textarea,select')||busy)return;if(ev.key==='Escape')closeInsert();if(detail||contents)return;if(ev.key==='ArrowRight'){ev.preventDefault();go(index===4?-1:index+1);}if(ev.key==='ArrowLeft'&&index>=0){ev.preventDefault();go(index-1);}});
let touch;
ui.addEventListener('pointerdown',ev=>{if(ev.pointerType==='touch'&&!ev.target.closest('button,a,.chapter-reading,.inset'))touch={x:ev.clientX,y:ev.clientY};});
ui.addEventListener('pointerup',ev=>{if(!touch)return;const dx=ev.clientX-touch.x,dy=ev.clientY-touch.y;touch=null;if(Math.abs(dx)>70&&Math.abs(dy)<45&&!detail&&!contents){if(dx<0)go(index===4?-1:index+1);else if(index>=0)go(index-1);}});
window.addEventListener('hashchange',()=>go(copy[lang].chapters.findIndex(c=>c.id===location.hash.slice(1))));
render();if(location.hash&&location.hash!=='#cover')go(copy[lang].chapters.findIndex(c=>c.id===location.hash.slice(1)));
