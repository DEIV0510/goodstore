import sharp from './sharp.mjs';
import fs from 'node:fs';
const fit=JSON.parse(fs.readFileSync('fit.json','utf8'));
const CONTENT={juegos1:[15,21,608,732],juegos2:[35,16,949,726],juegos3:[24,21,624,727],juegos4:[26,17,646,736],juegos6:[0,15,646,739]};
const INSET={juegos1:3,juegos2:5,juegos3:3,juegos4:4,juegos6:7};   // px removed at each interior boundary
const OVR=JSON.parse(fs.readFileSync('overrides.json','utf8'));    // { "juegos6-01": {dl,dr,dt,db} }
const isCloth=(r,g,b)=> g>=82 && (b-g)<=62 && (b-g)>=16 && (g-r)>=18 && (g-r)<=98 && b<=245;
fs.mkdirSync('crops',{recursive:true});
const manifest=[];
for(const [name,c] of Object.entries(fit)){
  const [ox,oy]=c.off,[bw,bh]=c.size,[cx0,cy0,cx1,cy1]=CONTENT[name]; const IN=INSET[name];
  const {data,info}=await sharp(`../_source/${name}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W,channels:C}=info;
  const CL=(x,y)=>{const i=((y+oy)*W+(x+ox))*C;return isCloth(data[i],data[i+1],data[i+2]);};
  const nR=c.rows.length; let idx=0;
  for(let ri=0;ri<nR;ri++){
    const r=c.rows[ri], nC=r.xs.length-1;
    let by0 = ri===0 ? Math.max(0,cy0-3) : r.y0+2;
    let by1 = ri===nR-1 ? Math.min(bh-1,cy1+3) : r.y1-2;
    for(let ci=0;ci<nC;ci++){
      let x0 = ci===0 ? Math.max(0,Math.min(r.xs[0],cx0)-9) : r.xs[ci]+IN;
      let x1 = ci===nC-1 ? Math.min(bw-1,Math.max(r.xs[nC],cx1)+9) : r.xs[ci+1]-IN;
      let y0=by0,y1=by1;
      const fH=(a,b,p)=>{let n=0,t=0;for(let x=a;x<=b;x++){t++;if(CL(x,p))n++;}return n/t;};
      const fV=(a,b,p)=>{let n=0,t=0;for(let y=a;y<=b;y++){t++;if(CL(p,y))n++;}return n/t;};
      let g=0; while(y0<y1-40&&fH(x0,x1,y0)>0.70&&g++<45)y0++;
      g=0; while(y1>y0+40&&fH(x0,x1,y1)>0.70&&g++<45)y1--;
      g=0; while(x0<x1-40&&fV(y0,y1,x0)>0.70&&g++<45)x0++;
      g=0; while(x1>x0+40&&fV(y0,y1,x1)>0.70&&g++<45)x1--;
      const id=`${name}-${String(idx).padStart(2,'0')}`;
      const o=OVR[id]; if(o){ x0+=(o.dl||0); x1+=(o.dr||0); y0+=(o.dt||0); y1+=(o.db||0); }
      x0=Math.max(0,x0); y0=Math.max(0,y0); x1=Math.min(bw-1,x1); y1=Math.min(bh-1,y1);
      const w=x1-x0+1,h=y1-y0+1;
      const region={left:x0+ox,top:y0+oy,width:w,height:h};
      await sharp(`../_source/${name}.png`).extract(region)
        .resize({width:Math.round(w*2.8),kernel:'lanczos3'}).sharpen({sigma:0.75,m1:0.55,m2:1.7})
        .png().toFile(`crops/${id}.png`);
      manifest.push({id,sheet:name,idx,region,w,h,ar:+(w/h).toFixed(3)});
      idx++;
    }
  }
}
fs.writeFileSync('manifest.json',JSON.stringify(manifest,null,1));
const by={}; manifest.forEach(m=>{(by[m.sheet]||=[]).push(m.ar);});
for(const [k,v] of Object.entries(by)){v.sort((a,b)=>a-b);console.log(k,'ar',v[0],v[Math.floor(v.length/2)],v[v.length-1]);}
