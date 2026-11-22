import {room} from './layout.js';
// Source-illustration pixels, not product or room measurements.
const figureScale=1.45,travelSpeed=2;
export const actorConfig={
 entryStart:[722,1370],rest:[...room.entry],entryDuration:1.45/travelSpeed,
 clip:[64,58,1380,973],
 // At the foreground stop the chibi is about 1.5 chair backs tall,
 // slightly taller than the hanging dress.
 height:{near:240*figureScale,far:214*figureScale,nearY:940,farY:740},
 speed:225*travelSpeed,perspectivePower:1.8,cornerRadius:10,braking:.16,
 // All interaction approaches are in front of the modeled furniture. This
 // fixed-view depth clearance keeps the billboard in that foreground lane.
 depthClearance:320,
 running:{strideMultiplier:travelSpeed/figureScale,cyclesPerSecond:2.6,cadenceSlowdown:.12,landing:.18,followThrough:.12,lift:2.7,turnWindow:.2,lean:.018},
};
