import sharp from './sharp.mjs';
import fs from 'node:fs';
const fit=JSON.parse(fs.readFileSync('fit.json','utf8'));
export function cells(name){
  const c=fit[name]; const [ox,oy]=c.off; const o=[];
  c.rows.forEach((r,ri)=>{ for(let i=0;i<r.xs.length-1;i++) o.push({ri,ci:i,idx:o.length,
    x:r.xs[i]+ox,y:r.y0+oy,w:r.xs[i+1]-r.xs[i],h:r.y1-r.y0}); });
  return o;
}
if(process.argv[2]==='draw') for(const n of Object.keys(fit)){
  const cs=cells(n); const meta=await sharp(`../_source/${n}.png`).metadata();
  const svg=`<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">`+
   cs.map(c=>`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="none" stroke="#00FF66" stroke-width="2"/><text x="${c.x+5}" y="${c.y+20}" font-size="18" font-family="monospace" font-weight="bold" fill="#00FF66" stroke="#000" stroke-width="0.7">${c.idx}</text>`).join('')+`</svg>`;
  await sharp(`../_source/${n}.png`).composite([{input:Buffer.from(svg),top:0,left:0}]).png().toFile(`ov_${n}.png`);
}
