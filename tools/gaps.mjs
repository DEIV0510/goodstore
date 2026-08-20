import sharp from './sharp.mjs';
const CFG={juegos1:{rows:[6,6,6,6,6],pad:[0,0,0,4]},juegos2:{rows:[6,6,6],pad:[0,0,0,0]},
 juegos3:{rows:[5,5,5,5,6],pad:[0,0,1,0]},juegos4:{rows:[5,5,5,5,5],pad:[0,0,0,3]},juegos6:{rows:[5,5,5,5,5],pad:[4,4,1,4]}};
const isCloth=(r,g,b)=> g>=85 && (b-g)<=60 && (b-g)>=18 && (g-r)>=20 && (g-r)<=95 && b<=245;
const runs=(arr,thr)=>{const o=[];let s=-1;for(let i=0;i<arr.length;i++){if(arr[i]>=thr){if(s<0)s=i;}else{if(s>=0){o.push([s,i-1]);s=-1;}}}if(s>=0)o.push([s,arr.length-1]);return o;};
for(const [f,cfg] of Object.entries(CFG)){
  const {data,info}=await sharp(`../_source/${f}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W0,height:H0,channels:C}=info;
  const [pl,pt,pr,pb]=cfg.pad, X0=pl,Y0=pt,X1=W0-1-pr,Y1=H0-1-pb;
  const P=(x,y)=>{const i=(y*W0+x)*C;return [data[i],data[i+1],data[i+2]];};
  const gapPix=(x,y)=>{const[r,g,b]=P(x,y);const lum=.299*r+.587*g+.114*b;return isCloth(r,g,b)||lum<58;};
  // ROW gap score across full width
  const rowS=[];
  for(let y=Y0;y<=Y1;y++){let n=0,t=0;for(let x=X0;x<=X1;x++){t++;if(gapPix(x,y))n++;}rowS.push(n/t);}
  console.log(`\n### ${f} (${X1-X0+1}x${Y1-Y0+1}) rows=${cfg.rows.join(',')}`);
  for(const thr of [0.92,0.88,0.84,0.80]){
    const rs=runs(rowS,thr).filter(r=>r[1]-r[0]>=2).map(r=>[r[0]+Y0,r[1]+Y0]);
    console.log(` rowGaps@${thr}:`, rs.map(r=>`${r[0]}-${r[1]}`).join(' '));
  }
}
