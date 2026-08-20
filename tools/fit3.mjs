import sharp from './sharp.mjs';
import fs from 'node:fs';
const IMGS={
 juegos1:{off:[0,0],size:[617,741],rows:[6,6,6,6,6]},
 juegos2:{off:[0,0],size:[950,737],rows:[6,6,6]},
 juegos3:{off:[0,0],size:[736,743],rows:[5,5,5,5,6]},
 juegos4:{off:[0,0],size:[662,743],rows:[5,5,5,5,5]},
 juegos6:{off:[4,4],size:[647,744],rows:[5,5,5,5,5]},
};
const isCloth=(r,g,b)=> g>=82 && (b-g)<=62 && (b-g)>=16 && (g-r)>=18 && (g-r)<=98 && b<=245;
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const out={};
for(const [f,cfg] of Object.entries(IMGS)){
  const {data,info}=await sharp(`../_source/${f}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W,channels:C}=info; const [ox,oy]=cfg.off; const [bw,bh]=cfg.size;
  const idx=(x,y)=>((y+oy)*W+(x+ox))*C;
  const L=(x,y)=>{const i=idx(x,y);return .299*data[i]+.587*data[i+1]+.114*data[i+2];};
  const CL=(x,y)=>{const i=idx(x,y);return isCloth(data[i],data[i+1],data[i+2]);};
  const rowCloth=y=>{let n=0;for(let x=0;x<bw;x++)if(CL(x,y))n++;return n/bw;};
  const colCloth=x=>{let n=0;for(let y=0;y<bh;y++)if(CL(x,y))n++;return n/bh;};
  let cy0=0,cy1=bh-1,cx0=0,cx1=bw-1;
  while(cy0<bh&&rowCloth(cy0)>0.55)cy0++; while(cy1>0&&rowCloth(cy1)>0.55)cy1--;
  while(cx0<bw&&colCloth(cx0)>0.5)cx0++; while(cx1>0&&colCloth(cx1)>0.5)cx1--;
  const hs=new Float32Array(bh);
  for(let y=3;y<bh-3;y++){let n=0,t=0;for(let x=cx0;x<=cx1;x++){t++;if(Math.abs(L(x,y-2)-L(x,y+2))>22)n++;}hs[y]=n/t;}
  const fitLine=(prof,n,g0,g1,span)=>{let best=null;
    for(let s=g0-span;s<=g0+span;s++)for(let e=g1-span;e<=g1+span;e++){
      if(e<=s+n*20)continue; const p=(e-s)/n; let sc=0;
      for(let i=1;i<n;i++){const t=Math.round(s+p*i);if(t<0||t>=prof.length){sc=-1e9;break;}sc+=prof[t];}
      sc+=(prof[Math.max(0,Math.min(prof.length-1,s))]||0)*0.4+(prof[Math.max(0,Math.min(prof.length-1,e))]||0)*0.4;
      if(!best||sc>best.sc)best={sc,s,e,p};} return best;};
  const nR=cfg.rows.length;
  const rf=fitLine(hs,nR,cy0,cy1,16);
  const ys=Array.from({length:nR+1},(_,i)=>Math.round(rf.s+rf.p*i));
  // pass 1: per-band raw x extents + vs profiles
  const bands=ys.slice(0,-1).map((y0,ri)=>{
    const y1=ys[ri+1], n=cfg.rows[ri];
    const bandColCloth=x=>{let c=0,t=0;for(let y=y0+6;y<=y1-6;y++){t++;if(CL(x,y))c++;}return c/t;};
    let x0=0,x1=bw-1;
    while(x0<bw&&bandColCloth(x0)>0.55)x0++; while(x1>0&&bandColCloth(x1)>0.55)x1--;
    const vs=new Float32Array(bw);
    for(let x=3;x<bw-3;x++){let c=0,t=0;for(let y=y0+4;y<=y1-4;y++){t++;if(Math.abs(L(x-2,y)-L(x+2,y))>22)c++;}vs[x]=c/t;}
    return {ri,y0,y1,n,x0,x1,vs};
  });
  // pass 2: clamp x0/x1 to group medians (same column count)
  const groups={};
  bands.forEach(b=>{(groups[b.n] ||= []).push(b);});
  for(const g of Object.values(groups)){
    const m0=med(g.map(b=>b.x0)), m1=med(g.map(b=>b.x1));
    g.forEach(b=>{ b.x0=Math.max(m0-10,Math.min(m0+10,b.x0)); b.x1=Math.max(m1-10,Math.min(m1+10,b.x1)); });
  }
  const rows=bands.map(b=>{
    const cf=fitLine(b.vs,b.n,b.x0,b.x1,12);
    return {y0:b.y0,y1:b.y1,xs:Array.from({length:b.n+1},(_,i)=>Math.round(cf.s+cf.p*i)),pitch:+cf.p.toFixed(1)};
  });
  out[f]={off:cfg.off,size:cfg.size,rows};
  console.log(f,'rowPitch',rf.p.toFixed(1));
  rows.forEach((r,i)=>console.log(`  r${i} y${r.y0}-${r.y1} pitch=${r.pitch} xs=${r.xs.join(',')}`));
}
fs.writeFileSync('fit.json',JSON.stringify(out,null,1));
