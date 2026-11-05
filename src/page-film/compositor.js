import * as THREE from 'three';
import {decodePageFilm,completionShader} from './shader.js';
// Cache only the stationary book. The physical table/contact shadow always use
// the same output pass as page turns, preserving their transparent blending.
// The translucent beads/engraving stay in that pass too; they are not paper ink.
export class PageFilmCompositor{
 constructor(renderer,blocks,{background,foreground,completionProgress}){
  this.renderer=renderer;this.blocks=blocks;this.background=background;this.foreground=foreground;this.valid=false;this.uvScene=new THREE.Scene();
  // Query the actual color format, rather than assuming global MAX_SAMPLES
  // also applies to half-float targets. UV coordinates remain single-sampled.
  const gl=renderer.getContext(),samples=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES);
  this.samples=Math.max(0,...Array.from(samples||[]).filter(n=>n<=4));
  this.proxies=blocks.map((block,i)=>{const front=new THREE.ShaderMaterial({uniforms:{pageSide:{value:i?1:-1}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float pageSide;varying vec2 p;void main(){gl_FragColor=vec4(.5+pageSide*p.x*.5,p.y,0.,1.);}',blending:THREE.NoBlending,toneMapped:false});const hidden=new THREE.ShaderMaterial({vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'void main(){discard;}'});const proxy=new THREE.Mesh(block.geometry,[front,hidden,hidden]);proxy.matrixAutoUpdate=false;proxy.frustumCulled=false;this.uvScene.add(proxy);return proxy;});
  this.scene=new THREE.Scene();this.camera=new THREE.Camera();this.geometry=new THREE.PlaneGeometry(2,2);this.material=new THREE.ShaderMaterial({uniforms:{light:{value:null},coordinates:{value:null},film:{value:null},completionProgress},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D light,coordinates,film;varying vec2 p;${decodePageFilm}${completionShader}\nvoid main(){vec4 book=texture2D(light,p);vec3 color=book.rgb/max(book.a,.00001);vec4 uv=texture2D(coordinates,p);if(uv.a>.5){color*=pageFilmTransmission(texture2D(film,uv.rg).rgb);color=castleCompletionColor(color,uv.rg);}gl_FragColor=vec4(color,book.a);\n#include <colorspace_fragment>\n}`,depthTest:false,depthWrite:false,transparent:true,toneMapped:false});this.scene.add(new THREE.Mesh(this.geometry,this.material));
 }
 invalidate(){this.valid=false;}
 render(scene,camera,film){
  const r=this.renderer,size=r.getDrawingBufferSize(new THREE.Vector2());if(!this.light||this.light.width!==size.x||this.light.height!==size.y){this.light?.dispose();this.coordinates?.dispose();this.light=new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.HalfFloatType,samples:this.samples,generateMipmaps:false});this.light.texture.colorSpace=THREE.LinearSRGBColorSpace;this.coordinates=new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,generateMipmaps:false});this.coordinates.texture.colorSpace=THREE.NoColorSpace;this.valid=false;}
  const previous=r.getRenderTarget(),clear=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha(),auto=r.autoClear,shadowUpdate=r.shadowMap.needsUpdate,shadowAuto=r.shadowMap.autoUpdate,foregroundVisible=this.foreground.map(o=>o.visible),backgroundVisible=this.background.map(o=>o.visible),flags=this.blocks.map(b=>b.material[0].userData.pageFilm.enabled),values=flags.map(f=>f.value);
  try{
   r.autoClear=true;
   if(!this.valid){
    flags.forEach(f=>f.value=0);this.background.forEach(o=>o.visible=false);r.setClearColor(0,0);r.setRenderTarget(this.light);r.render(scene,camera);flags.forEach((f,i)=>f.value=values[i]);this.background.forEach((o,i)=>o.visible=backgroundVisible[i]);
    scene.updateMatrixWorld(true);this.proxies.forEach((p,i)=>p.matrix.copy(this.blocks[i].matrixWorld));r.setRenderTarget(this.coordinates);r.render(this.uvScene,camera);this.material.uniforms.light.value=this.light.texture;this.material.uniforms.coordinates.value=this.coordinates.texture;this.valid=true;
   }
   r.setRenderTarget(previous);r.setClearColor(clear,alpha);this.foreground.forEach(o=>o.visible=false);r.shadowMap.needsUpdate=false;r.shadowMap.autoUpdate=false;r.render(scene,camera);
   this.foreground.forEach((o,i)=>o.visible=foregroundVisible[i]);this.material.uniforms.film.value=film;r.autoClear=false;r.render(this.scene,this.camera);
  }finally{
   flags.forEach((f,i)=>f.value=values[i]);this.background.forEach((o,i)=>o.visible=backgroundVisible[i]);this.foreground.forEach((o,i)=>o.visible=foregroundVisible[i]);r.setRenderTarget(previous);r.setClearColor(clear,alpha);r.autoClear=auto;r.shadowMap.autoUpdate=shadowAuto;r.shadowMap.needsUpdate=shadowUpdate;
  }
 }
 dispose(){this.light?.dispose();this.coordinates?.dispose();this.proxies.forEach(p=>new Set(p.material).forEach(m=>m.dispose()));this.geometry.dispose();this.material.dispose();}
}
