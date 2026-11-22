// Rigid source-coordinate transport only: the complete painted outline stays
// unchanged, including fingers, sleeves, calves and footwear.
export function rigidPoint(point,pivot,target,rotation=0){const dx=point[0]-pivot[0],dy=point[1]-pivot[1];return [target[0]+dx*Math.cos(rotation)-dy*Math.sin(rotation),target[1]+dx*Math.sin(rotation)+dy*Math.cos(rotation)];}
