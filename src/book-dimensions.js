// Owner's measured reference, expressed in a single scene scale. These are
// proportions for the book animation, not merchandise specifications.
export const CM=5.7/21.5;
export const COVER_WIDTH=15.4*CM,COVER_HEIGHT=21.5*CM;
export const JOINT_WIDTH=.8*CM,PAPER_INSET=.3*CM;
export const PAGE_WIDTH=14.7*CM,PAGE_HEIGHT=COVER_HEIGHT-2*PAPER_INSET;
export const COVER_JOINT_X=-2.04,SPINE_CORNER_RADIUS=.055;
// The 15.4 cm measurement starts at the outside of the spine shoulder.
export const COVER_FORE_X=COVER_JOINT_X-SPINE_CORNER_RADIUS+COVER_WIDTH;
export const PAPER_FORE_X=COVER_FORE_X-PAPER_INSET;
export const PAPER_ROOT_X=PAPER_FORE_X-PAGE_WIDTH;
export const BACK_COVER_TRAVEL=-PAPER_ROOT_X;
export const FRONT_COVER_TRAVEL=PAPER_ROOT_X-2*COVER_JOINT_X;
export const paperHingeX=p=>PAPER_ROOT_X*(1-p);
