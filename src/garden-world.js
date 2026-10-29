import * as THREE from 'three';

// Original illustrative scenery; not a reproduction of another site's assets
// or a claim about a physical Peiry Tale location.
export function createGarden(){
 const group=new THREE.Group();
 const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
 const limestone=mat(0xe1d7c0),castlePink=mat(0xe7b8d5),castleShade=mat(0xd79fc5),trim=mat(0xe9d1e5),roof=mat(0xa5cedd),roofEdge=mat(0x7fa6bd),glass=mat(0x9a83b1,.32),wood=mat(0x9b8970),path=mat(0xe0cfad),grass=mat(0xa4b495),hedge=mat(0x708e72),leaf=mat(0x90aa80),rose=mat(0xd4a2a8),pink=mat(0xe9c2b8),gold=mat(0xbda16d);
 const put=(geometry,material,x,y,z,parent=group)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const box=(w,h,d,m,x,y,z,parent)=>put(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
 const cylinder=(r,h,m,x,y,z,r2=r,n=24)=>put(new THREE.CylinderGeometry(r,r2,h,n),m,x,y,z);
 // A translucent landscape recedes into the paper instead of ending at the
 // edge of the castle model. All silhouettes and grain are procedural.
 const atmosphere=new THREE.Mesh(new THREE.PlaneGeometry(7.8,4.5),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 void main(){vec2 uv=vUv;float broad=noise(uv*vec2(15.,9.)),fine=noise(uv*vec2(44.,26.));
 vec3 sky=mix(vec3(.94,.91,.81),vec3(.67,.79,.84),smoothstep(.17,.93,uv.y));
 float cloud=smoothstep(.58,.82,broad+.10*sin(uv.x*17.+uv.y*4.))*smoothstep(.45,.75,uv.y);
 sky=mix(sky,vec3(.98,.97,.91),cloud*.53);
 float hillA=.40+.043*sin(uv.x*11.)+.023*sin(uv.x*23.)+(broad-.5)*.028;
 float hillB=.31+.037*sin(uv.x*16.+1.7)+.018*sin(uv.x*39.)+(fine-.5)*.023;
 vec3 col=mix(sky,vec3(.67,.75,.64),1.-smoothstep(hillA-.025,hillA+.065,uv.y));
 col=mix(col,vec3(.45,.60,.48),1.-smoothstep(hillB-.035,hillB+.075,uv.y));
 col+=(broad-.5)*.055+(fine-.5)*.025;
 float feather=(broad-.5)*.10+(fine-.5)*.037;
 float edge=smoothstep(.02,.2,uv.x+feather)*smoothstep(.02,.2,1.-uv.x+feather)*smoothstep(.015,.23,uv.y+feather)*smoothstep(.08,.35,1.-uv.y+feather);
 gl_FragColor=vec4(col,.78*edge);
 }` }));
 atmosphere.position.set(2,.12,-1.18);atmosphere.renderOrder=-2;group.add(atmosphere);
 // Layered garden plinth, with visible soil/stone edges and a winding path.
 for(let i=0;i<3;i++){const g=cylinder(1,.065,i===2?grass:limestone,2,-1.51+i*.06,.1,1.02,64);g.scale.set(3.15-i*.07,1,1.18-i*.08);}
 for(let i=0;i<9;i++){const s=cylinder(.15,.025,path,2+Math.sin(i*.5)*.2,-1.365,.04+i*.12,.165,16);s.scale.x=1.45;s.rotation.y=i*.45;}
 // Small tapered blades catch the light at the edge of the page. One mesh
 // contains the whole meadow, so this adds detail without hundreds of draws.
 const positions=[],colors=[],sage=new THREE.Color(0x8ca67c),lightGreen=new THREE.Color(0xb3c29a);
 const random=n=>{const x=Math.sin(n*127.1+39.7)*43758.5453;return x-Math.floor(x);};
 for(let i=0;i<720;i++){
  const x=2+(random(i*3+1)*2-1)*2.96,z=.1+(random(i*3+2)*2-1)*1.02;
  if(((x-2)/3.06)**2+((z-.1)/1.08)**2>.88||Math.abs(x-2)<.28&&z>.18)continue;
  const h=.045+random(i*7+3)*.09,w=.009+random(i*7+4)*.01,lean=(random(i*7+5)-.5)*.065;
  const y=-1.328,a=random(i*7+6)*Math.PI,dx=Math.cos(a)*w,dz=Math.sin(a)*w;
  positions.push(x-dx,y,z-dz,x+dx,y,z+dz,x+lean,y+h,z+.02);
  const c=sage.clone().lerp(lightGreen,random(i*7+7));for(let v=0;v<3;v++)colors.push(c.r,c.g,c.b);
 }
 const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));bladeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));bladeGeometry.computeVertexNormals();
 const windTime={value:0};group.userData.windTime=windTime;
 const grassMaterial=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide,roughness:1});
 grassMaterial.onBeforeCompile=shader=>{
  shader.uniforms.windTime=windTime;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float windTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
   float bladeTip=clamp((position.y+1.328)/.135,0.0,1.0);
   transformed.x+=sin(windTime*1.15+position.x*2.4+position.z*3.1)*.022*bladeTip;
   transformed.z+=cos(windTime*.83+position.x*1.7)*.008*bladeTip;`);
 };
 grassMaterial.customProgramCacheKey=()=>`meadow-wind-v1`;
 const blades=new THREE.Mesh(bladeGeometry,grassMaterial);blades.receiveShadow=false;blades.castShadow=false;group.add(blades);
 const windowShape=new THREE.Shape();windowShape.moveTo(-.07,0);windowShape.lineTo(-.07,.19);windowShape.absarc(0,.19,.07,Math.PI,0,true);windowShape.lineTo(.07,0);windowShape.closePath();
 const windowGeo=new THREE.ShapeGeometry(windowShape,12);
 const windowAt=(x,y,z)=>{put(windowGeo,glass,x,y,z);box(.012,.19,.018,trim,x,y+.09,z+.012);box(.17,.028,.04,trim,x,y-.01,z+.01);};
 const castle=new THREE.Group();castle.position.set(2,-1.34,-.3);castle.rotation.y=-.12;group.add(castle);
 const local=(g,m,x,y,z)=>put(g,m,x,y,z,castle);
 const block=(w,h,d,m,x,y,z)=>box(w,h,d,m,x,y,z,castle);
 block(1.75,1.25,.65,castlePink,0,.625,0);
 block(1.82,.09,.71,trim,0,1.25,0);
 for(let i=0;i<9;i++)block(.115,.13,.71,trim,-.82+i*.205,1.34,0);
 // Raised corner piers and quiet masonry joints make the facade read as
 // cloth-coloured stone rather than a single pink box.
 for(const x of [-.78,.78]){
  block(.13,1.2,.17,trim,x,.61,.39);
  block(.19,.065,.21,limestone,x,1.2,.4);
  block(.19,.065,.21,limestone,x,.16,.4);
 }
 for(const y of [.37,.66,.95])for(const [x,w] of [[-.52,.48],[.52,.48]]){
  block(w,.012,.012,castleShade,x,y,.335);
 }
 for(const y of [.37,.66,.95])for(const x of [-.7,-.39,.39,.7]){
  block(.01,.13,.012,castleShade,x,y+.075,.337);
 }
 // Towers and stepped slate roofs, built as volumes with repeated masonry bands.
 for(const [x,z,r,h] of [[-.96,.06,.29,1.85],[.96,.06,.29,1.85],[0,.02,.4,2.25]]){
  local(new THREE.CylinderGeometry(r,r+.035,h,32),castlePink,x,h/2,z);
  for(let j=0;j<5;j++)local(new THREE.CylinderGeometry(r+.014,r+.014,.025,32),trim,x,.2+j*(h-.25)/5,z);
  local(new THREE.CylinderGeometry(r+.06,r+.02,.13,32),trim,x,h-.02,z);
  local(new THREE.ConeGeometry(r+.13,.72,32),roof,x,h+.37,z);
  for(let i=0;i<4;i++)local(new THREE.CylinderGeometry((r+.13)*(1-i/5),(r+.13)*(1-i/5),.018,32),roofEdge,x,h+.03+i*.14,z);
  for(let i=0;i<12;i++){
   const angle=i*Math.PI/6,offset=new THREE.Vector3(Math.sin(angle)*(r+.125),0,Math.cos(angle)*(r+.125));
   const rib=new THREE.LineCurve3(new THREE.Vector3(x+offset.x,h+.025,z+offset.z),new THREE.Vector3(x,h+.72,z));
   local(new THREE.TubeGeometry(rib,8,.005,5,false),roofEdge,0,0,0);
  }
  local(new THREE.SphereGeometry(.035,12,8),gold,x,h+.76,z);
  local(new THREE.CylinderGeometry(.008,.008,.17,8),gold,x,h+.86,z);
  const pennant=new THREE.Shape();pennant.moveTo(0,0);pennant.lineTo(.18,-.04);pennant.lineTo(0,-.09);pennant.closePath();local(new THREE.ShapeGeometry(pennant),pink,x,h+.94,z);
  for(const y of [.55,1.15]){
   if(x===0&&y===.55)continue; // The entrance occupies this central bay.
   local(windowGeo,glass,x,y,z+r+.014);
   block(.014,.18,.026,trim,x,y+.09,z+r+.035);
   block(.20,.026,.055,limestone,x,y-.012,z+r+.034);
   const points=[];for(let j=0;j<=12;j++){const a=Math.PI-j*Math.PI/12;points.push(new THREE.Vector3(x+Math.cos(a)*.095,y+.19+Math.sin(a)*.095,z+r+.045));}
   local(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),16,.012,5,false),trim,0,0,0);
  }
 }
 // The observed brand mark has a bow under the central blue roof.
 const bowMaterial=mat(0xd48cbd);
 for(const side of [-1,1]){
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(side*.12,.16,side*.37,.18,side*.34,.02);shape.bezierCurveTo(side*.36,-.15,side*.12,-.12,0,0);
  local(new THREE.ExtrudeGeometry(shape,{depth:.04,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,steps:1}),bowMaterial,0,1.94,.46);
  const tail=new THREE.Shape();tail.moveTo(side*.04,-.03);tail.lineTo(side*.16,-.3);tail.lineTo(side*.2,-.23);tail.lineTo(side*.28,-.27);tail.lineTo(side*.18,.02);tail.closePath();local(new THREE.ShapeGeometry(tail),bowMaterial,0,1.92,.45);
 }
 local(new THREE.SphereGeometry(.07,16,10),bowMaterial,0,1.94,.5);
 const heart=new THREE.Shape();heart.moveTo(0,0);heart.bezierCurveTo(-.18,.17,-.25,-.04,0,-.21);heart.bezierCurveTo(.25,-.04,.18,.17,0,0);
 const heartGeometry=new THREE.ExtrudeGeometry(heart,{depth:.025,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,steps:1});
 for(const x of [-.83,.83]){block(.43,.48,.12,castlePink,x,.33,.35);local(heartGeometry,bowMaterial,x,.42,.43);}
 // A real arched entrance frames the guide's arrival.
 const arch=new THREE.Shape();arch.moveTo(-.29,0);arch.lineTo(-.29,.62);arch.absarc(0,.62,.29,Math.PI,0,true);arch.lineTo(.29,0);arch.closePath();
 // A distant garden is visible beyond the opened leaves. The recessed view
 // is an original shader illustration, kept inside the arch rather than an
 // invented brand location or a photo of an unavailable product.
 const beyond=new THREE.ShaderMaterial({vertexShader:'varying vec2 archPoint; void main(){archPoint=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 archPoint;
 void main(){float x=archPoint.x,y=archPoint.y;
  float skyline=.30+.035*sin(x*18.)+.014*sin(x*43.);
  vec3 sky=mix(vec3(.27,.42,.47),vec3(.48,.59,.59),smoothstep(.22,.9,y));
  vec3 green=mix(vec3(.18,.34,.27),vec3(.29,.47,.36),smoothstep(.0,.35,y));
  vec3 scene=mix(green,sky,smoothstep(skyline-.02,skyline+.035,y));
  float trees=exp(-pow((x+.16)/.058,2.)-pow((y-.41)/.10,2.))
             +exp(-pow((x-.17)/.068,2.)-pow((y-.37)/.11,2.));
  float trunks=(1.-smoothstep(.006,.014,abs(x+.16)))*smoothstep(.08,.14,y)*(1.-smoothstep(.38,.47,y))
              +(1.-smoothstep(.006,.014,abs(x-.17)))*smoothstep(.08,.14,y)*(1.-smoothstep(.34,.44,y));
  scene=mix(scene,vec3(.17,.32,.25),clamp(trees*.67+trunks*.55,0.,.8));
  float path=exp(-pow(x/(.045+.12*(1.-y)),2.))*(1.-smoothstep(.08,.49,y));
  scene=mix(scene,vec3(.70,.57,.39),path*.88);
  float recess=.94-.42*smoothstep(.07,.29,abs(x))-.13*smoothstep(.62,.91,y);
  scene*=recess;
  scene+=vec3(.12,.10,.07)*exp(-pow(x/.11,2.))*smoothstep(.0,.5,y)*.28;
  gl_FragColor=vec4(scene,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 local(new THREE.ShapeGeometry(arch,24),beyond,0,0,.47);
 const innerStone=mat(0xad8faa);
 for(const x of [-.285,.285])block(.035,.61,.10,innerStone,x,.305,.52);
 const passageArc=[];for(let i=0;i<=20;i++){const a=Math.PI-i*Math.PI/20;passageArc.push(new THREE.Vector3(Math.cos(a)*.28,.62+Math.sin(a)*.28,.48));}
 local(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(passageArc),24,.012,6,false),innerStone,0,0,0);
 for(let i=0;i<11;i++){const a=i*Math.PI/10;const stone=block(.105,.115,.12,i%2?trim:limestone,Math.cos(a)*.33,.62+Math.sin(a)*.33,.53);stone.rotation.z=a;}
 for(const x of [-.34,.34]){
  block(.105,.65,.13,trim,x,.32,.53);
  block(.15,.065,.16,limestone,x,.05,.54);
 }
 block(.84,.075,.29,limestone,0,-.04,.57);
 for(const x of [-.58,.58]){local(windowGeo,glass,x,1.02,.334);block(.014,.18,.02,trim,x,1.11,.345);}
 // The two blue leaves are added after static scenery batching so their
 // hinges can actually open when a visitor knocks.
 // Branched trunks and many small, overlapping leaf clusters give the trees
 // irregular silhouettes and visible negative space without product imagery.
 const foliage=[mat(0x789575),mat(0x91a980),mat(0xa9b998)];
 const leafPositions=[],leafColors=[],leafPalette=[new THREE.Color(0x678967),new THREE.Color(0x86a581),new THREE.Color(0xb1c3a0)];
 const fineLeaf=(x,y,z,seed,scale)=>{
  const a=random(seed*13+1)*Math.PI*2,length=(.045+random(seed*13+2)*.035)*scale,width=(.016+random(seed*13+3)*.012)*scale;
  const dx=Math.cos(a)*length,dy=Math.sin(a)*length,px=-Math.sin(a)*width,py=Math.cos(a)*width;
  const root=[x-dx*.45,y-dy*.45,z],tip=[x+dx,y+dy,z],left=[x+px,y+py,z+.003],right=[x-px,y-py,z+.003],ridge=[x+dx*.24,y+dy*.24,z+.025*scale];
  const tint=leafPalette[Math.floor(random(seed*13+4)*leafPalette.length)];
  for(const point of [root,left,ridge,left,tip,ridge,tip,right,ridge,right,root,ridge]){
   leafPositions.push(...point);const light=point===ridge?1.13:1;leafColors.push(tint.r*light,tint.g*light,tint.b*light);
  }
 };
 const twig=(a,b,r)=>{const direction=new THREE.Vector3().subVectors(b,a);const mesh=put(new THREE.CylinderGeometry(r*.65,r,direction.length(),7),wood,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());};
 for(const [treeIndex,x,z,s] of [[0,-.35,-.15,.9],[1,4.38,-.25,1.03],[2,.15,-.6,.73],[3,3.85,-.62,.8]]){
  const base=new THREE.Vector3(x,-1.37,z),tip=new THREE.Vector3(x+(treeIndex%2?.08:-.07)*s,-.05*s,z-.02);
  twig(base,tip,.065*s);
  for(const side of [-1,1])for(let layer=0;layer<2;layer++){
   const from=new THREE.Vector3(x,-.75+layer*.3,z),to=new THREE.Vector3(x+side*(.3+layer*.11)*s,-.33+layer*.32,z-.07+layer*.03);
   twig(from,to,.029*s);
  }
  for(let i=0;i<46;i++){
   const a=i*2.39996+treeIndex*.8,ring=Math.sqrt((i+.5)/46),radius=(.12+.56*ring)*s;
   const cx=tip.x+Math.cos(a)*radius,cy=tip.y+Math.sin(a*1.31)*.42*s+(1-ring)*.22*s,cz=z+Math.sin(a)*.16*s-.07;
   const clump=put(new THREE.DodecahedronGeometry(.105,0),foliage[(i+treeIndex)%3],cx,cy,cz);
   clump.scale.set(.77+(i%4)*.13,1.15+(i%5)*.09,.67+(i%3)*.1);
   for(let j=0;j<3;j++){
    const seed=treeIndex*1000+i*7+j,side=random(seed*5+2)*Math.PI*2;
    fineLeaf(cx+Math.cos(side)*.075*s,cy+Math.sin(side)*.085*s,cz+.062*s,seed,s);
   }
  }
 }
 const leafGeometry=new THREE.BufferGeometry();leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));leafGeometry.setAttribute('color',new THREE.Float32BufferAttribute(leafColors,3));leafGeometry.computeVertexNormals();
 const leafDetail=new THREE.Mesh(leafGeometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.92}));leafDetail.castShadow=false;leafDetail.receiveShadow=false;group.add(leafDetail);
 for(const side of [-1,1])for(let i=0;i<6;i++){
  const x=2+side*(.85+i*.31),z=.42+Math.sin(i*.55)*.18;
  const bush=put(new THREE.SphereGeometry(.22,14,10),i%2?leaf:hedge,x,-1.19,z);bush.scale.set(1.1,.8,.7);
  for(let j=0;j<3;j++){
   const px=x+(j-1)*.09,py=-1.06+(j%2)*.055,pz=z+.13;
   put(new THREE.SphereGeometry(.052,10,8),j%2?pink:rose,px,py,pz);
   for(let k=0;k<4;k++){const a=k*Math.PI/2;const petal=put(new THREE.SphereGeometry(.037,8,6),rose,px+Math.cos(a)*.036,py+Math.sin(a)*.036,pz+.02);petal.scale.z=.45;}
  }
 }
 // Low garden fence: small verticals, no tall objects obscuring the lettering.
 for(const side of [-1,1]){for(let i=0;i<6;i++){const x=2+side*(1.6+i*.2);box(.04,.37,.04,trim,x,-1.23,-.5);}box(1.05,.035,.035,trim,2+side*2.1,-1.2,-.5);}
 group.rotation.x=.13;
 return group;
}

