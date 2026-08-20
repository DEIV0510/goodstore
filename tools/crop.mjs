import sharp from './sharp.mjs';
import fs from 'node:fs';
const fit=JSON.parse(fs.readFileSync('fit.json','utf8'));
const CONTENT={juegos1:[15,21,608,732],juegos2:[35,16,949,726],juegos3:[24,21,624,727],juegos4:[26,17,646,736],juegos6:[0,15,646,739]};
const isCloth=(r,g,b)=> g>=82 && (b-g)<=62 && (b-g)>=16 && (g-r)>=18 && (g-r)<=98 && b<=245;
const OUT='../public/games'; fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync('crops',{recursive:true});
const manifest=[];
for(const [name,c] of Object.entries(fit)){
  const [ox,oy]=c.off, [bw,bh]=c.size;
  const [cx0,cy0,cx1,cy1]=CONTENT[name];
  const src=sharp(`../_source/${name}.png`).removeAlpha();
  const {data,info}=await src.raw().toBuffer({resolveWithObject:true});
  const {width:W,channels:C}=info;
  const CL=(x,y)=>{const i=((y+oy)*W+(x+ox))*C;return isCloth(data[i],data[i+1],data[i+2]);};
  const nR=c.rows.length;
  let idx=0;
  for(let ri=0;ri<nR;ri++){
    const r=c.rows[ri];
    let y0 = ri===0 ? Math.max(0,cy0-3) : r.y0;
    let y1 = ri===nR-1 ? Math.min(bh-1,cy1+3) : r.y1;
    for(let ci=0;ci<r.xs.length-1;ci++){
      let x0 = ci===0 ? Math.max(0,Math.min(r.xs[0],cx0)-9) : r.xs[ci];
      let x1 = ci===r.xs.length-2 ? Math.min(bw-1,Math.max(r.xs[r.xs.length-1],cx1)+9) : r.xs[ci+1];
      // trim cloth borders
      const frac=(a,b,horiz,p)=>{let n=0,t=0;if(horiz){for(let x=a;x<=b;x++){t++;if(CL(x,p))n++;}}else{for(let y=a;y<=b;y++){t++;if(CL(p,y))n++;}}return n/t;};
      let g=0; while(y0<y1-40 && frac(x0,x1,true,y0)>0.72 && g++<40) y0++;
      g=0; while(y1>y0+40 && frac(x0,x1,true,y1)>0.72 && g++<40) y1--;
      g=0; while(x0<x1-40 && frac(y0,y1,false,x0)>0.72 && g++<40) x0++;
      g=0; while(x1>x0+40 && frac(y0,y1,false,x1)>0.72 && g++<40) x1--;
      const w=x1-x0+1,h=y1-y0+1;
      const id=`${name}-${String(idx).padStart(2,'0')}`;
      const region={left:x0+ox,top:y0+oy,width:w,height:h};
      await sharp(`../_source/${name}.png`).extract(region)
        .resize({width:Math.round(w*2.6),kernel:'lanczos3'})
        .sharpen({sigma:0.7,m1:0.6,m2:1.6})
        .png().toFile(`crops/${id}.png`);
      manifest.push({id,sheet:name,idx,region,w,h,ar:+(w/h).toFixed(3)});
      idx++;
    }
  }
}
fs.writeFileSync('manifest.json',JSON.stringify(manifest,null,1));
console.log('crops:',manifest.length);
const ars=manifest.map(m=>m.ar).sort((a,b)=>a-b);
console.log('aspect ratio p5/p50/p95:',ars[3],ars[Math.floor(ars.length/2)],ars[ars.length-4]);
console.log('sizes:',manifest.slice(0,3).map(m=>`${m.w}x${m.h}`).join(' '),'...');
