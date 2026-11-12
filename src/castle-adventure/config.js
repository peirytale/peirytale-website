// Native film pixels, measured from the owner’s storyboard. All timings are seconds.
export const adventure={
 size:[960,672],atlas:'castle-guide.webp',flowAtlas:'castle-guide-flow.webp',
 approach:2,settle:0,push:3.4,normalize:.65,invitationAngle:Math.PI/4,pairedDoor:{match:.38,anticipation:.11,joinSpeed:1.05},cornerRadius:4,arrivalSlowdown:.12,perspectiveSpeedPower:4,
 // Start wholly below the ornament's inner edge, not the physical paper edge.
 entryClip:[42,32,926,637],
 // The back of the head emerges first, then
 // follow the owner’s central red path. All coordinates are native film pixels.
 // Both leaves open around the central threshold.
 route:[[465,798,156],[465,653,156],[525,608,135],[485,573,118],[485,546,111]],
 facing:6,
 running:{cyclesPerSecond:2.4,cadenceSlowdown:.35,landing:.18,lift:2.4,turnWindow:.28,lean:.025,facing:6},
 // Clockwise sprite rows: E, SE, S, SW, W, NW, N, NE.
 door:[484.2,494],
 lighting:{core:[1.82,1.48,1.08],edge:[1.34,1.43,1.42],range:1050,strength:3.4,veilStart:.72},
 hitPolygon:[[218,558],[218,333],[244,261],[283,149],[283,105],[363,105],[363,170],[391,170],[483,80],[483,24],[580,24],[580,83],[515,83],[603,205],[666,181],[666,129],[755,129],[755,181],[696,181],[744,288],[744,558]],
};
export const adventureCopy={
 'zh-TW':{enter:'跟著她走向城堡，推開故事之門',running:'她正沿著小路跑向城堡。',pushing:'她推開了城堡的門，金色暖光從門內灑出。',lit:'暖光照亮了故事。'},
 en:{enter:'Follow her to the castle and open the story door',running:'She runs along the path toward the castle.',pushing:'She pushes the castle door open, letting warm golden light spill out.',lit:'Warm light fills the story.'},
};