export function createCastleDoors(){
 const root=new THREE.Group();root.position.set(2,-1.34,-.3);root.rotation.y=-.12;
 const blue=new THREE.MeshStandardMaterial({color:0x8faec3,roughness:.68});
 const inset=new THREE.MeshStandardMaterial({color:0x789eb5,roughness:.76});
 const trim=new THREE.MeshStandardMaterial({color:0xb8d2dc,roughness:.62});
 const gold=new THREE.MeshStandardMaterial({color:0xbda16d,metalness:.45,roughness:.38});
 const hinges=[];
 for(const side of [-1,1]){
  const hinge=new THREE.Group();hinge.position.set(side*.28,0,.55);root.add(hinge);hinges.push(hinge);
  const center=-side*.137;
  const panel=new THREE.Mesh(new THREE.BoxGeometry(.268,.56,.045),blue);panel.position.set(center,.29,0);panel.castShadow=true;hinge.add(panel);
  const border=new THREE.Mesh(new THREE.BoxGeometry(.205,.43,.014),trim);border.position.set(center,.30,.03);hinge.add(border);
  const face=new THREE.Mesh(new THREE.BoxGeometry(.18,.405,.018),inset);face.position.set(center,.30,.041);hinge.add(face);
  const lower=new THREE.Mesh(new THREE.BoxGeometry(.15,.017,.02),trim);lower.position.set(center,.18,.055);hinge.add(lower);
  const handle=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),gold);handle.position.set(-side*.226,.32,.068);hinge.add(handle);
 }
 return {root,hinges};
}
