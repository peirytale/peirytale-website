// Round only a few pixels around each marked corner. A global interpolating
// spline bends the long horizontal run and overshoots the short doorway turns.
export function roundedRoute(points,radius){
 const result=[points[0]],mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],b=points[i],c=points[i+1],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]);
  const r=Math.min(radius,ab*.25,bc*.25),before=mix(b,a,r/ab),after=mix(b,c,r/bc);
  result.push(before);for(let j=1;j<=8;j++){const t=j/8;result.push(mix(mix(before,b,t),mix(b,after,t),t));}
 }
 result.push(points.at(-1));return result;
}
// Integrate depth continuously, rather than giving each straight segment one
// average speed. Dense samples keep the foot path unchanged and prevent a speed
// step where foreground and receding segments meet.
export function perspectiveTravel(points,referenceHeight,power,spacing=2){
 const route=[points[0]],lengths=[0],times=[0];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/spacing));
  for(let j=1;j<=steps;j++){
   const next=a.map((x,k)=>x+(b[k]-x)*j/steps),previous=route.at(-1),distance=Math.hypot(next[0]-previous[0],next[1]-previous[1]);
   const weight=(1/(previous[2]/referenceHeight)**power+1/(next[2]/referenceHeight)**power)/2;
   route.push(next);lengths.push(lengths.at(-1)+distance);times.push(times.at(-1)+distance*weight);
  }
 }
 return {route,lengths,times};
}
// Already running when crossing the edge; brake only near the end, with a
// continuous cosine velocity reaching zero exactly at the configured arrival.
export function travelProgress(f,slowdown){
 f=Math.max(0,Math.min(1,f));const tail=1-slowdown,area=1-slowdown/2;
 if(f<=tail)return f/area;
 const s=(f-tail)/slowdown;return (tail+slowdown*(s/2+Math.sin(Math.PI*s)/(2*Math.PI)))/area;
}
