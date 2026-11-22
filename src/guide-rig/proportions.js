// Native frame-zero landmarks: crown, neckline, hem, skull center and width.
// Exclude the bow, ponytail and nose when measuring the skull.
export const landmarks = [
  [15,110,208,136,103], [8,99,198,135,99],
  [13,89,199,128,74], [13,113,205,119,103],
  [16,108,200,117,96], [21,111,206,126,97],
  [14,89,200,128,70], [18,111,205,132,103],
];
// Shared lower-body center from the skirt and planted soles of each view.
// A uniform translation below the waist keeps the calf shape and stride intact.
const bodyCenters = [144,136,132,123,115,118,129,134];
const number = n => n.toFixed(5);
export const guideProportions = `
vec2 guideSource(vec2 uv, float row) {
  vec3 levels;
  vec2 skull;
  float bodyX;
  ${landmarks.map(([top,neck,hem,cx,w],i) =>
    `${i ? 'else ' : ''}${i<7 ? 'if(row<'+(i+.5)+')' : ''}{levels=vec3(${[top,neck,hem].map(number)}); skull=vec2(${number(cx)},${number(w)});bodyX=${number(bodyCenters[i])};}`
  ).join('\n')}
  vec2 p=uv*256.;
  float y=p.y;
  float sourceY=y<102.?mix(levels.x,levels.y,(y-14.)/88.):
                y<202.?mix(levels.y,levels.z,(y-102.)/100.):
                y<218.?mix(levels.z,218.,(y-202.)/16.):y;
  float head=1.-smoothstep(100.,146.,y);
  return vec2(mix(bodyX+(p.x-128.),skull.x+(p.x-128.)*skull.y/88.,head),sourceY)/256.;
}`;

// Match the shader when the book uses the static Canvas 2D reading path.
export function drawStandingGuide(canvas, atlas, row) {
  const [top, neck, hem, center, width] = landmarks[row];
  const context = canvas.getContext('2d');
  const knots = [[14,top], [102,neck], [202,hem], [218,218], [256,256]];
  function sourceY(y) {
    const end = knots.findIndex(([output], index) => index > 0 && output >= y);
    const [a,b] = knots[end-1], [c,d] = knots[end];
    return b+(y-a)*(d-b)/(c-a);
  }
  for (let y=0; y<256; y++) {
    const t=Math.max(0,Math.min(1,(y+.5-100)/46));
    const head=1-t*t*(3-2*t);
    const scale=1+head*(width/88-1);
    const shift=(1-head)*(bodyCenters[row]-128)+head*(center-128*width/88);
    const src=sourceY(y);
    if (src<0) continue;
    context.drawImage(atlas,(row%4)*256,1024+Math.floor(row/4)*256+src,256,sourceY(y+1)-src,-shift/scale,y,256/scale,1);
  }
}
