import sharp from './sharp.mjs';
const files={juegos1:[0,0,617,741],juegos2:[0,0,950,737],juegos3:[0,0,736,743],juegos4:[0,0,662,743],juegos6:[4,4,651,748]};
const isCloth=(r,g,b)=> g>=82 && (b-g)<=62 && (b-g)>=16 && (g-r)>=18 && (g-r)<=98 && b<=245;
for(const [f,[bx,by,bw,bh]] of Object.entries(files)){
  const {data,info}=await sharp(`../_source/${f}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W,channels:C}=info;
  const cl=(x,y)=>{const i=((y+by)*W+(x+bx))*C;return isCloth(data[i],data[i+1],data[i+2])?1:0;};
  const rowP=[];for(let y=0;y<bh;y++){let n=0;for(let x=0;x<bw;x++)n+=cl(x,y);rowP.push(n/bw);}
  const colP=[];for(let x=0;x<bw;x++){let n=0;for(let y=0;y<bh;y++)n+=cl(x,y);colP.push(n/bh);}
  const fmt=(a,step)=>{let s='';for(let i=0;i<a.length;i+=step){if(i%(step*20)===0)s+=`\n${String(i).padStart(4)}| `;s+=String(Math.round(a[i]*99)).padStart(2,' ')+' ';}return s;};
  console.log(`\n##### ${f} ${bw}x${bh}  ROW cloth% (step4)`);console.log(fmt(rowP,4));
  console.log(`\n##### ${f} COL cloth% (step4)`);console.log(fmt(colP,4));
}
