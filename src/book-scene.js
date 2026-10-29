import * as THREE from 'three';
import {pageTypography,pageTextRows,pageStackAmount} from './content/book.js';
import {ClothCase,FRONT_BOARD_THICKNESS} from './cloth-case.js';
import {createBookMarker,markerAttachment,createSpineBacking,SPINE_BACKING_X} from './book-marker.js';
import {createLeafGeometry,updateLeafGeometry,conformCoverEndpaper,leftStackThickness,leftCoverLift,leftCoverTilt} from './page-geometry.js';

const smooth=p=>p*p*(3-2*p);
export class BookScene{
 constructor(canvas,onReady){
  this.canvas=canvas;this.dirty=true;this.opened=false;this.progress=0;this.chapter=0;this.quiet=false;this.leftStack=0;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0xeeeae2);
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
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
   const top=this.paperMaterial(black),back=this.paperMaterial(blank);
   const geometry=createLeafGeometry({thickness:side<0?.008:.36,block:side>0});updateLeafGeometry(geometry,0,side);
   const mesh=new THREE.Mesh(geometry,[top,back,this.edgeMaterial]);mesh.castShadow=true;mesh.receiveShadow=true;this.book.add(mesh);return mesh;
  });
  // A narrow, continuous binding lining closes the gutter underneath both
  // signatures. The paper roots overlap at x=0; no transparent overlay masks it.
  this.blocks[0].material[1].map=black;this.spine=createSpineBacking();this.book.add(this.spine);
  this.sheets=Array.from({length:6},()=>{
   const material=[this.paperMaterial(blank),this.paperMaterial(blank),new THREE.MeshStandardMaterial({color:0xe9e1d1,roughness:1})];
   const mesh=new THREE.Mesh(createLeafGeometry(),material);mesh.visible=false;mesh.castShadow=true;mesh.receiveShadow=true;this.book.add(mesh);return mesh;
  });
  const markCanvas=document.createElement('canvas');markCanvas.width=1024;markCanvas.height=256;const ctx=markCanvas.getContext('2d');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.font='700 150px Georgia';ctx.fillText('Peiry Tale',512,128,860);const mark=new THREE.CanvasTexture(markCanvas);mark.colorSpace=THREE.SRGBColorSpace;
  this.ribbon=createBookMarker(mark);this.book.add(this.ribbon);
  this.canvas.dataset.binding='loaded';this.canvas.dataset.bindingGeometry='continuous-cloth';
  document.addEventListener('visibilitychange',()=>{this.lastTick=performance.now();});this.resize=()=>this.fit();window.addEventListener('resize',this.resize);this.fit();this.pose(0);
  this.ready=this.makeCover().finally(()=>onReady?.());
  this.tick=this.tick.bind(this);this.frame=requestAnimationFrame(this.tick);
 }
 paperMaterial(map){return new THREE.MeshStandardMaterial({map,color:0xffffff,roughness:.97,metalness:0});}
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
  const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;
  if(this.width!==w||this.height!==h){this.renderer.setSize(w,h,false);this.width=w;this.height=h;}const wasMobile=this.mobile;this.mobile=w<700;
  // Retain both leaves on mobile: the specified black/white progression and
  // complete spine must remain visible at every width.
  const width=THREE.MathUtils.lerp(this.mobile?5.4:10.2,10.0,smooth(this.progress)),height=Math.max(8.8,width*h/w,6.9*h/Math.max(180,h-170));
  this.camera.left=-height*w/h/2;this.camera.right=height*w/h/2;this.camera.top=height/2;this.camera.bottom=-height/2;this.camera.updateProjectionMatrix();
  this.layout={width:7.96*w/(height*w/h),height:5.5*h/height,x:w/2,y:h/2};this.ribbon.position.copy(markerAttachment(this.progress,this.mobile));
  this.canvas.dispatchEvent(new CustomEvent('bookresize',{detail:this.layout}));if(wasMobile!==undefined&&wasMobile!==this.mobile&&this.page&&!this.animation)this.setSpread(this.page,this.chapter,this.lang);this.dirty=true;
 }
 pose(p){
  this.progress=p;const thickness=leftStackThickness(this.leftStack),coverLift=p*leftCoverLift(this.leftStack);this.blocks[0].geometry.userData.thickness=thickness;updateLeafGeometry(this.blocks[0].geometry,0,-1);const coverTilt=leftCoverTilt(this.leftStack),rootLift=(.09-FRONT_BOARD_THICKNESS)*(1-p);this.clothCase.update(p,coverLift,coverTilt);this.clothCase.setReadingLeaf(false);
  // The first opening lifts only the thin board and its black endpaper.
  // Signatures stay on the right until actual leaves land on the left.
  const hinge=-1.98+1.98*p;
  this.blocks[0].position.set(hinge,0,.20*(1-p)*(1-this.leftStack));this.blocks[0].rotation.y=Math.PI*(1-p);
  this.blocks[1].position.set(hinge,0,0);
  Object.assign(this.blocks[1].geometry.userData,{boundToRear:true,rearProgress:p});updateLeafGeometry(this.blocks[1].geometry,0,1,rootLift);
  const left=this.blocks[0];conformCoverEndpaper(left.geometry,p,{thickness,coverLift,coverTilt,rootLift});
  left.position.set(0,0,0);left.rotation.set(0,0,0);
  this.spine.visible=p<.08;this.spine.position.x=SPINE_BACKING_X+1.98*p;
  this.contactShadow.scale.x=.5+.5*p;this.dirty=true;this.canvas.dataset.openingProgress=p.toFixed(4);this.canvas.dataset.leftStack=this.leftStack.toFixed(4);this.canvas.dataset.leftThickness=thickness.toFixed(4);this.fit();
 }
 setStack(amount){if(Math.abs(this.leftStack-amount)<1e-6)return;this.leftStack=amount;this.pose(this.progress);}
 setSpread(page,index=0,lang='zh-TW'){
  this.page=page;this.chapter=index;this.lang=lang;this.setStack(pageStackAmount(page));this.blocks[0].material[1].map=this.texture(page.left);this.blocks[0].material[1].needsUpdate=true;this.blocks[0].material[2]=page.left==='black'?this.blackEdgeMaterial:this.edgeMaterial;
  this.blocks.forEach((mesh,i)=>{mesh.material[0].map=this.texture(i?page.right:page.left,i?page:null,lang);mesh.material[0].needsUpdate=true;});
  this.canvas.dataset.page=page.id;this.canvas.dataset.leftStock=page.left;this.canvas.dataset.rightStock=page.right;this.dirty=true;
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
 async open(quiet=false,duration=1800){
  await this.ready;this.opened=true;this.fit();this.canvas.dataset.bindingMotion='opening';
  const q=this.bookMount.quaternion.clone(),start=this.book.rotation.clone();
  await this.animate(quiet?0:duration,p=>{
   this.bookMount.quaternion.slerpQuaternions(q,new THREE.Quaternion(),Math.min(1,p*4));this.bookMount.position.z*=1-p;
   this.pose(p);this.book.rotation.set(start.x*(1-p)-.07*p,start.y*(1-p),start.z*(1-p));this.book.scale.setScalar(.84+.16*p);
   this.book.position.set(0,.45*p+.08*Math.sin(Math.PI*p),.12*Math.sin(Math.PI*p));
  });
  this.pose(1);this.bookMount.quaternion.identity();this.bookMount.position.set(0,0,0);this.canvas.dataset.bindingMotion='open';this.dirty=true;
 }
 async close(quiet=false){
  await this.finishMotion();this.canvas.dataset.bindingMotion='closing';const start=this.book.rotation.clone();
  await this.animate(quiet?0:1400,p=>{this.pose(1-p);this.book.rotation.set(THREE.MathUtils.lerp(start.x,this.restRotation.x,p),this.restRotation.y*p,this.restRotation.z*p);this.book.scale.setScalar(1-.16*p);this.book.position.y=.45*(1-p);});
  this.opened=false;this.fit();this.pose(0);this.canvas.dataset.bindingMotion='resting';
 }
 async turn(next,index,lang,{duration=1050,quiet=false}={}){
  const previous=this.page,direction=index>=this.chapter?1:-1;
  if(quiet){this.setSpread(next,index,lang);return;}
  const sheet=this.sheets[0],forward=direction>0,startStack=this.leftStack,endStack=pageStackAmount(next);
  sheet.material[0].map=this.texture(forward?previous.right:next.right,forward?previous:next,lang);
  sheet.material[1].map=this.texture(forward?next.left:previous.left,null,lang);
  sheet.material[0].needsUpdate=sheet.material[1].needsUpdate=true;
  // Only the revealed underneath leaf changes. The departing page remains
  // the same physical, textured shell until it lands on the opposite stack.
  this.blocks[forward?1:0].material[0].map=this.texture(forward?next.right:next.left,forward?next:null,lang);
  this.blocks[forward?1:0].material[0].needsUpdate=true;
  sheet.visible=true;this.canvas.dataset.bindingMotion='turning';
  await this.animate(duration,p=>{this.setStack(THREE.MathUtils.lerp(startStack,endStack,p));updateLeafGeometry(sheet.geometry,forward?p:1-p,1,.009);this.canvas.dataset.turnProgress=p.toFixed(4);});
  this.setSpread(next,index,lang);sheet.visible=false;this.canvas.dataset.bindingMotion='open';this.dirty=true;
 }
 async riffle(next,index,lang,duration=2000){
  const white=this.texture('white');this.canvas.dataset.bindingMotion='riffling';
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
  for(const sheet of this.sheets)sheet.visible=false;this.setSpread(next,index,lang);this.canvas.dataset.bindingMotion='open';this.dirty=true;
 }
 rotateInspection(dx,dy){
  if(this.opened)return;const distance=Math.hypot(dx,dy);if(!distance)return;
  const speed=2*Math.PI/Math.max(320,Math.min(this.canvas.clientWidth*.9,600));this.bookMount.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dy,dx,0).normalize(),distance*speed)).normalize();
  this.book.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(this.clothCase.mesh);this.bookMount.position.z+=Math.max(0,-.8-bounds.min.z);this.dirty=true;
 }
 resetInspection(){this.bookMount.quaternion.identity();this.bookMount.position.set(0,0,0);this.dirty=true;}
 setPaused(value){this.paused=value;this.lastTick=performance.now();}
 tick(now){
  const dt=Math.max(0,now-(this.lastTick??now));this.lastTick=now;
  if(this.animation&&!this.paused&&!document.hidden){const a=this.animation;a.elapsed+=Math.min(dt,Math.max(0,now-a.started));const p=a.duration?Math.min(1,a.elapsed/a.duration):1;a.update(a.linear?p:smooth(p));if(a.paint)this.dirty=true;if(p===1){this.animation=null;a.resolve(true);}}
  if(this.dirty){this.renderer.render(this.scene,this.camera);this.canvas.dataset.drawCalls=String(this.renderer.info.render.calls);this.canvas.dataset.triangles=String(this.renderer.info.render.triangles);this.canvas.dataset.textures=String(this.renderer.info.memory.textures);this.dirty=false;this.canvas.dataset.renderCount=String((Number(this.canvas.dataset.renderCount)||0)+1);}
  this.frame=requestAnimationFrame(this.tick);
 }
}
