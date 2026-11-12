// Finite doorway emitter, soft directional shafts and multiple scattering.
// Values are linear light transmission, encoded only when writing the pigment
// target. No moving oval boundary, image mask or viewport overlay is used.
export const doorwayLight=`
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
`;
