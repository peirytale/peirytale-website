// UVs are local to one registered 176 × 272 painting. Flow contains offsets
// in painted pixels for the six cyclic edges, six edges into the braking pose,
// and the two endpoints of the run-to-rest sequence.
export const teacupShader = `
uniform sampler2D dressAtlas, dressFlow;
uniform bool wearDress, departing;
uniform float dressPhase, dressWeight;
const vec2 dressSize = vec2(176., 272.);
vec2 dressUV(vec2 uv, vec2 cellId, vec2 grid, vec2 size) {
  vec2 q = (cellId + clamp(uv, .5 / size, 1. - .5 / size)) / grid;
  return vec2(q.x, 1. - q.y);
}
vec4 dressInk(float frame, vec2 uv) {
  vec4 c = texture2D(dressAtlas, dressUV(uv, vec2(frame,cell.y), vec2(9.,8.), dressSize));
  float alpha = c.a * inCell(uv);
  return vec4(linearRGB(c.rgb) * alpha, alpha);
}
vec2 shiftAt(vec2 p, float edge, float back) {
  vec2 field = texture2D(dressFlow, dressUV(p,vec2(edge,cell.y+8.*back),
                              vec2(14.,16.),dressSize*.5)).rg;
  return (field*255.-128.)*(48./127.)/dressSize;
}
vec4 dressPose(vec2 uv) {
  float rest = departing ? 0. : 8.;
  if (dressWeight <= .0001) return dressInk(rest, uv);
  // All strides lead through the same drawn braking pose at weight .32.
  if (dressWeight < .32) {
    float t = 1.-dressWeight/.32, edge = departing ? 13. : 12.;
    vec2 a = uv, b = uv;
    for (int k=0; k<3; ++k) {
      a = uv-t*shiftAt(a,edge,0.);
      b = uv-(1.-t)*shiftAt(b,edge,1.);
    }
    return mix(dressInk(7.,a),dressInk(rest,b),t);
  }
  float phase=fract(dressPhase)*6., i=floor(phase), j=mod(i+1.,6.);
  float run=(dressWeight-.32)/.68;
  vec3 w=vec3((1.-fract(phase))*run,fract(phase)*run,1.-run);
  vec2 a=uv,b=uv,c=uv;
  for (int k=0; k<3; ++k) {
    a=uv-w.y*shiftAt(a,i,0.)-w.z*shiftAt(a,6.+i,0.);
    b=uv-w.x*shiftAt(b,i,1.)-w.z*shiftAt(b,6.+j,0.);
    c=uv-w.x*shiftAt(c,6.+i,1.)-w.y*shiftAt(c,6.+j,1.);
  }
  return w.x*dressInk(1.+i,a)+w.y*dressInk(1.+j,b)+w.z*dressInk(7.,c);
}
`;
