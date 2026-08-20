import sharp from './sharp.mjs';
import fs from 'node:fs';
const fit=JSON.parse(fs.readFileSync('fit.json','utf8'));
const CONTENT={juegos1:[15,21,608,732],juegos2:[35,16,949,726],juegos3:[24,21,624,727],juegos4:[26,17,646,736],juegos6:[0,15,646,739]};
const AR={juegos1:0.617,juegos2:0.617,juegos3:0.794,juegos4:0.794,juegos6:0.788};
const isCloth=(r,g,b)=> g>=82 && (b-g)<=62 && (b-g)>=16 && (g-r)>=18 && (g-r)<=98 && b<=245;
fs.mkdirSync('crops',{recursive:true});
const manifest=[];
for(const [name,c] of Object.entries(fit)){
  const [ox,oy]=c.off,[bw,bh]=c.size,[cx0,cy0,cx1,cy1]=CONTENT[name];
  const {data,info}=await sharp(`../_source/${name}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W,channels:C}=info;
  const L=(x,y)=>{const i=((y+oy)*W+(x+ox))*C;return .299*data[i]+.587*data[i+1]+.114*data[i+2];};
  const CL=(x,y)=>{const i=((y+oy)*W+(x+ox))*C;return isCloth(data[i],data[i+1],data[i+2]);};
  const nR=c.rows.length; let idx=0;
  for(let ri=0;ri<nR;ri++){
    const r=c.rows[ri];
    let by0 = ri===0 ? Math.max(0,cy0-3) : r.y0;
    let by1 = ri===nR-1 ? Math.min(bh-1,cy1+3) : r.y1;
    for(let ci=0;ci<r.xs.length-1;ci++){
      let x0 = ci===0 ? Math.max(0,Math.min(r.xs[0],cx0)-9) : r.xs[ci];
      let x1 = ci===r.xs.length-2 ? Math.min(bw-1,Math.max(r.xs[r.xs.length-1],cx1)+9) : r.xs[ci+1];
      let y0=by0,y1=by1;
      const fracH=(a,b,p)=>{let n=0,t=0;for(let x=a;x<=b;x++){t++;if(CL(x,p))n++;}return n/t;};
      const fracV=(a,b,p)=>{let n=0,t=0;for(let y=a;y<=b;y++){t++;if(CL(p,y))n++;}return n/t;};
      let g=0; while(y0<y1-40&&fracH(x0,x1,y0)>0.72&&g++<40)y0++;
      g=0; while(y1>y0+40&&fracH(x0,x1,y1)>0.72&&g++<40)y1--;
      g=0; while(x0<x1-40&&fracV(y0,y1,x0)>0.72&&g++<40)x0++;
      g=0; while(x1>x0+40&&fracV(y0,y1,x1)>0.72&&g++<40)x1--;
      // ---- refine L/R using vertical-seam score + aspect-ratio prior ----
      const h=y1-y0+1, target=AR[name]*h;
      const vsAt=x=>{ if(x<2||x>bw-3) return 0; let n=0,t=0;
        for(let y=y0+Math.round(h*0.08);y<=y1-Math.round(h*0.08);y++){t++;if(Math.abs(L(x-2,y)-L(x+2,y))>20)n++;} return n/t; };
      const span=x1-x0+1, lim=Math.round(span*0.20);
      let best=null;
      for(let l=x0;l<=x0+lim;l++){ const sl=vsAt(l);
        for(let rr=x1;rr>=x1-lim;rr--){ const w=rr-l+1;
          const sc = sl + vsAt(rr) - Math.abs(w-target)/target*2.2;
          if(!best||sc>best.sc) best={sc,l,r:rr};
        } }
      x0=best.l; x1=best.r;
      const w=x1-x0+1, hh=y1-y0+1;
      const id=`${name}-${String(idx).padStart(2,'0')}`;
      const region={left:x0+ox,top:y0+oy,width:w,height:hh};
      await sharp(`../_source/${name}.png`).extract(region)
        .resize({width:Math.round(w*2.8),kernel:'lanczos3'}).sharpen({sigma:0.75,m1:0.55,m2:1.7})
        .png().toFile(`crops/${id}.png`);
      manifest.push({id,sheet:name,idx,region,w,h:hh,ar:+(w/hh).toFixed(3)});
      idx++;
    }
  }
}
fs.writeFileSync('manifest.json',JSON.stringify(manifest,null,1));
const by={}; manifest.forEach(m=>{(by[m.sheet]||=[]).push(m.ar);});
for(const [k,v] of Object.entries(by)){v.sort((a,b)=>a-b);console.log(k,'ar min/med/max',v[0],v[Math.floor(v.length/2)],v[v.length-1]);}
console.log('total',manifest.length);
