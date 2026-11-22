import {gaitConfig,wrapPhase} from './gait.js';
const clamp=x=>Math.max(0,Math.min(1,x));
export function gaitTravel(route,strideScale=()=>1,amplitude=1){
 const cumulative=[0],segments=[];
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),row=(Math.round(Math.atan2(b[1]-a[1],b[0]-a[0])/(Math.PI/4))+8)%8;
  const coefficient=length*230/(gaitConfig.stride*strideScale(row)*amplitude),h0=a[2],dh=b[2]-h0,at=f=>coefficient*(Math.abs(dh)<1e-9?f/h0:Math.log((h0+dh*f)/h0)/dh);
  segments.push({at});cumulative.push(cumulative.at(-1)+at(1));
 }
 return {segments,cumulative};
}
export function travelPhase(plan,index,t,start=0){return wrapPhase(start+plan.cumulative[index-1]+plan.segments[index-1].at(clamp(t)));}
