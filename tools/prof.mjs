import sharp from './sharp.mjs';
const files = ['juegos1','juegos2','juegos3','juegos4','juegos6'];
const bar = (v,max,w=100)=> '#'.repeat(Math.max(0,Math.round(v/max*w)));
for (const f of files) {
  const { data, info } = await sharp(`../_source/${f}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const lum = new Float32Array(W*H);
  for (let i=0,p=0;i<W*H;i++,p+=C) lum[i]=0.299*data[p]+0.587*data[p+1]+0.114*data[p+2];
  // gradient energy
  const colE=new Float32Array(W), rowE=new Float32Array(H);
  for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++){
    const g=Math.abs(lum[y*W+x]-lum[y*W+x+1])+Math.abs(lum[y*W+x]-lum[(y+1)*W+x]);
    colE[x]+=g; rowE[y]+=g;
  }
  for(let x=0;x<W;x++) colE[x]/=H; for(let y=0;y<H;y++) rowE[y]/=W;
  const smooth=(a,r)=>{const o=new Float32Array(a.length);for(let i=0;i<a.length;i++){let s=0,n=0;for(let k=-r;k<=r;k++){const j=i+k;if(j>=0&&j<a.length){s+=a[j];n++;}}o[i]=s/n;}return o;};
  const cs=smooth(colE,2), rs=smooth(rowE,2);
  const cmax=Math.max(...cs), rmax=Math.max(...rs);
  console.log(`\n===== ${f} ${W}x${H} COLUMNS =====`);
  for(let x=0;x<W;x+=2) console.log(String(x).padStart(4), bar(cs[x],cmax,60));
  console.log(`\n===== ${f} ROWS =====`);
  for(let y=0;y<H;y+=2) console.log(String(y).padStart(4), bar(rs[y],rmax,60));
}
