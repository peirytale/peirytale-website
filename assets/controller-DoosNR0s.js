import{P as D,S as L,C as I,a as z,b as O,g as t,c as P,d as m,V as j,M as U,f as x,T as B,N as G,L as N}from"./index-55OcaSHP.js";import{r as S}from"./regions-B4OOdhsX.js";const V=`
float shaft(vec2 v,vec2 direction,float spread){
 float along=dot(v,direction),across=dot(v,vec2(-direction.y,direction.x));
 float width=7.+max(0.,along)*spread;
 return exp(-across*across/(width*width))*smoothstep(-12.,28.,along);
}
vec3 radiance(vec2 q){
 vec2 origin=vec2((aperture.x+aperture.y)*.5,door.y);
 float distance=length(q-origin),range=24.+lightRange*pow(flood,1.6);
 float warmth=.2+.8*exp(-distance/(range*.52+1.));
 return mix(edgeColor,coreColor,warmth);
}
vec3 scatterDoorLight(vec3 pigment,vec2 q){
 if(flood<=0.)return pigment;
 vec2 origin=vec2((aperture.x+aperture.y)*.5,clamp(q.y,door.y-42.,door.y+45.));
 vec2 v=q-origin;float distance=length(v),range=24.+lightRange*pow(flood,1.6);
 float rays=.9*shaft(v,vec2(-.58,.815),.16)+shaft(v,vec2(.12,.993),.11)
  +.65*shaft(v,vec2(.71,.704),.22)+.55*shaft(v,vec2(-.80,-.60),.19)
  +.48*shaft(v,vec2(-.05,-.999),.25)+.6*shaft(v,vec2(.98,-.199),.14);
 // The physical door leaves occlude early light. Preserve their visible pink
 // surfaces while they rotate, then let the late exposure wash over them.
 vec3 mask=texture2D(doorMasks,p).rgb;
 float gap=step(aperture.x,q.x)*(1.-step(aperture.y,q.x));
 float blocked=max(mask.b,mask.g)*(1.-gap)*(1.-smoothstep(.45,.82,flood));
 float density=lightStrength*flood*exp(-distance/range)*(.34+rays)*(1.-blocked);
 float transmission=exp(-density);
 vec3 original=max(vec3(0.),1.+(pigment*255.-128.)/127.);
 return encode(original*transmission+radiance(q)*(1.-transmission));
}
vec3 exposePage(vec3 pigment,vec2 q){
 // Only after the door and rays have become clearly visible does the scattered
 // light saturate the entire physical spread, including its outer lace margin.
 float veil=smoothstep(veilStart,1.,flood);
 float distance=length(q-vec2((aperture.x+aperture.y)*.5,door.y));
 vec3 tone=mix(edgeColor,coreColor,.23+.24*exp(-distance/380.));
 return mix(pigment,encode(tone),veil);
}
`,$="varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}",Q=`
uniform sampler2D base,atlas,flowMap,doorMasks;
uniform vec2 pageSize,feet,cell,nextCell,flowCell,door,aperture;
uniform vec4 entryClip;
uniform vec3 coreColor,edgeColor;
uniform float height,visible,light,flood,poseMix,flowScale,lift,lean,lightRange,lightStrength,veilStart;
uniform bool useFlow;
varying vec2 p;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 encode(vec3 transmission){return clamp((128.+127.*(transmission-1.))/255.,0.,1.);}
${V}
float inCell(vec2 uv){return step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);}
vec4 pose(vec2 which,vec2 uv){vec4 c=texture2D(atlas,vec2((which.x+clamp(uv.x,0.,1.))/8.,1.-(which.y+clamp(uv.y,0.,1.))/8.));return vec4(linearRGB(c.rgb),c.a*inCell(uv));}
vec3 motion(vec2 uv,float backward){return texture2D(flowMap,vec2((flowCell.x+clamp(uv.x,0.,1.))/8.,1.-(flowCell.y+backward*8.+clamp(uv.y,0.,1.))/16.)).rgb;}
vec2 displacement(vec3 c){return (c.rg*255.-128.)/127.*flowScale;}
vec4 runningPose(vec2 uv){
 if(!useFlow)return pose(cell,uv);
 // Bidirectional inverse warps meet at one intermediate silhouette. Confidence
 // reduces disoccluded contributions; colors blend in premultiplied linear RGB.
 vec2 a=uv,b=uv;for(int i=0;i<3;i++){a=uv-poseMix*displacement(motion(a,0.));b=uv-(1.-poseMix)*displacement(motion(b,1.));}
 vec4 pa=pose(cell,a),pb=pose(nextCell,b);float wa=(1.-poseMix)*max(.15,motion(a,0.).b),wb=poseMix*max(.15,motion(b,1.).b);
 float alpha=pa.a*wa+pb.a*wb;vec3 color=(pa.rgb*pa.a*wa+pb.rgb*pb.a*wb)/max(alpha,.00001);
 return vec4(color,alpha/max(wa+wb,.00001));
}
void main(){
 vec2 q=vec2(p.x,1.-p.y)*pageSize;
 vec3 ink=texture2D(base,p).rgb;
 ink=scatterDoorLight(ink,q);
 // Reveal through the inner ornament, leaving its line and the surrounding
 // bare paper intact. This clip belongs to the actor only, never to the light.
 float actorClip=smoothstep(entryClip.x,entryClip.x+1.,q.x)*(1.-smoothstep(entryClip.z-1.,entryClip.z,q.x))
  *smoothstep(entryClip.y,entryClip.y+1.,q.y)*(1.-smoothstep(entryClip.w-1.,entryClip.w,q.y));
 float flight=clamp(lift/(height*.05),0.,1.);
 vec2 shadow=(q-feet)/vec2(height*.22*(1.-flight*.2),height*.035);
 // No shadow may precede the face while the feet are still outside the paper.
 float edge=min(min(feet.x-entryClip.x,entryClip.z-feet.x),min(feet.y-entryClip.y,entryClip.w-feet.y));
 float contact=exp(-dot(shadow,shadow)*2.)*.16*(1.-flight*.45)*visible*smoothstep(0.,height*.18,edge)*actorClip;
 if(contact>.0001)ink=encode(max(vec3(0.),1.+(ink*255.-128.)/127.)*(1.-contact));
 float tile=height/230.*256.;
 vec2 delta=q-feet+vec2(0.,lift);float c=cos(lean),s=sin(lean);
 vec2 uv=vec2(c*delta.x+s*delta.y,-s*delta.x+c*delta.y)/tile+vec2(.5,248./256.);
 if(inCell(uv)>.5&&actorClip>0.){vec4 sprite=runningPose(uv);ink=mix(ink,encode(sprite.rgb),sprite.a*visible*actorClip);}
 ink=exposePage(ink,q);
 gl_FragColor=vec4(ink,1.);
}`;function W(s,e){const r=[s[0]],i=(a,h,l)=>a.map((n,c)=>n+(h[c]-n)*l);for(let a=1;a<s.length-1;a++){const h=s[a-1],l=s[a],n=s[a+1],c=Math.hypot(l[0]-h[0],l[1]-h[1]),p=Math.hypot(n[0]-l[0],n[1]-l[1]),o=Math.min(e,c*.25,p*.25),u=i(l,h,o/c),v=i(l,n,o/p);r.push(u);for(let d=1;d<=8;d++){const g=d/8;r.push(i(i(u,l,g),i(l,v,g),g))}}return r.push(s.at(-1)),r}function E(s,e,r,i=2){const a=[s[0]],h=[0],l=[0];for(let n=1;n<s.length;n++){const c=s[n-1],p=s[n],o=Math.max(1,Math.ceil(Math.hypot(p[0]-c[0],p[1]-c[1])/i));for(let u=1;u<=o;u++){const v=c.map((b,y)=>b+(p[y]-b)*u/o),d=a.at(-1),g=Math.hypot(v[0]-d[0],v[1]-d[1]),M=(1/(d[2]/e)**r+1/(v[2]/e)**r)/2;a.push(v),h.push(h.at(-1)+g),l.push(l.at(-1)+g*M)}}return{route:a,lengths:h,times:l}}function _(s,e){s=Math.max(0,Math.min(1,s));const r=1-e,i=1-e/2;if(s<=r)return s/i;const a=(s-r)/e;return(r+e*(a/2+Math.sin(Math.PI*a)/(2*Math.PI)))/i}const J=[[1,2,3,4,5,6],[1,2,3,4,5,6],[1,2,3,4,5,6],[1,2,3,4,5,6],[1,2,3,4,5,6],[1,2,3,4,5,6],[1,3,6,2,4,5],[1,2,3,4,5,6]],K=6,X=128,Y=32,w={frames:J,landingFrame:K,flowCell:X,flowRange:Y},F=s=>Math.max(0,Math.min(1,s)),Z=s=>(s=F(s),s*s*s*(s*(s*6-15)+10)),H=s=>s-Math.floor(s);function ee(s,e,r,i){const a=e-i.landing,h=o=>i.cyclesPerSecond*(o-i.cadenceSlowdown*o*o/(2*e)),l=w.frames[i.facing].indexOf(w.landingFrame)/6,n=H(h(Math.min(s,a))-h(a)+l);if(s>=a){const o=F((s-a)/i.landing),u=Z(o),v=i.lift*Math.sin(2*Math.PI*l)**2,d=i.lift*2*Math.PI*Math.sin(4*Math.PI*l)*i.cyclesPerSecond*(1-i.cadenceSlowdown*a/e),g=(2*o*o*o-3*o*o+1)*v+(o*o*o-2*o*o+o)*i.landing*d;return{from:w.landingFrame,to:0,index:7,mix:u,phase:l,lift:Math.max(0,g),weight:1-u}}const c=n*6,p=Math.floor(c);return{from:w.frames[r][p],to:w.frames[r][(p+1)%6],index:p,mix:c-p,phase:n,lift:i.lift*Math.sin(2*Math.PI*n)**2,weight:1}}const k=s=>Math.max(0,Math.min(1,s)),q=(s,e,r,i,a)=>{const h=k(s),l=r-e;return e+i*h+(10*l-6*i-4*a)*h**3+(-15*l+8*i+7*a)*h**4+(6*l-3*i-3*a)*h**5};function A(s,e,r){const i=k(s),{match:a,anticipation:h,joinSpeed:l}=r,n=Math.PI/2,c=(n-e)/(1-a+h/2)*l,p=e+c*h/2;if(i>=a){const u=q((i-a)/(1-a),p,n,c*(1-a),0);return{left:u,right:u}}const o=k((i-a+h)/h);return{left:e+c*h*(o**3-.5*o**4),right:q(i/a,0,p,0,c*a)}}const R=s=>(s=x.clamp(s,0,1),s*s*s*(s*(s*6-15)+10));class ae{constructor(e,r=()=>{},i=null,a=null){this.rig=e,this.renderer=e.renderer,this.onState=r,this.complete=!0,this.state="idle",this.time=0,this.active=!1,this.disposed=!1,this.target=e.target.clone(),this.target.scissorTest=!1,this.geometry=new D(2,2),this.scene=new L,this.camera=new I,this.material=new z({uniforms:{base:{value:e.texture},atlas:{value:null},flowMap:{value:null},doorMasks:{value:e.masks},pageSize:{value:new m(...t.size)},entryClip:{value:new j(...t.entryClip)},feet:{value:new m},cell:{value:new m},nextCell:{value:new m},flowCell:{value:new m},poseMix:{value:0},flowScale:{value:w.flowRange/w.flowCell},useFlow:{value:!1},lift:{value:0},lean:{value:0},door:{value:new m(...t.door)},aperture:{value:new m(t.door[0],t.door[0])},coreColor:{value:new P(...t.lighting.core)},edgeColor:{value:new P(...t.lighting.edge)},lightRange:{value:t.lighting.range},lightStrength:{value:t.lighting.strength},veilStart:{value:t.lighting.veilStart},height:{value:156},visible:{value:0},light:{value:0},flood:{value:0}},vertexShader:$,fragmentShader:Q,depthTest:!1,depthWrite:!1,blending:O,toneMapped:!1}),this.scene.add(new U(this.geometry,this.material));const h=E(W(t.route,t.cornerRadius),t.route[0][2],t.perspectiveSpeedPower);this.route=h.route,this.lengths=h.lengths,this.travelTimes=h.times,this.totalLength=this.lengths.at(-1),this.totalTravelTime=this.travelTimes.at(-1);const l=async(n,c)=>{const p=n?URL.createObjectURL(n):`/peirytale-website/assets/${c}`;try{const o=await new B().loadAsync(p);return o.colorSpace=G,o.generateMipmaps=!1,o.minFilter=o.magFilter=N,o}finally{n&&URL.revokeObjectURL(p)}};this.ready=Promise.allSettled([l(i,t.atlas),l(a,t.flowAtlas)]).then(n=>{const c=n.find(u=>u.status==="rejected");if(this.disposed||c){if(n.forEach(u=>{u.status==="fulfilled"&&u.value.dispose()}),c)throw c.reason;return}const[p,o]=n.map(u=>u.value);this.atlas=p,this.flow=o,this.material.uniforms.atlas.value=p,this.material.uniforms.flowMap.value=o,this.loaded=!0,this.emit()}),this.abort=new AbortController,document.addEventListener("visibilitychange",()=>{this.last=null},{signal:this.abort.signal})}get texture(){return this.state==="idle"?this.rig.texture:this.target.texture}setActive(e,r=!1){this.active=e,this.quiet=r,this.last=null,this.rig.setActive(e,r),r&&this.state!=="idle"&&this.finishQuiet(),this.emit()}start(){return!this.loaded||!this.active||this.state!=="idle"||this.disposed?!1:(this.time=0,this.last=null,this.state="approaching",this.manual=!1,this.entryOpening=this.rig.opening||0,this.invitationTarget=Math.max(this.entryOpening,t.invitationAngle),this.rig.moveDoorTo(this.invitationTarget,{duration:t.normalize,rightAngle:0,monotonic:!0,clock:()=>this.time}),this.quiet?this.finishQuiet():(this.update(),this.draw(),this.emit()),!0)}finishQuiet(){this.time=t.approach+t.settle+t.push,this.state="lit",this.rig.holdDoor(Math.PI/2,{rightAngle:Math.PI/2}),this.update(),this.draw(),this.emit()}cancel(){this.state!=="idle"&&(this.state="idle",this.time=0,this.light=0,this.flood=0,this.feet=null,this.last=null,this.manual=!1,this.rig.resume(),this.emit())}pathAt(e){const r=x.clamp(e/t.approach,0,1),i=this.totalTravelTime*_(r,t.arrivalSlowdown);let a=1;for(;a<this.travelTimes.length-1&&i>this.travelTimes[a];)a++;const h=this.route[a-1],l=this.route[a],n=(i-this.travelTimes[a-1])/(this.travelTimes[a]-this.travelTimes[a-1]);return h.map((c,p)=>x.lerp(c,l[p],n))}headingAt(e){const r=this.pathAt(e-t.running.turnWindow/2),i=this.pathAt(e+t.running.turnWindow/2);return Math.atan2(i[1]-r[1],i[0]-r[0])}update(){const e=this.material.uniforms,r=this.time,i=t.approach,a=i+t.settle,h=a+t.push;let l=t.route.at(-1),n=t.facing,c=0,p=0,o=0,u=0,v=0,d=0;if(r<i){this.state="approaching",l=this.pathAt(r);const y=this.headingAt(r);n=(Math.round(y/(Math.PI/4))+8)%8;const f=ee(r,i,n,t.running);c=f.from,p=f.to,o=f.mix,u=f.index,v=f.lift*l[2]/t.route[0][2];const C=Math.sin(this.headingAt(r+.06)-this.headingAt(r-.06));d=x.clamp((Math.cos(y)+C)*t.running.lean,-.055,.055)*f.weight}else r<a?this.state="at-door":r<h?this.state="pushing":this.state="lit";this.feet=[l[0],l[1]],this.row=n,this.frame=c,this.nextFrame=p,this.poseMix=o,this.lift=v,this.lean=d,this.light=R((r-a)/t.push),this.flood=this.light;const g=t.size[0]/S.size[0],M=S.doorSeam*g,b=(y,f)=>{const C=S.parts[y].root*g,T=M-C;return M+(C+T*Math.cos(f)-M)/(1-Math.abs(T)*Math.sin(f)/(S.perspective*g))};e.aperture.value.set(b(3,this.rig.opening||0),b(4,this.rig.rightOpening||0)),e.feet.value.set(...this.feet),e.height.value=l[2],e.cell.value.set(c,n),e.nextCell.value.set(p,n),e.flowCell.value.set(u,n),e.poseMix.value=o,e.useFlow.value=c!==p&&o>0,e.lift.value=v,e.lean.value=d,e.visible.value=1,e.light.value=this.light,e.flood.value=this.flood}draw(){if(!this.loaded||this.state==="idle"||this.disposed)return;const e=this.renderer,r=e.getRenderTarget(),i=e.autoClear;this.material.uniforms.base.value=this.rig.texture;try{e.autoClear=!0,e.setRenderTarget(this.target),e.render(this.scene,this.camera)}finally{e.setRenderTarget(r),e.autoClear=i}this.rig.onFrame()}tick(){if(!this.active||document.hidden||this.disposed||this.manual||this.state==="idle"||this.quiet)return this.last=null,this.rig.tick();const e=performance.now(),r=this.last==null?0:Math.max(0,(e-this.last)/1e3);this.last=e;const i=this.time;return this.time=Math.min(t.approach+t.settle+t.push,this.time+r),i<t.approach+t.settle&&this.time>=t.approach+t.settle&&(this.rig.holdDoor(this.invitationTarget),this.rig.openFully({duration:t.push,rightAngle:Math.PI/2,profile:a=>A(a,this.invitationTarget,t.pairedDoor),clock:()=>this.time-t.approach-t.settle})),this.rig.tick(),this.update(),this.draw(),this.emit(),!0}seek(e){this.entryOpening??(this.entryOpening=this.rig.opening||0),this.invitationTarget??(this.invitationTarget=Math.max(this.entryOpening,t.invitationAngle)),this.manual=!0,this.time=x.clamp(e,0,t.approach+t.settle+t.push);const r=x.lerp(this.entryOpening,this.invitationTarget,R(this.time/t.normalize)),i=this.time<t.approach+t.settle?{left:r,right:0}:A((this.time-t.approach-t.settle)/t.push,this.invitationTarget,t.pairedDoor);this.rig.holdDoor(i.left,{rightAngle:i.right}),this.rig.manual=!0,this.update(),this.draw(),this.emit()}emit(){this.onState({state:this.state,time:this.time,loaded:!!this.loaded,active:this.active,feet:this.feet,row:this.row,frame:this.frame,light:this.light||0,flood:this.flood||0})}restore(){this.atlas&&(this.atlas.needsUpdate=!0),this.flow&&(this.flow.needsUpdate=!0),this.draw(),this.emit()}dispose(){var e,r;this.disposed||(this.disposed=!0,this.abort.abort(),(e=this.atlas)==null||e.dispose(),(r=this.flow)==null||r.dispose(),this.material.dispose(),this.geometry.dispose(),this.target.dispose())}}export{ae as CastleAdventure};
