import * as THREE from 'three';

// A numerical distance field of the existing atlas alpha, never new artwork.
// Distance interpolation moves one solid contour between optical-flow poses;
// averaging two alpha coverages produces translucent duplicate limbs instead.
function edt1D(input,output,n){
 const sites=new Int32Array(n),cuts=new Float64Array(n+1);let k=0;
 sites[0]=0;cuts[0]=-Infinity;cuts[1]=Infinity;
 for(let q=1;q<n;q++){
  let s;do {const p=sites[k];s=((input[q]+q*q)-(input[p]+p*p))/(2*(q-p));if(s<=cuts[k])k--;else break;}while(k>=0);
  k++;sites[k]=q;cuts[k]=s;cuts[k+1]=Infinity;
 }
 k=0;for(let q=0;q<n;q++){while(cuts[k+1]<q)k++;const d=q-sites[k];output[q]=d*d+input[sites[k]];}
}
function distance(alpha,size,inside){
 const tmp=new Float32Array(size*size),out=new Float32Array(size*size),a=new Float64Array(size),b=new Float64Array(size);
 for(let y=0;y<size;y++){for(let x=0;x<size;x++)a[x]=(alpha[y*size+x]>=128)===inside?0:1e6;edt1D(a,b,size);for(let x=0;x<size;x++)tmp[y*size+x]=b[x];}
 for(let x=0;x<size;x++){for(let y=0;y<size;y++)a[y]=tmp[y*size+x];edt1D(a,b,size);for(let y=0;y<size;y++)out[y*size+x]=Math.sqrt(b[y]);}
 return out;
}
export function makeSilhouette(atlas){
 const image=atlas.source.data,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,width=canvas.width,height=canvas.height,size=width/8,data=new Uint8Array(width*height),alpha=new Uint8Array(size*size);
 for(let row=0;row<8;row++)for(let col=0;col<8;col++){
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)alpha[y*size+x]=pixels[((row*size+y)*width+col*size+x)*4+3];
  const toInside=distance(alpha,size,true),toOutside=distance(alpha,size,false);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=y*size+x,signed=alpha[i]>=128?toOutside[i]-.5:.5-toInside[i];
   data[(height-1-row*size-y)*width+col*size+x]=Math.max(0,Math.min(255,Math.round(128+signed*4)));
  }
 }
 const texture=new THREE.DataTexture(data,width,height,THREE.RedFormat,THREE.UnsignedByteType);texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 return texture;
}
