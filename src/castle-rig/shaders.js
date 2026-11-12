export const quadVertex=`varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}`;
export const copyFragment=`uniform sampler2D image;varying vec2 p;void main(){gl_FragColor=vec4(texture2D(image,p).rgb,1.);}`;
export const finalFragment=`uniform sampler2D base,paint,restPaint,footprint;uniform bool restored;uniform float spillAmount,seamX,hingeX,opening,perspective,footY,spillLength,spillStrength;uniform vec2 sourceSize;uniform vec3 spillColor;varying vec2 p;
void main(){vec3 original=texture2D(base,p).rgb;if(restored||texture2D(footprint,p).r<.5){gl_FragColor=vec4(original,1.);return;}vec3 color=clamp(original+texture2D(paint,p).rgb-texture2D(restPaint,p).rgb,0.,1.);vec2 q=vec2(p.x,1.-p.y)*sourceSize;float dx=seamX-hingeX;float edge=seamX+(hingeX+dx*cos(opening)-seamX)/(1.-dx*sin(opening)/perspective);float gap=max(0.,seamX-edge);float dy=q.y-footY;float width=max(.8,gap*.5+dy*.42);float spread=exp(-pow((q.x-(edge+seamX)*.5)/width,2.)*2.);float along=smoothstep(0.,2.,dy)*(1.-smoothstep(spillLength*.25,spillLength,dy));float beam=spread*along*spillStrength*spillAmount;color=mix(color,spillColor,beam);gl_FragColor=vec4(color,1.);}`;
export const meshVertex=`
uniform vec2 pageSize;uniform vec4 bounds;uniform float root,amplitude,phase,frequency,progress,envelope,opening,perspective,doorCenter,doorSeam;uniform bool isFlag;
varying vec2 sourceUV;
void main(){
 vec2 q=position.xy;sourceUV=vec2(q.x/pageSize.x,1.-q.y/pageSize.y);
 if(isFlag){
  // A travelling wave crosses the cloth continuously; the pole-side edge is pinned.
  // Subtract only the initial spatial profile, never a time-dependent wind envelope.
  float u=clamp((q.x-root)/bounds.z,0.,1.);float t=6.28318530718*progress;
  float spatial=4.8*u;
  float wave=sin(t*frequency-spatial+phase)-sin(-spatial+phase);
  float ripple=sin(t*(frequency+1.)-spatial*1.65+phase*.6)-sin(-spatial*1.65+phase*.6);
  q.y+=amplitude*u*(wave+.10*ripple);
  q.x+=1.0*u*u*(cos(t*frequency-spatial+phase)-cos(-spatial+phase));
 }else{
  // Hinges remain fixed. Receding free edges get true perspective foreshortening.
  float dx=q.x-root,depth=abs(dx)*sin(opening),scale=1.-depth/perspective;
  q.x=doorSeam+(root+dx*cos(opening)-doorSeam)/scale;q.y=doorCenter+(q.y-doorCenter)/scale;
 }
 gl_Position=vec4(q.x/pageSize.x*2.-1.,1.-q.y/pageSize.y*2.,0.,1.);
}`;
export const meshFragment=`uniform sampler2D source,masks;uniform int channel;varying vec2 sourceUV;void main(){vec3 m=texture2D(masks,sourceUV).rgb;float a=channel==0?m.r:channel==1?m.g:m.b;if(a<=0.)discard;gl_FragColor=vec4(texture2D(source,sourceUV).rgb,a);}`;

export const recessFragment=`uniform sampler2D image,masks;uniform vec2 pageSize,lightCenter,lightSpread;uniform vec3 lightColor;uniform float glow,rightGlow;varying vec2 p;
void main(){vec3 original=texture2D(image,p).rgb;vec3 m=texture2D(masks,p).rgb;vec2 q=(vec2(p.x,1.-p.y)*pageSize-lightCenter)/lightSpread;float falloff=exp(-dot(q,q));float strength=falloff*(glow*m.g+rightGlow*m.b);gl_FragColor=vec4(mix(original,lightColor,strength),1.);}`;

export const edgeVertex=`uniform vec2 pageSize;uniform float root,doorSeam,doorCenter,opening,perspective,thickness;varying vec2 edgeUV;varying vec2 sourceUV;
void main(){edgeUV=uv;float d=(position.x+.5)*thickness,dir=sign(doorSeam-root),dx=abs(doorSeam-root);float worldX=root+dir*(dx*cos(opening)+d*sin(opening)),toward=dx*sin(opening)-d*cos(opening),scale=1.-toward/perspective;vec2 q=vec2(doorSeam+(worldX-doorSeam)/scale,doorCenter+(position.y-doorCenter)/scale);sourceUV=vec2((doorSeam-dir*(8.-edgeUV.x*1.5))/pageSize.x,1.-position.y/pageSize.y);gl_Position=vec4(q.x/pageSize.x*2.-1.,1.-q.y/pageSize.y*2.,0.,1.);}`;
export const edgeFragment=`uniform sampler2D source;uniform float doorSeam;uniform vec2 pageSize;varying vec2 edgeUV;varying vec2 sourceUV;
void main(){vec3 pink=texture2D(source,sourceUV).rgb;vec3 ink=min(texture2D(source,vec2(doorSeam/pageSize.x,sourceUV.y)).rgb,vec3(.19,.16,.17));float across=min(edgeUV.x,1.-edgeUV.x),ends=min(edgeUV.y,1.-edgeUV.y);float fill=smoothstep(.06,.22,across)*smoothstep(.002,.013,ends);gl_FragColor=vec4(mix(ink,pink,fill),1.);}`;
