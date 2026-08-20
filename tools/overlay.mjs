import sharp from './sharp.mjs';
import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync('gridcfg.json','utf8'));
export function cellsFor(name){
  const c=cfg[name]; const [bx0,by0,bx1,by1]=c.box; const out=[];
  c.rows.forEach((row,ri)=>{
    const y0=c.ys[ri], y1=c.ys[ri+1];
    const xs = row.xs ? row.xs : Array.from({length:row.n+1},(_,i)=> Math.round(bx0+(bx1-bx0)*i/row.n));
    for(let i=0;i<xs.length-1;i++) out.push({ri,ci:i,idx:out.length,x0:xs[i],x1:xs[i+1],y0,y1});
  });
  return out;
}
if(process.argv[2]==='draw'){
  for(const name of Object.keys(cfg)){
    const cells=cellsFor(name);
    const svg = `<svg width="${cfg[name].box[2]}" height="${cfg[name].box[3]}" xmlns="http://www.w3.org/2000/svg">`+
      cells.map(c=>`<rect x="${c.x0}" y="${c.y0}" width="${c.x1-c.x0}" height="${c.y1-c.y0}" fill="none" stroke="#00FF00" stroke-width="2"/><text x="${c.x0+6}" y="${c.y0+22}" font-size="20" font-family="monospace" fill="#00FF00" stroke="#000" stroke-width="0.6">${c.idx}</text>`).join('')+`</svg>`;
    await sharp(`../_source/${name}.png`).composite([{input:Buffer.from(svg),top:0,left:0}]).png().toFile(`ov_${name}.png`);
    console.log('ov_'+name+'.png', cells.length,'cells');
  }
}
