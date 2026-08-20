import sharp from './sharp.mjs';
import fs from 'node:fs';

const CFG = {
  juegos1: { rows: [6,6,6,6,6] },
  juegos2: { rows: [6,6,6] },
  juegos3: { rows: [5,5,5,5,6] },
  juegos4: { rows: [5,5,5,5,5] },
  juegos6: { rows: [5,5,5,5,5] },
};

function load(f){
  return sharp(`../_source/${f}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}
const smooth=(a,r)=>{const o=new Float32Array(a.length);for(let i=0;i<a.length;i++){let s=0,n=0;for(let k=-r;k<=r;k++){const j=i+k;if(j>=0&&j<a.length){s+=a[j];n++;}}o[i]=s/n;}return o;};

// find k gaps (valleys) in profile between lo..hi, each gap = contiguous run below threshold
function findGaps(prof, lo, hi, k){
  const seg = Array.from(prof.slice(lo,hi));
  const sorted=[...seg].sort((a,b)=>a-b);
  const median = sorted[Math.floor(sorted.length/2)];
  let best=null;
  for (let f=0.10; f<=0.85; f+=0.02){
    const t = median*f;
    const runs=[]; let s=-1;
    for(let i=0;i<seg.length;i++){
      if(seg[i]<t){ if(s<0) s=i; } else { if(s>=0){runs.push([s,i-1]); s=-1;} }
    }
    if(s>=0) runs.push([s,seg.length-1]);
    // drop runs touching the very edges (outer margin)
    const inner = runs.filter(r=> r[0]>3 && r[1]<seg.length-4);
    if(inner.length===k){ best={t,f,runs:inner}; break; }
    if(inner.length>k && !best){
      inner.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
      best={t,f,runs:inner.slice(0,k).sort((a,b)=>a[0]-b[0]),trimmed:true};
    }
  }
  if(!best) return null;
  return best.runs.map(r=>[r[0]+lo, r[1]+lo]);
}

const results = {};
for (const [f, cfg] of Object.entries(CFG)){
  const { data, info } = await load(f);
  const { width:W, height:H, channels:C } = info;
  const lum = new Float32Array(W*H);
  for (let i=0,p=0;i<W*H;i++,p+=C) lum[i]=0.299*data[p]+0.587*data[p+1]+0.114*data[p+2];
  const grad=(x,y)=>Math.abs(lum[y*W+x]-lum[y*W+x+1])+Math.abs(lum[y*W+x]-lum[(y+1)*W+x]);

  // ROW profile over full width
  const rowE=new Float32Array(H);
  for(let y=1;y<H-1;y++){let s=0;for(let x=1;x<W-1;x++) s+=grad(x,y); rowE[y]=s/W;}
  const rs=smooth(rowE,3);
  const nRows = cfg.rows.length;
  const rowGaps = findGaps(rs, 0, H, nRows-1);
  if(!rowGaps){ console.log(f,'ROW DETECT FAILED'); continue; }
  // row bands
  const bands=[]; let start=0;
  for(const g of rowGaps){ bands.push([start, g[0]-1]); start=g[1]+1; }
  bands.push([start, H-1]);
  // trim outer margins of first/last band using profile threshold
  const cells=[];
  bands.forEach((b,ri)=>{
    const nCols = cfg.rows[ri];
    const colE=new Float32Array(W);
    for(let x=1;x<W-1;x++){let s=0,n=0;for(let y=Math.max(1,b[0]);y<Math.min(H-1,b[1]);y++){s+=grad(x,y);n++;} colE[x]=s/Math.max(1,n);}
    const cs=smooth(colE,3);
    const colGaps = findGaps(cs, 0, W, nCols-1);
    if(!colGaps){ console.log(f,'row',ri,'COL DETECT FAILED (want',nCols-1,'gaps)'); return; }
    const xs=[]; let sx=0;
    for(const g of colGaps){ xs.push([sx, g[0]-1]); sx=g[1]+1; }
    xs.push([sx, W-1]);
    xs.forEach((xr,ci)=> cells.push({ r:ri, c:ci, x0:xr[0], x1:xr[1], y0:b[0], y1:b[1] }));
  });
  results[f]={W,H,cells,bands};
  console.log(f, `${W}x${H}`, 'bands=',bands.map(b=>b.join('-')).join(' | '), 'cells=',cells.length);
}
fs.writeFileSync('grid.json', JSON.stringify(results,null,1));
