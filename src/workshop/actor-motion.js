import {actorConfig as config} from './actor-config.js';
import {roundedRoute,perspectiveTravel,travelProgress} from '../castle-adventure/route.js';
import clips from '../castle-adventure/run-clips.json' with {type:'json'};
export const clamp=x=>Math.max(0,Math.min(1,x));
export function actorHeight(point){const h=config.height;return h.far+(h.near-h.far)*clamp((point[1]-h.farY)/(h.nearY-h.farY));}
// Sprite directions are screen-facing E, SE, S, SW, W, NW, N, NE. Floor-space
// route directions remain available separately in the navigation adapter.
export const facing=(a,b)=>(Math.round(Math.atan2(b[1]-a[1],b[0]-a[0])/(Math.PI/4))+8)%8;
export function makeMotion(points,{navigation=null,duration=null,entry=false,fromRest=false}={}){
 let path=points.map(p=>[p[0],p[1],actorHeight(p)]);
 if(path.length>2){const curved=roundedRoute(path,config.cornerRadius);if(!navigation||curved.slice(1).every((p,i)=>navigation.clear(curved[i],p)))path=curved;}
 const travel=perspectiveTravel(path,config.height.near,config.perspectivePower);
 const length=travel.lengths.at(-1);
 const startRamp=fromRest ? 0.05 : 0;
 const travelDuration=duration??Math.max(.325,travel.times.at(-1)/config.speed/(1-config.braking/2));
 return {...travel,length,entry,startRamp,duration:travelDuration+startRamp/2};
}
export function motionSample(motion,time){
 const duration=motion.travelDuration??motion.duration;
 if(time>=duration)return {point:[...motion.route.at(-1)],index:motion.route.length-1,t:1};
 const ramp=motion.startRamp;
 // Integral of a raised-cosine acceleration. A redirect and the off-page
 // entrance already have momentum and keep the original travel clock.
 const elapsed=time<ramp?(time-ramp*Math.sin(Math.PI*time/ramp)/Math.PI)/2:time-ramp/2;
 const f=travelProgress(clamp(elapsed/(duration-ramp/2)),config.braking),distance=motion.times.at(-1)*f;
 let i=1;while(i<motion.times.length-1&&distance>motion.times[i])i++;
 const a=motion.route[i-1],b=motion.route[i],span=motion.times[i]-motion.times[i-1],t=span?clamp((distance-motion.times[i-1])/span):0;
 return {point:a.map((v,k)=>v+(b[k]-v)*t),index:i,t};
}
export const motionPoint=(motion,time)=>motionSample(motion,time).point;
export function motionHeading(motion,time){const duration=motion.travelDuration??motion.duration;time=Math.min(time,duration);const a=motionPoint(motion,Math.max(0,time-config.running.turnWindow/2)),b=motionPoint(motion,Math.min(duration,time+config.running.turnWindow/2));return Math.atan2(b[1]-a[1],b[0]-a[0]);}
// Keep the gait clock continuous when changing destinations. Choose the next
// reachable landing phase by extending the route clock by at most one cycle;
// never jump a source pose or reverse the running cycle to force a short stop.
export function configureGait(motion,carryPhase=null){
 const row=facing(motion.route.at(-2),motion.route.at(-1)),scale=motion.entry?1:Math.max(.35,Math.min(1,motion.length/motion.duration/config.speed));
 const settings={...config.running,cyclesPerSecond:config.running.cyclesPerSecond*scale,facing:row};
 if(carryPhase!==null){
  const cycles=d=>{const t=d-settings.landing;return settings.cyclesPerSecond*(t-settings.cadenceSlowdown*t*t/(2*d));};
  const last=clips.frames[row].indexOf(clips.landingFrame)/6,offset=last-carryPhase,min=motion.duration;
  const target=offset+Math.ceil(cycles(min)-offset-1e-10);let lo=min,hi=min+2/settings.cyclesPerSecond;
  for(let i=0;i<55;i++){const mid=(lo+hi)/2;if(cycles(mid)<target)lo=mid;else hi=mid;}motion.duration=(lo+hi)/2;
 }
 motion.gait=settings;return motion;
}
