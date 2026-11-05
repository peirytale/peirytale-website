import {PAPER_ROOT_X,FRONT_BOARD_THICKNESS,paperHingeX} from './book-dimensions.js';
export const PAPER_SURFACE_Z=.14,FRONT_OUTER_Z=.25;
export const FRONT_INNER_Z=FRONT_OUTER_Z-FRONT_BOARD_THICKNESS;
export const PAPER_CASE_CLEARANCE=.002,CLOSED_PAGE_CLEARANCE=.010;
export const leftStackThickness=amount=>.008+.28*amount;
export const leftClosedPrintZ=amount=>FRONT_INNER_Z-PAPER_CASE_CLEARANCE-leftStackThickness(amount);
export const rightSurfaceZ=(progress,amount)=>PAPER_SURFACE_Z*progress+(leftClosedPrintZ(amount)-CLOSED_PAGE_CLEARANCE)*(1-progress);
// One finite-thickness hinge drives paper AND board. No material-coordinate
// relaxation, compensating strip, or terminal change of coordinate systems.
// The flexible case joint also translates the complete rigid front assembly
// so both printed roots share X throughout opening, leaving no cloth slit.
export function leftPagePoint(x,z,progress,amount=0){
 const hinge=(PAPER_SURFACE_Z+leftClosedPrintZ(amount))/2,angle=Math.PI*(1-progress),c=Math.cos(angle),s=Math.sin(angle);
 return {x:paperHingeX(progress)+c*x+s*(z-PAPER_SURFACE_Z),z:hinge-s*x+c*(z-hinge)};
}
export function frontBoardPoint(x,z,progress,amount=0){
 const hinge=(PAPER_SURFACE_Z+leftClosedPrintZ(amount))/2;
 return leftPagePoint(PAPER_ROOT_X-x,2*hinge-z,progress,amount);
}
