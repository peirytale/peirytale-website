const M=[[15,110,208,136,103],[8,99,198,135,99],[13,89,199,128,74],[13,113,205,119,103],[16,108,200,117,96],[21,111,206,126,97],[14,89,200,128,70],[18,111,205,132,103]],b=[144,136,132,123,115,118,129,134],p=t=>t.toFixed(5),k=`
vec2 guideSource(vec2 uv, float row) {
  vec3 levels;
  vec2 skull;
  float bodyX;
  ${M.map(([t,u,e,c,s],a)=>`${a?"else ":""}${a<7?"if(row<"+(a+.5)+")":""}{levels=vec3(${[t,u,e].map(p)}); skull=vec2(${p(c)},${p(s)});bodyX=${p(b[a])};}`).join(`
`)}
  vec2 p=uv*256.;
  float y=p.y;
  float sourceY=y<102.?mix(levels.x,levels.y,(y-14.)/88.):
                y<202.?mix(levels.y,levels.z,(y-102.)/100.):
                y<218.?mix(levels.z,218.,(y-202.)/16.):y;
  float head=1.-smoothstep(100.,146.,y);
  return vec2(mix(bodyX+(p.x-128.),skull.x+(p.x-128.)*skull.y/88.,head),sourceY)/256.;
}`;function $(t,u,e){const[c,s,a,n,l]=M[e],d=t.getContext("2d"),m=[[14,c],[102,s],[202,a],[218,218],[256,256]];function y(o){const h=m.findIndex(([x],g)=>g>0&&x>=o),[r,i]=m[h-1],[f,v]=m[h];return i+(o-r)*(v-i)/(f-r)}for(let o=0;o<256;o++){const h=Math.max(0,Math.min(1,(o+.5-100)/46)),r=1-h*h*(3-2*h),i=1+r*(l/88-1),f=(1-r)*(b[e]-128)+r*(n-128*l/88),v=y(o);v<0||d.drawImage(u,e%4*256,1024+Math.floor(e/4)*256+v,256,y(o+1)-v,-f/i,o,256/i,1)}}function I(t,u){const e=[t[0]],c=(s,a,n)=>s.map((l,d)=>l+(a[d]-l)*n);for(let s=1;s<t.length-1;s++){const a=t[s-1],n=t[s],l=t[s+1],d=Math.hypot(n[0]-a[0],n[1]-a[1]),m=Math.hypot(l[0]-n[0],l[1]-n[1]),y=Math.min(u,d*.25,m*.25),o=c(n,a,y/d),h=c(n,l,y/m);e.push(o);for(let r=1;r<=8;r++){const i=r/8;e.push(c(c(o,n,i),c(n,h,i),i))}}return e.push(t.at(-1)),e}function P(t,u,e,c=2){const s=[t[0]],a=[0],n=[0];for(let l=1;l<t.length;l++){const d=t[l-1],m=t[l],y=Math.max(1,Math.ceil(Math.hypot(m[0]-d[0],m[1]-d[1])/c));for(let o=1;o<=y;o++){const h=d.map((v,x)=>v+(m[x]-v)*o/y),r=s.at(-1),i=Math.hypot(h[0]-r[0],h[1]-r[1]),f=(1/(r[2]/u)**e+1/(h[2]/u)**e)/2;s.push(h),a.push(a.at(-1)+i),n.push(n.at(-1)+i*f)}}return{route:s,lengths:a,times:n}}function j(t,u){t=Math.max(0,Math.min(1,t));const e=1-u,c=1-u/2;if(t<=e)return t/c;const s=(t-e)/u;return(e+u*(s/2+Math.sin(Math.PI*s)/(2*Math.PI)))/c}export{$ as d,k as g,M as l,P as p,I as r,j as t};
