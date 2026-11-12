import clips from './run-clips.json';
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
const fract=x=>x-Math.floor(x);
export function runPose(time,duration,row,settings){
 const landingStart=duration-settings.landing;
 const cycles=t=>settings.cyclesPerSecond*(t-settings.cadenceSlowdown*t*t/(2*duration));
 const lastPhase=clips.frames[settings.facing].indexOf(clips.landingFrame)/6;
 const phase=fract(cycles(Math.min(time,landingStart))-cycles(landingStart)+lastPhase);
 if(time>=landingStart){
  const s=clamp((time-landingStart)/settings.landing),mix=ease(s),startLift=settings.lift*Math.sin(2*Math.PI*lastPhase)**2;
  const velocity=settings.lift*2*Math.PI*Math.sin(4*Math.PI*lastPhase)*settings.cyclesPerSecond*(1-settings.cadenceSlowdown*landingStart/duration);
  const lift=(2*s*s*s-3*s*s+1)*startLift+(s*s*s-2*s*s+s)*settings.landing*velocity;
  return {from:clips.landingFrame,to:0,index:7,mix,phase:lastPhase,lift:Math.max(0,lift),weight:1-mix};
 }
 const cell=phase*6,index=Math.floor(cell);
 return {from:clips.frames[row][index],to:clips.frames[row][(index+1)%6],index,mix:cell-index,phase,lift:settings.lift*Math.sin(2*Math.PI*phase)**2,weight:1};
}
