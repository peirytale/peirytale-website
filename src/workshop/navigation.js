import {room} from './layout.js';
export function inside([x,y],polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
// Floor-space coordinates: u follows the rear wall, v comes toward the reader.
// Projection is an invertible affine floor basis, shared by geometry/characters.
export const floorToSource=([u,v])=>[437+u*915-v*347,690+u*157+v*282];
export const sourceToFloor=([x,y])=>{x-=437;y-=690;const d=915*282+347*157;return [(282*x+347*y)/d,(-157*x+915*y)/d];};
const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
export class WorkshopNavigation{
 constructor({radius=11}={}){this.radius=radius;this.step=room.cell;this.cols=Math.ceil(room.sourceSize[0]/this.step);this.rows=Math.ceil(room.sourceSize[1]/this.step);}
 walkable(p){return inside(p,room.floor)&&!room.obstacles.some(poly=>inside(p,poly)||poly.some((a,i)=>distance(p,a,poly[(i+1)%poly.length])<this.radius))&&room.floor.every((a,i)=>distance(p,a,room.floor[(i+1)%room.floor.length])>=this.radius);}
 point(key){return [(key%this.cols+.5)*this.step,(Math.floor(key/this.cols)+.5)*this.step];}
 nearest(p,visible=false){let best=null,d=Infinity;for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){const key=y*this.cols+x,q=this.point(key),next=Math.hypot(q[0]-p[0],q[1]-p[1]);if(next<d&&this.walkable(q)&&(!visible||this.clear(p,q))){best=key;d=next;}}return best;}
 clear(a,b){const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4);for(let i=0;i<=n;i++)if(!this.walkable([a[0]+(b[0]-a[0])*i/Math.max(1,n),a[1]+(b[1]-a[1])*i/Math.max(1,n)]))return false;return true;}
 route(from,to){
  const start=this.nearest(from,this.walkable(from)),end=this.nearest(to,this.walkable(to));if(start==null||end==null)return null;
  const open=new Set([start]),cost=new Map([[start,0]]),previous=new Map(),closed=new Set();
  const metric=(a,b)=>{const p=sourceToFloor(this.point(a)),q=sourceToFloor(this.point(b));return Math.hypot((p[0]-q[0])*915,(p[1]-q[1])*450);};
  while(open.size){let current,score=Infinity;for(const key of open){const f=cost.get(key)+metric(key,end);if(f<score){score=f;current=key;}}if(current===end){const path=[];for(let k=end;k!==undefined;k=previous.get(k))path.unshift(this.point(k));if(this.clear(from,path[0]))path.unshift([...from]);if(this.clear(path.at(-1),to))path.push([...to]);const simple=[path[0]];for(let i=0;i<path.length-1;){let j=path.length-1;while(j>i+1&&!this.clear(path[i],path[j]))j--;simple.push(path[j]);i=j;}return simple;}
   open.delete(current);closed.add(current);const x=current%this.cols,y=Math.floor(current/this.cols);
   for(const [dx,dy] of [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=this.cols||yy>=this.rows)continue;const key=yy*this.cols+xx;if(closed.has(key)||!this.walkable(this.point(key))||!this.clear(this.point(current),this.point(key)))continue;if(dx&&dy&&(!this.walkable(this.point(y*this.cols+xx))||!this.walkable(this.point(yy*this.cols+x))))continue;const next=cost.get(current)+metric(current,key);if(next<(cost.get(key)??Infinity)){cost.set(key,next);previous.set(key,current);open.add(key);}}
  }return null;
 }
 direction(a,b){const p=sourceToFloor(a),q=sourceToFloor(b);return ['E','SE','S','SW','W','NW','N','NE'][(Math.round(Math.atan2((q[1]-p[1])*450,(q[0]-p[0])*915)/(Math.PI/4))+8)%8];}
}
