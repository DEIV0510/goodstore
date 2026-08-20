import sharp from './sharp.mjs';
const ids=process.argv.slice(2);
const CW=390,CH=560,PAD=10,COLS=4;
const rows=Math.ceil(ids.length/COLS);
const W=COLS*(CW+PAD)+PAD,H=rows*(CH+PAD+26)+PAD;
const comps=[];
for(let i=0;i<ids.length;i++){
  const r=Math.floor(i/COLS),c=i%COLS;
  const buf=await sharp(`crops/${ids[i]}.png`).resize({width:CW,height:CH,fit:'contain',background:{r:10,g:12,b:22}}).png().toBuffer();
  comps.push({input:buf,left:PAD+c*(CW+PAD),top:PAD+r*(CH+PAD+26)});
}
const lab=`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`+ids.map((id,i)=>{const r=Math.floor(i/COLS),c=i%COLS;
 return `<text x="${PAD+c*(CW+PAD)+4}" y="${PAD+r*(CH+PAD+26)+CH+20}" font-size="20" font-family="monospace" font-weight="bold" fill="#FFF000">${id}</text>`;}).join('')+`</svg>`;
await sharp({create:{width:W,height:H,channels:3,background:{r:8,g:10,b:18}}}).composite([...comps,{input:Buffer.from(lab),top:0,left:0}]).png().toFile('zoom.png');
console.log('zoom.png',W+'x'+H);
