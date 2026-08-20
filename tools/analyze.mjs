import sharp from './sharp.mjs';
const files = ['juegos1','juegos2','juegos3','juegos4','juegos6'];
for (const f of files) {
  const img = sharp(`../_source/${f}.png`).removeAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const px = (x,y)=>{const i=(y*W+x)*C; return [data[i],data[i+1],data[i+2]];};
  // sample border strips (assume cloth)
  const samples=[];
  for (let y=0;y<H;y+=3){ samples.push(px(1,y)); samples.push(px(W-2,y)); }
  for (let x=0;x<W;x+=3){ samples.push(px(x,1)); samples.push(px(x,H-2)); }
  const med = ch => { const a = samples.map(s=>s[ch]).sort((p,q)=>p-q); return a[Math.floor(a.length/2)]; };
  const cloth=[med(0),med(1),med(2)];
  // spread
  const dist = samples.map(s=>Math.hypot(s[0]-cloth[0],s[1]-cloth[1],s[2]-cloth[2])).sort((a,b)=>a-b);
  console.log(f, `${W}x${H}`, 'cloth=',cloth, 'p50d=',dist[Math.floor(dist.length*0.5)]|0, 'p90d=',dist[Math.floor(dist.length*0.9)]|0, 'p99d=',dist[Math.floor(dist.length*0.99)]|0);
}
