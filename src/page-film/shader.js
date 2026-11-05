import {completionEffect} from '../content/page-film.js';
// The processed film stores signed linear pigment relative to its own paper.
// Neutral128 is transparent to the existing paper, including its real lighting.
export const decodePageFilm=`
vec3 pageFilmTransmission(vec3 encoded){
 vec3 delta=(encoded*255.-128.)/127.;
 delta*=smoothstep(vec3(.7/127.),vec3(1.7/127.),abs(delta));
 return max(vec3(0.),vec3(1.)+delta);
}`;
// Readable four-point warm glints with a brief luminous hold. Shared by resting and physical paper.
export const completionShader=`
uniform float completionProgress;
float completionStar(vec2 uv,vec2 center,float delay){
 float t=clamp(completionProgress*1.3-delay,0.,1.);
 float envelope=smoothstep(.025,.22,t)*(1.-smoothstep(.66,1.,t));
 vec2 d=abs((uv-center)*vec2(1.,.7));
 float size=${completionEffect.size.toFixed(4)}*(.82+.18*sin(3.14159265*t));
 // Tapered diamond arms retain a visible width on a phone, unlike the
 // old subpixel exponential lines. A warm halo softens their clear edges.
 vec2 q=d/size;
 float vertical=max(0.,1.-q.x/.13-q.y/.95);
 float horizontal=max(0.,1.-q.y/.13-q.x/.95);
 float rays=pow(max(vertical,horizontal),1.25);
 float core=exp(-dot(q,q)/.025);
 float halo=.07*exp(-dot(q,q)/.52);
 return envelope*(core*.40+rays*.90+halo);
}
vec3 castleCompletionColor(vec3 base,vec2 uv){
 if(completionProgress<0.||completionProgress>=1.)return base;
 float glint=completionStar(uv,vec2(.49,.79),0.)+completionStar(uv,vec2(.28,.53),.06)+completionStar(uv,vec2(.74,.54),.12)+completionStar(uv,vec2(.51,.61),.18)+completionStar(uv,vec2(.37,.25),.21)+completionStar(uv,vec2(.68,.29),.24);
 // Blend a bounded champagne pigment instead of adding HDR white light.
 // Even the star core retains its warm hue on the pale paper/paint.
 float coverage=min(.88,glint*${completionEffect.intensity.toFixed(3)});
 return mix(base,vec3(${completionEffect.color.map(value=>value.toFixed(3)).join(',')}),coverage);
}`;
