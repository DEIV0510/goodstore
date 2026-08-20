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
const out={};
for(const [f,cfg] of Object.entries(IMGS)){
  const {data,info}=await sharp(`../_source/${f}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W,channels:C}=info; const [ox,oy]=cfg.off; const [bw,bh]=cfg.size;
  const idx=(x,y)=>((y+oy)*W+(x+ox))*C;
  const L=(x,y)=>{const i=idx(x,y);return .299*data[i]+.587*data[i+1]+.114*data[i+2];};
  const CL=(x,y)=>{const i=idx(x,y);return isCloth(data[i],data[i+1],data[i+2]);};
  // content bbox
  const rowCloth=y=>{let n=0;for(let x=0;x<bw;x++)if(CL(x,y))n++;return n/bw;};
  const colCloth=x=>{let n=0;for(let y=0;y<bh;y++)if(CL(x,y))n++;return n/bh;};
  let cy0=0,cy1=bh-1,cx0=0,cx1=bw-1;
  while(cy0<bh&&rowCloth(cy0)>0.55)cy0++; while(cy1>0&&rowCloth(cy1)>0.55)cy1--;
  while(cx0<bw&&colCloth(cx0)>0.55)cx0++; while(cx1>0&&colCloth(cx1)>0.55)cx1--;
  // horizontal seam profile within content
  const hs=new Float32Array(bh);
  for(let y=3;y<bh-3;y++){let n=0,t=0;for(let x=cx0;x<=cx1;x++){t++;if(Math.abs(L(x,y-2)-L(x,y+2))>22)n++;}hs[y]=n/t;}
  const nR=cfg.rows.length;
  const snap=(prof,guess,win)=>{let best=guess,bv=-1;for(let d=-win;d<=win;d++){const p=guess+d;if(p<0||p>=prof.length)continue;const v=prof[p]-Math.abs(d)*0.004;if(v>bv){bv=v;best=p;}}return best;};
  const ys=[cy0];
  for(let i=1;i<nR;i++) ys.push(snap(hs, Math.round(cy0+(cy1-cy0)*i/nR), 22));
  ys.push(cy1);
  const rows=[];
  ys.slice(0,-1).forEach((y0,ri)=>{
    const y1=ys[ri+1], n=cfg.rows[ri];
    // per-band content x extent
    const bandColCloth=x=>{let c=0,t=0;for(let y=y0+4;y<=y1-4;y++){t++;if(CL(x,y))c++;}return c/t;};
    let x0=0,x1=bw-1;
    while(x0<bw&&bandColCloth(x0)>0.6)x0++; while(x1>0&&bandColCloth(x1)>0.6)x1--;
    const vs=new Float32Array(bw);
    for(let x=3;x<bw-3;x++){let c=0,t=0;for(let y=y0+3;y<=y1-3;y++){t++;if(Math.abs(L(x-2,y)-L(x+2,y))>22)c++;}vs[x]=c/t;}
    const xs=[x0];
    for(let i=1;i<n;i++) xs.push(snap(vs, Math.round(x0+(x1-x0)*i/n), 20));
    xs.push(x1);
    rows.push({y0,y1,xs});
  });
  out[f]={off:cfg.off,size:cfg.size,content:[cx0,cy0,cx1,cy1],rows};
  console.log(f,'content',[cx0,cy0,cx1,cy1].join(','),'\n  ys=',ys.join(','));
  rows.forEach((r,i)=>console.log(`  r${i} y${r.y0}-${r.y1} xs=${r.xs.join(',')} w=${r.xs.slice(1).map((v,j)=>v-r.xs[j]).join(',')}`));
}
fs.writeFileSync('fit.json',JSON.stringify(out,null,1));
