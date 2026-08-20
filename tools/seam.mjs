import sharp from './sharp.mjs';
const IMGS={juegos1:[0,0,617,741],juegos2:[0,0,950,737],juegos3:[0,0,736,743],juegos4:[0,0,662,743],juegos6:[4,4,647,744]};
for(const [f,[bx,by,bw,bh]] of Object.entries(IMGS)){
  const {data,info}=await sharp(`../_source/${f}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W,channels:C}=info;
  const L=(x,y)=>{const i=((y+by)*W+(x+bx))*C;return .299*data[i]+.587*data[i+1]+.114*data[i+2];};
  // vertical seam score per x
  const vs=new Float32Array(bw);
  for(let x=2;x<bw-2;x++){let n=0;for(let y=0;y<bh;y++){ if(Math.abs(L(x-2,y)-L(x+2,y))>22) n++; } vs[x]=n/bh;}
  const hs=new Float32Array(bh);
  for(let y=2;y<bh-2;y++){let n=0;for(let x=0;x<bw;x++){ if(Math.abs(L(x,y-2)-L(x,y+2))>22) n++; } hs[y]=n/bw;}
  const peaks=(a,minv)=>{const o=[];for(let i=3;i<a.length-3;i++){ if(a[i]>=minv && a[i]>=a[i-1]&&a[i]>=a[i+1]&&a[i]>=a[i-3]&&a[i]>=a[i+3]) o.push([i,+a[i].toFixed(2)]); } 
    // merge close
    const m=[];for(const p of o){ if(m.length&&p[0]-m[m.length-1][0]<8){ if(p[1]>m[m.length-1][1]) m[m.length-1]=p; } else m.push(p);} return m;};
  console.log(`\n### ${f} ${bw}x${bh}`);
  console.log(' VERT peaks:', peaks(vs,0.45).map(p=>`${p[0]}(${p[1]})`).join(' '));
  console.log(' HORZ peaks:', peaks(hs,0.45).map(p=>`${p[0]}(${p[1]})`).join(' '));
}
