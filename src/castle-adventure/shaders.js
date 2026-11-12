import {doorwayLight} from './light.js';
export const vertex=`varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}`;
// Composite only while an adventure is active. The rig’s source/target and its
// footprint remain untouched. Both inputs/outputs use the book’s pigment encoding.
export const fragment=`
uniform sampler2D base,atlas,flowMap,doorMasks;
uniform vec2 pageSize,feet,cell,nextCell,flowCell,door,aperture;
uniform vec4 entryClip;
uniform vec3 coreColor,edgeColor;
uniform float height,visible,light,flood,poseMix,flowScale,lift,lean,lightRange,lightStrength,veilStart;
uniform bool useFlow;
varying vec2 p;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 encode(vec3 transmission){return clamp((128.+127.*(transmission-1.))/255.,0.,1.);}
${doorwayLight}
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
}`;
