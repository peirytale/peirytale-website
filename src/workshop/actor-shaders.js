import {guideProportions} from '../guide-rig/proportions.js';
// Same atlas/flow sampling and pigment encoding as the castle guide. Both
// meshes live in the room's dynamic group and never enter its resting baseline.
export const vertex=`varying vec2 p,sourcePoint;void main(){p=vec2(uv.x,1.-uv.y);vec4 world=modelMatrix*vec4(position,1.);sourcePoint=vec2(world.x,-world.y);gl_Position=projectionMatrix*viewMatrix*world;}`;
export const clipping=`uniform vec4 clip;varying vec2 sourcePoint;
float paperClip(){return smoothstep(clip.x,clip.x+1.,sourcePoint.x)*(1.-smoothstep(clip.z-1.,clip.z,sourcePoint.x))*smoothstep(clip.y,clip.y+1.,sourcePoint.y)*(1.-smoothstep(clip.w-1.,clip.w,sourcePoint.y));}
vec3 encode(vec3 transmission){return clamp((128.+127.*(transmission-1.))/255.,0.,1.);}`;
export const fragment=`
uniform sampler2D atlas,flowMap,silhouette,guideAtlas;uniform vec2 cell,nextCell,flowCell;uniform vec4 feet,nextFeet;uniform float poseMix,flowScale;uniform bool useFlow,useGuide;
varying vec2 p;${clipping}
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
float inCell(vec2 uv){return step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);}
vec2 atlasUV(vec2 which,vec2 uv){uv=clamp(uv,vec2(.5/256.),vec2(1.-.5/256.));return vec2((which.x+uv.x)/8.,1.-(which.y+uv.y)/8.);}
vec4 pose(vec2 which,vec2 uv){vec4 c=texture2D(atlas,atlasUV(which,uv));return vec4(linearRGB(c.rgb),c.a*inCell(uv));}
float distanceAt(vec2 which,vec2 uv){return (texture2D(silhouette,atlasUV(which,uv)).r*255.-128.)/4.-(1.-inCell(uv))*64.;}
float coverage(float d){float aa=clamp(fwidth(d)*.6,.55,1.25);return smoothstep(-aa,aa,d);}
vec4 solidPose(vec2 which,vec2 uv){vec4 c=pose(which,uv);return vec4(c.rgb,min(coverage(distanceAt(which,uv)),c.a*255.));}
vec3 motion(vec2 uv,float backward){return texture2D(flowMap,vec2((flowCell.x+clamp(uv.x,0.,1.))/8.,1.-(flowCell.y+backward*8.+clamp(uv.y,0.,1.))/16.)).rgb;}
vec2 displacement(vec3 c){return (c.rg*255.-128.)/127.*flowScale;}
// Local similarity interpolation pins both shoes and the two hips. Optical
// flow alone matches a raised shoe to the skirt in several supplied poses,
// making signed-distance interpolation erase the leg. These source-measured
// correspondences preserve both feet while the upper body keeps its flow.
vec2 legSource(vec2 uv,bool next){
 vec2 target[4];vec2 source[4];float w[4];
 target[0]=mix(feet.xy,nextFeet.xy,poseMix);target[1]=mix(feet.zw,nextFeet.zw,poseMix);
 source[0]=next?nextFeet.xy:feet.xy;source[1]=next?nextFeet.zw:feet.zw;
 target[2]=vec2(104.,182.)/256.;target[3]=vec2(152.,182.)/256.;source[2]=target[2];source[3]=target[3];
 float total=0.;vec2 pstar=vec2(0.),qstar=vec2(0.);
 for(int i=0;i<4;i++){vec2 d=uv-target[i];w[i]=1./pow(dot(d,d)+.00001,2.);total+=w[i];pstar+=target[i]*w[i];qstar+=source[i]*w[i];}
 pstar/=total;qstar/=total;float mu=0.,re=0.,im=0.;
 for(int i=0;i<4;i++){vec2 p=target[i]-pstar,q=source[i]-qstar;float weight=w[i]/total;mu+=weight*dot(p,p);re+=weight*dot(p,q);im+=weight*(p.x*q.y-p.y*q.x);}
 re/=max(mu,.000000001);im/=max(mu,.000000001);vec2 v=uv-pstar;
 return qstar+vec2(re*v.x-im*v.y,im*v.x+re*v.y);
}
${guideProportions}
vec4 runningPose(vec2 uv){
 uv=guideSource(uv,cell.y);
 if(!useFlow||poseMix<=0.)return solidPose(cell,uv);
 if(poseMix>=1.)return solidPose(nextCell,uv);
 vec2 a=uv,b=uv;for(int i=0;i<3;i++){a=uv-poseMix*displacement(motion(a,0.));b=uv-(1.-poseMix)*displacement(motion(b,1.));}
 if(uv.y>.67){float leg=smoothstep(.67,.77,uv.y);a=mix(a,legSource(uv,false),leg);b=mix(b,legSource(uv,true),leg);}
 vec4 pa=pose(cell,a),pb=pose(nextCell,b);
 // Color blends only where actual source ink exists; alpha comes from one
 // interpolated signed contour, so a departing limb cannot linger as a ghost.
 float wa=(1.-poseMix)*pa.a,wb=poseMix*pb.a;
 vec3 color=(pa.rgb*wa+pb.rgb*wb)/max(wa+wb,.00001);
 float d=mix(distanceAt(cell,a),distanceAt(nextCell,b),poseMix);
 // Do not invent a dark fringe where both original samples are transparent.
 return vec4(color,min(coverage(d),(wa+wb)*255.));
}
void main(){vec4 sprite;if(useGuide){vec2 q=(guideSource((p*320.-32.)/256.,cell.y)*256.+32.)/320.;vec4 c=texture2D(guideAtlas,vec2(q.x,1.-q.y));sprite=vec4(linearRGB(c.rgb/max(c.a,.00001)),c.a);}else sprite=runningPose(p);float alpha=sprite.a*paperClip();if(alpha<.003)discard;gl_FragColor=vec4(encode(sprite.rgb),alpha);}`;
export const shadowFragment=`uniform float opacity;varying vec2 p;${clipping}
void main(){vec2 q=(p-.5)*2.;float alpha=exp(-dot(q,q)*3.)*opacity*paperClip();if(alpha<.003)discard;gl_FragColor=vec4(encode(vec3(.42,.37,.33)),alpha);}`;
