import sharp from './sharp.mjs';
import fs from 'node:fs';
const files=['juegos1','juegos2','juegos3','juegos4','juegos6'];
const isPad=(r,g,b)=> Math.abs(r-22)<8 && Math.abs(g-23)<8 && Math.abs(b-23)<8;
export const trims={};
for(const f of files){
  const {data,info}=await sharp(`../_source/${f}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W,height:H,channels:C}=info;
  const P=(x,y)=>{const i=(y*W+x)*C;return [data[i],data[i+1],data[i+2]];};
  const rowPad=y=>{let n=0;for(let x=0;x<W;x+=2){const[r,g,b]=P(x,y);if(isPad(r,g,b))n++;}return n/(W/2);};
  const colPad=x=>{let n=0;for(let y=0;y<H;y+=2){const[r,g,b]=P(x,y);if(isPad(r,g,b))n++;}return n/(H/2);};
  let t=0,bm=H-1,l=0,rr=W-1;
  while(t<H&&rowPad(t)>0.9)t++; while(bm>0&&rowPad(bm)>0.9)bm--;
  while(l<W&&colPad(l)>0.9)l++; while(rr>0&&colPad(rr)>0.9)rr--;
  trims[f]={l,t,r:rr,b:bm,w:rr-l+1,h:bm-t+1};
  console.log(f,`orig ${W}x${H} -> trim l${l} t${t} r${rr} b${bm} => ${rr-l+1}x${bm-t+1}`);
  // render cloth mask on trimmed region
  const w=rr-l+1,h=bm-t+1;
  const out=Buffer.alloc(w*h*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const[r,g,b]=P(x+l,y+t);
    const cloth = b>g && g>r && (b-r)>=55 && (b-r)<=140 && (g-r)>=25 && (g-r)<=85 && b>=85 && b<=235;
    const o=(y*w+x)*3;
    if(cloth){out[o]=255;out[o+1]=0;out[o+2]=255;} else {out[o]=r;out[o+1]=g;out[o+2]=b;}
  }
  await sharp(out,{raw:{width:w,height:h,channels:3}}).png().toFile(`mask_${f}.png`);
}
fs.writeFileSync('trims.json',JSON.stringify(trims,null,1));
