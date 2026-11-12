const clamp=x=>Math.max(0,Math.min(1,x));
// Quintic Hermite endpoints with zero acceleration and explicit velocities.
const segment=(p,from,to,v0,v1)=>{
 const s=clamp(p),d=to-from;
 return from+v0*s+(10*d-6*v0-4*v1)*s**3+(-15*d+8*v0+7*v1)*s**4+(6*d-3*v0-3*v1)*s**5;
};
export function pairedOpening(progress,leftStart,settings){
 const p=clamp(progress),{match,anticipation,joinSpeed}=settings,end=Math.PI/2;
 // A tiny anticipatory acceleration of the left leaf allows the right to meet
 // it with matching positive velocity: no stationary handoff or velocity snap.
 const velocity=(end-leftStart)/(1-match+anticipation/2)*joinSpeed;
 const joined=leftStart+velocity*anticipation/2;
 if(p>=match){const both=segment((p-match)/(1-match),joined,end,velocity*(1-match),0);return {left:both,right:both};}
 const s=clamp((p-match+anticipation)/anticipation);
 return {left:leftStart+velocity*anticipation*(s**3-.5*s**4),right:segment(p/match,0,joined,0,velocity*match)};
}
