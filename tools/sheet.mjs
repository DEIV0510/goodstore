import sharp from './sharp.mjs';
import fs from 'node:fs';
const man=JSON.parse(fs.readFileSync('manifest.json','utf8'));
const sheets=[...new Set(man.map(m=>m.sheet))];
const CW=200, CH=290, PAD=8, COLS=6;
for(const s of sheets){
  const items=man.filter(m=>m.sheet===s);
  const rows=Math.ceil(items.length/COLS);
  const W=COLS*(CW+PAD)+PAD, H=rows*(CH+PAD+22)+PAD;
  const comps=[];
  for(let i=0;i<items.length;i++){
    const r=Math.floor(i/COLS), c=i%COLS;
    const buf=await sharp(`crops/${items[i].id}.png`).resize({width:CW,height:CH,fit:'contain',background:{r:12,g:14,b:24}}).png().toBuffer();
    comps.push({input:buf,left:PAD+c*(CW+PAD),top:PAD+r*(CH+PAD+22)});
  }
  const labels=`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`+items.map((it,i)=>{
    const r=Math.floor(i/COLS),c=i%COLS;
    return `<text x="${PAD+c*(CW+PAD)+4}" y="${PAD+r*(CH+PAD+22)+CH+17}" font-size="17" font-family="monospace" font-weight="bold" fill="#FFF000">#${it.idx} ${it.w}x${it.h} ar${it.ar}</text>`;
  }).join('')+`</svg>`;
  await sharp({create:{width:W,height:H,channels:3,background:{r:8,g:10,b:20}}})
    .composite([...comps,{input:Buffer.from(labels),top:0,left:0}]).png().toFile(`sheet_${s}.png`);
  console.log('sheet_'+s+'.png',W+'x'+H,items.length);
}
