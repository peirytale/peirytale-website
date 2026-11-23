import {clipping} from './actor-shaders.js';
import {guideProportions} from '../guide-rig/proportions.js';

export const outfitDuration=1.2;
export const outfitReveal=.48;

export const outfitLightFragment=`
uniform sampler2D guideAtlas;
uniform float progress, heading;
varying vec2 p;
${clipping}
${guideProportions}

float ray(vec2 v,vec2 direction,float width){
 float forward=dot(v,direction);
 float across=dot(v,vec2(-direction.y,direction.x));
 float spread=width+max(0.,forward)*.18;
 float offset=across/spread;
 return exp(-offset*offset)*smoothstep(-.04,.25,forward);
}
float glint(vec2 position,float size){
 vec2 q=abs(position);
 float tips=max(q.x,q.y)+min(q.x,q.y)*3.5;
 return 1.-smoothstep(size*.38,size,tips);
}
void main(){
 // The same registration as the figure keeps its illuminated silhouette on
 // the ink, including the little gap under a lifted arm.
 vec2 uv=(p*320.-32.)/256.;
 vec2 samplePoint=(guideSource(uv,heading)*256.+32.)/320.;
 float figure=texture2D(guideAtlas,vec2(samplePoint.x,1.-samplePoint.y)).a;
 float rise=smoothstep(.03,.44,progress);
 float light=rise*(1.-smoothstep(.53,1.,progress));
 vec2 v=(p-vec2(.5,.49))*vec2(2.65,1.92);
 float radius=length(v);
 float boundary=(1.-smoothstep(.70,.98,radius));
 float rayGold=ray(v,vec2(.60,-.8),.059)+.8*ray(v,vec2(-.74,.67),.066);
 float rayBlue=ray(v,vec2(-.94,-.34),.060)+.65*ray(v,vec2(.22,.976),.045);
 float rayPink=ray(v,vec2(.96,.28),.060)+.7*ray(v,vec2(-.39,.92),.040);
 float halo=light*boundary*(.27*exp(-radius*radius*3.)+.47*(rayGold+rayBlue+rayPink));
 // Transmission above one makes these rays emit light on the painted page.
 vec3 pastel=(vec3(1.67,1.36,1.04)*(.15+rayGold)+vec3(.89,1.30,1.72)*(.08+rayBlue)
           +vec3(1.68,1.02,1.34)*(.09+rayPink))/(.32+rayGold+rayBlue+rayPink);
 float sparks=smoothstep(.12,.52,progress)*(1.-smoothstep(.68,1.,progress));
 vec2 starPoint=v/(.89+.24*smoothstep(.20,.92,progress));
 float flecks=glint(starPoint-vec2(-.32,-.37),.048)+glint(starPoint-vec2(.39,-.22),.057)
   +glint(starPoint-vec2(-.46,.13),.038)+glint(starPoint-vec2(.47,.24),.049)
   +glint(starPoint-vec2(.27,.54),.030)+glint(starPoint-vec2(-.31,.57),.032);
 float surface=figure*light*.92;
 float alpha=max(surface,max(halo,sparks*flecks*.83))*paperClip();
 if(alpha<.003)discard;
 vec3 pearl=mix(pastel,vec3(1.54,1.48,1.32),surface);
 pearl=mix(pearl,vec3(1.88,1.80,1.69),clamp(sparks*flecks,0.,1.));
 gl_FragColor=vec4(encode(pearl),alpha);
}`;
