// The last part of the landing registers the neutral rig to the painted
// standing cell. R/G store displacement in sixths of a native pixel,
// B stores signed contour distance in the same units.
export const landingFragment = `
uniform sampler2D map, packed;
uniform float row, progress;
varying vec2 p;
vec2 atlasUV(vec2 origin, vec2 size, vec2 uv) {
 vec2 pixel=origin+clamp(uv*size,vec2(.5),size-.5);
 return vec2(pixel.x/1024.,1.-pixel.y/1792.);
}
vec3 field(vec2 uv,float reverse) {
 vec2 origin=vec2(row*128.,1536.+reverse*128.);
 return (texture2D(packed,atlasUV(origin,vec2(128.),uv)).rgb*255.-128.)/6.;
}
void main() {
 vec2 uv=vec2(p.x,1.-p.y),a=uv,b=uv;
 float t=progress;
 for(int i=0;i<3;i++){
  a=uv-t*field(a,0.).xy/256.;
  b=uv-(1.-t)*field(b,1.).xy/256.;
 }
 vec4 from=texture2D(map,vec2(a.x,1.-a.y));
 vec2 origin=vec2(mod(row,4.)*256.,1024.+floor(row/4.)*256.);
 vec4 to=texture2D(packed,atlasUV(origin,vec2(256.),b));
 float mass=mix(from.a,to.a,t);
 vec3 color=mix(from.rgb,to.rgb*to.a,t)/max(mass,.00001);
 float d=mix(field(a,0.).z,field(b,1.).z,t);
 float contour=smoothstep(-.65,.65,d);
 float alpha=mix(from.a,contour,smoothstep(0.,.22,t));
 alpha=mix(alpha,to.a,smoothstep(.78,1.,t));
 if(abs(from.a-to.a)<.06)alpha=mass;
 gl_FragColor=vec4(color,min(alpha,mass*255.));
}`;
