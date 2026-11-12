import * as THREE from 'three';
import {PageFilmCompositor} from './page-film/compositor.js';
import {decodePageFilm,completionShader} from './page-film/shader.js';
import {completionEffect} from './content/page-film.js';
import {pageTypography,pageTextRows,pageStackAmount,pageHint} from './content/book.js';
import {ClothCase,FRONT_BOARD_THICKNESS} from './cloth-case.js';
import {createBookMarker,markerAttachment,createSpineBacking,updateSpineBacking} from './book-marker.js';
import {createLeafGeometry,updateLeafGeometry,conformCoverEndpaper,leftStackThickness} from './page-geometry.js';
import {rightSurfaceZ,PAPER_SURFACE_Z} from './binding-kinematics.js';
import {PAGE_WIDTH,PAGE_HEIGHT,paperHingeX} from './book-dimensions.js';

const smooth=p=>p*p*(3-2*p);
export class BookScene{
 constructor(canvas,onReady){
  this.canvas=canvas;this.dirty=true;this.opened=false;this.progress=0;this.chapter=0;this.quiet=false;this.leftStack=0;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0xeeeae2);
  this.filmMap={value:null};this.completionProgress={value:-1};this.canvas.dataset.completionEffect='none';this.supportsFilmCache=this.renderer.extensions.has('EXT_color_buffer_float');
  this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-5,5,4,-4,.1,100);this.camera.position.set(0,0,15);
  this.scene.add(new THREE.HemisphereLight(0xffffff,0xb6afa5,2.0));
  const sun=new THREE.DirectionalLight(0xfffaf2,2.4);sun.position.set(-4,5,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-7,right:7,top:6,bottom:-6,near:.1,far:25});sun.shadow.bias=-.0003;sun.shadow.normalBias=.015;sun.shadow.intensity=.35;this.scene.add(sun);this.sun=sun;
  const tableMat=new THREE.MeshStandardMaterial({color:0xe8e3da,roughness:1});
  this.table=new THREE.Mesh(new THREE.PlaneGeometry(80,80),tableMat);this.table.position.z=-.9;const contact=new THREE.Mesh(new THREE.PlaneGeometry(12,8.8),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{spread:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float spread;void main(){vec2 p=abs(vUv-.5)*2.;float a=(1.-smoothstep(.52,1.,p.x))*(1.-smoothstep(.48,1.,p.y));gl_FragColor=vec4(.21,.18,.15,a*.20);}' }));contact.position.set(.1,-.12,-.86);this.scene.add(contact);this.contactShadow=contact;this.table.receiveShadow=false;this.scene.add(this.table);
  this.bookMount=new THREE.Group();this.scene.add(this.bookMount);this.book=new THREE.Group();this.bookMount.add(this.book);
  this.restRotation=new THREE.Euler(-.40,.12,-.12);this.book.rotation.copy(this.restRotation);this.book.scale.setScalar(.84);
  this.clothCase=new ClothCase();this.book.add(this.clothCase.mesh);this.clothCase.mesh.castShadow=true;this.clothCase.mesh.receiveShadow=true;
  this.blackEdgeMaterial=new THREE.MeshStandardMaterial({color:0x27252a,roughness:1});this.white=this.paperCanvas(false);this.black=this.paperCanvas(true);this.textureCache=new Map();
  const blank=this.texture('white'),black=this.texture('black');
  this.edgeMaterial=new THREE.MeshStandardMaterial({color:0xd8d0bf,roughness:1});
  this.edgeMaterial.onBeforeCompile=s=>{
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 paperPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\npaperPosition=position;');
   s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 paperPosition;').replace('#include <color_fragment>',`#include <color_fragment>
    float d=paperPosition.z*170.;float line=abs(fract(d)-.5);float aa=max(fwidth(d),.04);
    diffuseColor.rgb*=1.-.13*(1.-smoothstep(.10,.10+aa,line));
    float clothJoin=1.-smoothstep(.004,.025,abs(paperPosition.x));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.009,.025,.082),clothJoin);`);
  };
  this.edgeMaterial.customProgramCacheKey=()=> 'paper-signatures-v2';
  this.blocks=[-1,1].map(side=>{
   const top=this.paperMaterial(black),back=this.paperMaterial(blank,true);
   const geometry=createLeafGeometry({thickness:side<0?.008:.36,block:side>0});updateLeafGeometry(geometry,0,side);
   const mesh=new THREE.Mesh(geometry,[top,back,this.edgeMaterial]);mesh.castShadow=true;mesh.receiveShadow=true;this.book.add(mesh);return mesh;
  });
  // A narrow, continuous lining remains recessed under the finite-thickness
  // hinge. No top-facing strip bridges or obscures the printed surfaces.
  this.blocks[0].material[1].map=black;this.spine=createSpineBacking();this.book.add(this.spine);
  this.sheets=Array.from({length:6},(_,i)=>{
   const material=[this.paperMaterial(blank),this.paperMaterial(blank,true),new THREE.MeshStandardMaterial({color:0xe9e1d1,roughness:1})];
   const mesh=new THREE.Mesh(createLeafGeometry({rows:i===0?80:20}),material);mesh.visible=false;mesh.castShadow=true;mesh.receiveShadow=true;this.book.add(mesh);return mesh;
  });
  const markCanvas=document.createElement('canvas');markCanvas.width=1024;markCanvas.height=256;const ctx=markCanvas.getContext('2d');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.font='700 150px Georgia';ctx.fillText('Peiry Tale',512,128,860);const mark=new THREE.CanvasTexture(markCanvas);mark.colorSpace=THREE.SRGBColorSpace;
  this.ribbon=createBookMarker(mark);this.book.add(this.ribbon);
  this.canvas.dataset.binding='loaded';this.canvas.dataset.bindingGeometry='continuous-cloth';
  document.addEventListener('visibilitychange',()=>{this.lastTick=performance.now();});this.resize=()=>this.fit();window.addEventListener('resize',this.resize);this.fit();this.pose(0);this.setMotion('resting');
  this.ready=this.makeCover().then(()=>this.renderer.compileAsync(this.scene,this.camera)).finally(()=>onReady?.());
  this.tick=this.tick.bind(this);this.frame=requestAnimationFrame(this.tick);
 }
 paperMaterial(map,verso=false){
  // Keep the paper below light clipping so its real surface normals remain
  // readable. Ambient light reaches the bound seam less readily than the
  // exposed leaf; this soft contact occlusion follows the material root even
  // while turning, rather than drawing a line over the book viewport.
  const material=new THREE.MeshStandardMaterial({map,color:0xebebeb,roughness:.97,metalness:0});
  const film={enabled:{value:0},transform:{value:new THREE.Vector2(.5,.5)}};material.userData.pageFilm=film;
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,{pageFilmMap:this.filmMap,pageFilmEnabled:film.enabled,pageFilmTransform:film.transform,completionProgress:this.completionProgress});
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 filmUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nfilmUv=uv;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D pageFilmMap;uniform float pageFilmEnabled;uniform vec2 pageFilmTransform;varying vec2 filmUv;\n'+decodePageFilm+completionShader).replace('#include <map_fragment>','#include <map_fragment>\nif(pageFilmEnabled>.5)diffuseColor.rgb*=pageFilmTransmission(texture2D(pageFilmMap,vec2(filmUv.x*pageFilmTransform.x+pageFilmTransform.y,filmUv.y)).rgb);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`if(pageFilmEnabled>.5)outgoingLight=castleCompletionColor(outgoingLight,vec2(filmUv.x*pageFilmTransform.x+pageFilmTransform.y,filmUv.y));\n#include <opaque_fragment>`);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float bindingDistance;').replace('#include <begin_vertex>',`#include <begin_vertex>\nbindingDistance=(${verso?'1.-uv.x':'uv.x'})*${PAGE_WIDTH.toFixed(8)};`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float bindingDistance;').replace('#include <aomap_fragment>',`#include <aomap_fragment>
    float distanceFromBinding=max(bindingDistance,0.);
    float bindingOcclusion=.28*exp(-distanceFromBinding/.28)+.14*exp(-distanceFromBinding/.018);
    reflectedLight.indirectDiffuse*=1.-bindingOcclusion;`);
  };
  material.customProgramCacheKey=()=>`bound-paper-film-v1-${verso?'verso':'front'}`;
  return material;
 }
 paperCanvas(dark){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1408;const c=canvas.getContext('2d');
  // Deterministic fine fibres and broad, quiet density variation keep black
  // stock charcoal and white stock warm without adding decorative content.
  const image=c.createImageData(canvas.width,canvas.height);let seed=1947;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const grain=((seed>>>24)/255-.5)*3.0,wave=Math.sin(x*.013+y*.009)*.8+Math.sin(y*.081)*.45,k=(y*canvas.width+x)*4;
   const base=dark?[30,29,31]:[242,237,225];for(let i=0;i<3;i++)image.data[k+i]=base[i]+grain+wave;image.data[k+3]=255;
  }
  c.putImageData(image,0,0);return canvas;
 }
 setFilmLayer(material,id,side,verso=false){const f=material.userData.pageFilm;if(!f)return;f.enabled.value=this.pageFilm&&id==='castle'?1:0;f.transform.value.set(verso?.5:side*.5,verso?0:.5);}
 attachPageFilm(film){this.pageFilm=film;this.filmMap.value=film.texture;this.blocks.forEach((b,i)=>this.setFilmLayer(b.material[0],this.page?.id,i?1:-1));this.filmCompositor?.invalidate();this.dirty=true;}
 projectPagePoint(x,y){
  this.book.updateWorldMatrix(true,false);
  const p=new THREE.Vector3(paperHingeX(1)+(x/960-.5)*2*PAGE_WIDTH,(.5-y/672)*PAGE_HEIGHT,PAPER_SURFACE_Z+.002).applyMatrix4(this.book.matrixWorld).project(this.camera);
  return {x:(p.x+1)*this.canvas.clientWidth/2,y:(1-p.y)*this.canvas.clientHeight/2};
 }
 texture(stock,page,lang='zh-TW'){
  const key=page?.heading?`${lang}/${page.id}/${this.mobile?'mobile':'desktop'}`:stock;if(this.textureCache.has(key))return this.textureCache.get(key);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1408;const c=canvas.getContext('2d');c.drawImage(stock==='black'?this.black:this.white,0,0);
  if(page?.heading){
   const {label,lines}=pageTextRows(page),layout=pageTypography.layout,size=this.mobile?'mobile':'desktop';
   const headingSize=(lang==='en'?pageTypography.englishHeading:pageTypography.heading)[size];
   c.textAlign='center';c.textBaseline='middle';
   c.fillStyle=layout.labelColor;c.font=`${pageTypography.weight} ${pageTypography.label[size]}px ${pageTypography.family}`;
   c.fillText(label,layout.x,layout.labelY,layout.maxWidth);
   c.fillStyle=layout.headingColor;c.font=`${pageTypography.weight} ${headingSize}px ${pageTypography.family}`;
   lines.forEach((line,i)=>c.fillText(line,layout.x,layout.headingY+i*layout.lineHeight,layout.maxWidth));
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textureCache.set(key,texture);return texture;
 }
 async makeCover(){
  try{
   const images=await Promise.all(['storybook-cover.webp','storybook-spine.webp','storybook-back.webp'].map(file=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(file));image.src=`${import.meta.env.BASE_URL}assets/${file}`;})));
   this.clothCase.setImages(...images,Math.min(8,this.renderer.capabilities.getMaxAnisotropy()));this.canvas.dataset.outerCloth='ready';this.dirty=true;
  }catch(error){this.canvas.dataset.outerCloth='unavailable';console.warn('Book cloth unavailable.',error.message);}
 }
 fit(){
  this.filmCompositor?.invalidate();const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;
  if(this.width!==w||this.height!==h){this.renderer.setSize(w,h,false);this.width=w;this.height=h;}const wasMobile=this.mobile;this.mobile=w<700;
  // Retain both leaves on mobile: the specified black/white progression and
  // complete spine must remain visible at every width.
  const width=THREE.MathUtils.lerp(this.mobile?5.4:10.2,10.0,smooth(this.progress)),height=Math.max(8.8,width*h/w,6.9*h/Math.max(180,h-170));
  this.camera.left=-height*w/h/2;this.camera.right=height*w/h/2;this.camera.top=height/2;this.camera.bottom=-height/2;this.camera.updateProjectionMatrix();
  this.layout={width:2*PAGE_WIDTH*w/(height*w/h),height:PAGE_HEIGHT*h/height,x:w/2,y:h/2-this.book.position.y*h/height};this.ribbon.position.copy(markerAttachment(this.progress,this.mobile));
  this.canvas.dispatchEvent(new CustomEvent('bookresize',{detail:this.layout}));if(wasMobile!==undefined&&wasMobile!==this.mobile&&this.page&&!this.animation)this.setSpread(this.page,this.chapter,this.lang);this.dirty=true;
 }
 pose(p){
  this.filmCompositor?.invalidate();this.renderer.shadowMap.needsUpdate=true;this.progress=p;const thickness=leftStackThickness(this.leftStack),rootLift=rightSurfaceZ(p,this.leftStack)-PAPER_SURFACE_Z;
  this.blocks[0].geometry.userData.thickness=thickness;updateLeafGeometry(this.blocks[0].geometry,0,-1);conformCoverEndpaper(this.blocks[0].geometry,p,{thickness});this.blocks[0].position.set(0,0,0);this.blocks[0].rotation.set(0,0,0);
  this.clothCase.update(p,this.leftStack);this.clothCase.setReadingLeaf(false);
  this.blocks[1].position.set(paperHingeX(p),0,0);Object.assign(this.blocks[1].geometry.userData,{boundToRear:true,rearProgress:p});updateLeafGeometry(this.blocks[1].geometry,0,1,rootLift);
  updateSpineBacking(this.spine,p,{amount:this.leftStack});
  this.contactShadow.scale.x=.5+.5*p;this.dirty=true;this.canvas.dataset.openingProgress=p.toFixed(4);this.canvas.dataset.leftStack=this.leftStack.toFixed(4);this.canvas.dataset.leftThickness=thickness.toFixed(4);this.fit();
 }
 setStack(amount){if(Math.abs(this.leftStack-amount)<1e-6)return;this.leftStack=amount;this.pose(this.progress);}
 setSpread(page,index=0,lang='zh-TW'){
  const hintEnabled=Boolean(this.hint);if(hintEnabled)this.setPageHint(false);
  this.filmCompositor?.invalidate();this.page=page;this.chapter=index;this.lang=lang;this.setStack(pageStackAmount(page));this.blocks[0].material[1].map=this.texture(page.left);this.blocks[0].material[1].needsUpdate=true;this.blocks[0].material[2]=page.left==='black'?this.blackEdgeMaterial:this.edgeMaterial;
  this.blocks.forEach((mesh,i)=>{mesh.material[0].map=this.texture(i?page.right:page.left,i?page:null,lang);mesh.material[0].needsUpdate=true;this.setFilmLayer(mesh.material[0],page.id,i?1:-1);});
  this.canvas.dataset.page=page.id;this.canvas.dataset.leftStock=page.left;this.canvas.dataset.rightStock=page.right;this.dirty=true;
  if(hintEnabled)this.setPageHint(true);
 }
 setPageHint(enabled){
  if(Boolean(this.hint)===enabled)return;
  if(!enabled){
   this.pendingCurl={page:this.page?.id,strength:this.hintStrength||0};this.hint=null;this.hintStrength=0;this.sheets[0].visible=false;
   if(this.page){this.blocks[1].material[0].map=this.texture(this.page.right,this.page,this.lang);this.blocks[1].material[0].needsUpdate=true;}
   this.canvas.dataset.pageHint='off';this.canvas.dataset.curlStrength='0.0000';this.dirty=true;return;
  }
  this.pendingCurl=null;this.hint={elapsed:0,started:null};this.hintStrength=0;this.canvas.dataset.pageHint='waiting';this.canvas.dataset.curlStrength='0.0000';
  const sheet=this.sheets[0];sheet.material[0].map=this.texture(this.page.right,this.page,this.lang);sheet.material[1].map=this.texture('white');sheet.material[0].needsUpdate=sheet.material[1].needsUpdate=true;this.setFilmLayer(sheet.material[0],this.page.id,1);this.setFilmLayer(sheet.material[1],null,-1,true);
  updateLeafGeometry(sheet.geometry,0,1,.009);sheet.visible=false;this.dirty=true;
 }
 updatePageHint(dt){
  const hint=this.hint;if(!hint||hint.started===null||this.animation||this.paused||document.hidden)return;
  hint.elapsed+=dt;const elapsed=hint.elapsed-pageHint.delay;
  let strength=0,state='waiting';
  if(elapsed>=0){
   if(elapsed<pageHint.unfurl){const t=elapsed/1000;strength=1-Math.exp(-4.5*t)*(Math.cos(8*t)+4.5/8*Math.sin(8*t));state='curling';}
   else{
    strength=1;state='resting';const time=elapsed-pageHint.unfurl,phase=time%pageHint.interval;
    // Pulse starts every 3000 ms; a damped wave settles fully between pulses.
    if(time>=pageHint.interval&&phase<pageHint.pulse){const t=phase/pageHint.pulse;strength+=.11*Math.sin(3*Math.PI*t)*Math.sin(Math.PI*t)**2*Math.exp(-2*t);state='pulse';}
   }
  }
  this.canvas.dataset.pageHint=state;this.canvas.dataset.hintElapsed=hint.elapsed.toFixed(1);
  if(Math.abs(strength-this.hintStrength)>1e-6){this.hintStrength=strength;const sheet=this.sheets[0];sheet.visible=strength>0;this.blocks[1].material[0].map=strength>0?this.texture('white'):this.texture(this.page.right,this.page,this.lang);this.blocks[1].material[0].needsUpdate=true;updateLeafGeometry(sheet.geometry,0,1,.009,strength);this.canvas.dataset.curlStrength=strength.toFixed(4);this.dirty=true;}
 }
 animate(duration,update,{linear=false,paint=true}={}){
  if(this.animation)throw Error('Book motion must be sequential');
  if(duration===0){update(1);this.dirty=true;return Promise.resolve(true);}
  return new Promise(resolve=>{this.animation={duration,elapsed:0,started:performance.now(),update,resolve,linear,paint};update(0);this.dirty=true;});
 }
 async finishMotion(){
  await this.ready;
  if(this.animation){const a=this.animation;this.animation=null;a.update(1);a.resolve(false);this.dirty=true;}
  await Promise.resolve();await Promise.resolve();
 }
 setMotion(state){if(state!=='open')this.stopCompletionSparkle();this.bindingMotion=state;this.canvas.dataset.bindingMotion=state;}
 async open(quiet=false,duration=1800){
  await this.ready;this.opened=true;this.fit();this.setMotion('opening');
  const q=this.bookMount.quaternion.clone(),start=this.book.rotation.clone();
  await this.animate(quiet?0:duration,p=>{
   this.bookMount.quaternion.slerpQuaternions(q,new THREE.Quaternion(),Math.min(1,p*4));this.bookMount.position.z*=1-p;
   this.pose(p);this.book.rotation.set(start.x*(1-p)-.07*p,start.y*(1-p),start.z*(1-p));this.book.scale.setScalar(.84+.16*p);
   this.book.position.set(0,.45*p+.08*Math.sin(Math.PI*p),.12*Math.sin(Math.PI*p));
  });
  this.pose(1);this.bookMount.quaternion.identity();this.bookMount.position.set(0,0,0);this.setMotion('open');this.dirty=true;
 }
 async close(quiet=false){
  await this.finishMotion();this.setMotion('closing');const start=this.book.rotation.clone();
  await this.animate(quiet?0:1400,p=>{this.pose(1-p);this.book.rotation.set(THREE.MathUtils.lerp(start.x,this.restRotation.x,p),this.restRotation.y*p,this.restRotation.z*p);this.book.scale.setScalar(1-.16*p);this.book.position.y=.45*(1-p);});
  this.opened=false;this.fit();this.pose(0);this.setMotion('resting');
 }
 async turn(next,index,lang,{duration=1050,quiet=false}={}){
  const previous=this.page,direction=index>=this.chapter?1:-1;
  const curl=direction>0&&this.pendingCurl?.page===previous.id?this.pendingCurl.strength:0;this.pendingCurl=null;
  if(quiet){this.setSpread(next,index,lang);return;}
  const sheet=this.sheets[0],forward=direction>0,startStack=this.leftStack,endStack=pageStackAmount(next);
  sheet.material[0].map=this.texture(forward?previous.right:next.right,forward?previous:next,lang);
  sheet.material[1].map=this.texture(forward?next.left:previous.left,null,lang);
  sheet.material[0].needsUpdate=sheet.material[1].needsUpdate=true;this.setFilmLayer(sheet.material[0],(forward?previous:next).id,1);this.setFilmLayer(sheet.material[1],(forward?next:previous).id,-1,true);
  // Only the revealed underneath leaf changes. The departing page remains
  // the same physical, textured shell until it lands on the opposite stack.
  this.blocks[forward?1:0].material[0].map=this.texture(forward?next.right:next.left,forward?next:null,lang);
  this.blocks[forward?1:0].material[0].needsUpdate=true;this.setFilmLayer(this.blocks[forward?1:0].material[0],next.id,forward?1:-1);
  sheet.visible=true;this.setMotion('turning');
  await this.animate(duration,p=>{this.setStack(THREE.MathUtils.lerp(startStack,endStack,p));const turnCurl=curl*(1-smooth(Math.min(1,p/.2)));updateLeafGeometry(sheet.geometry,forward?p:1-p,1,.009,turnCurl);this.canvas.dataset.turnCurlStrength=turnCurl.toFixed(4);this.canvas.dataset.turnProgress=p.toFixed(4);});
  this.setSpread(next,index,lang);sheet.visible=false;this.setMotion('open');this.dirty=true;
 }
 async riffle(next,index,lang,duration=2000){
  const white=this.texture('white');this.setMotion('riffling');
  for(const sheet of this.sheets){sheet.material[0].map=white;sheet.material[1].map=white;sheet.material[0].needsUpdate=sheet.material[1].needsUpdate=true;}
  const leafTime=.78,step=(2-leafTime)/5;
  await this.animate(duration,p=>{
   const time=p*2;let landed=0;for(let i=0;i<6;i++)landed+=smooth(THREE.MathUtils.clamp((time-(leafTime+i*step-.12))/.12,0,1))/6;this.setStack(landed*pageStackAmount(next));if(landed>0)this.blocks[0].material[2]=this.edgeMaterial;
   this.sheets.forEach((sheet,i)=>{
    const t=(time-i*step)/leafTime;sheet.visible=t>=0&&t<1;
    if(sheet.visible)updateLeafGeometry(sheet.geometry,smooth(Math.min(1,Math.max(0,t))),1,.009+(5-i)*.007);
   });
   if(time>=leafTime&&this.blocks[0].material[0].map!==white){this.blocks[0].material[0].map=white;this.blocks[0].material[0].needsUpdate=true;}
   // The title lies beneath the final sheet, so it is revealed by paper.
   if(time>=step*5){this.blocks[1].material[0].map=this.texture('white',next,lang);this.blocks[1].material[0].needsUpdate=true;}
   this.canvas.dataset.turnProgress=p.toFixed(4);
  },{linear:true});
  for(const sheet of this.sheets)sheet.visible=false;this.setSpread(next,index,lang);this.setMotion('open');this.dirty=true;
 }
 rotateInspection(dx,dy){
  if(this.opened)return;const distance=Math.hypot(dx,dy);if(!distance)return;
  const speed=2*Math.PI/Math.max(320,Math.min(this.canvas.clientWidth*.9,600));this.bookMount.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dy,dx,0).normalize(),distance*speed)).normalize();
  this.book.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(this.clothCase.mesh);this.bookMount.position.z+=Math.max(0,-.8-bounds.min.z);this.dirty=true;
 }
 resetInspection(){this.bookMount.quaternion.identity();this.bookMount.position.set(0,0,0);this.dirty=true;}
 setPaused(value){this.paused=value;this.lastTick=performance.now();}
 startCompletionSparkle(){
  if(this.completionPlayed||this.page?.id!=='castle')return;this.completionPlayed=true;this.completion={elapsed:0,started:false};this.completionProgress.value=0;this.canvas.dataset.completionEffect='active';this.dirty=true;
 }
 stopCompletionSparkle(){
  if(!this.completion)return;this.completion=null;this.completionProgress.value=-1;this.canvas.dataset.completionEffect='done';this.dirty=true;
 }
 updateCompletionSparkle(dt){
  const effect=this.completion;if(!effect||document.hidden||this.paused||this.animation)return;
  if(effect.started)effect.elapsed+=dt;else effect.started=true;
  if(effect.elapsed>=completionEffect.duration){this.stopCompletionSparkle();return;}
  this.completionProgress.value=effect.elapsed/completionEffect.duration;this.dirty=true;
 }
 canCachePageFilm(){
  // animate() resolves before turn() commits its spread and hides its leaf.
  // A finished animation clock alone must never enable the paper UV cache.
  return this.supportsFilmCache&&this.pageFilm&&this.page?.id==='castle'&&this.opened&&this.progress===1&&this.bindingMotion==='open'&&!this.animation&&!this.hint&&!this.sheets.some(s=>s.visible);
 }
 tick(now){
  const dt=Math.max(0,now-(this.lastTick??now));this.lastTick=now;
  if(this.animation||this.hint)this.renderer.shadowMap.needsUpdate=true;
  if(this.animation&&!this.paused&&!document.hidden){const a=this.animation;a.elapsed+=Math.min(dt,Math.max(0,now-a.started));const p=a.duration?Math.min(1,a.elapsed/a.duration):1;a.update(a.linear?p:smooth(p));if(a.paint)this.dirty=true;if(p===1){this.animation=null;a.resolve(true);}}
  this.updatePageHint(dt);this.updateCompletionSparkle(dt);if(this.pageFilm?.tick())this.dirty=true;
  if(this.dirty){if(this.canCachePageFilm()){this.canvas.dataset.renderPath='film-cache';this.filmCompositor??=new PageFilmCompositor(this.renderer,this.blocks,{background:[this.table,this.contactShadow,this.ribbon],foreground:this.book.children.filter(o=>o!==this.ribbon),completionProgress:this.completionProgress});this.filmCompositor.render(this.scene,this.camera,this.filmMap.value);}else{this.canvas.dataset.renderPath='physical';this.renderer.render(this.scene,this.camera);}this.canvas.dataset.drawCalls=String(this.renderer.info.render.calls);this.canvas.dataset.triangles=String(this.renderer.info.render.triangles);this.canvas.dataset.textures=String(this.renderer.info.memory.textures);this.dirty=false;this.canvas.dataset.renderCount=String((Number(this.canvas.dataset.renderCount)||0)+1);if(this.hint&&this.hint.started===null&&!this.animation)this.hint.started=now;}
  this.frame=requestAnimationFrame(this.tick);
 }
}
