import sharp from './sharp.mjs';
const files=['juegos1','juegos2','juegos3','juegos4','juegos6'];
for(const f of files){
  const {data,info}=await sharp(`../_source/${f}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W,height:H,channels:C}=info;
  const px=(x,y)=>{const i=(y*W+x)*C;return [data[i],data[i+1],data[i+2]];};
  console.log(`--- ${f} ${W}x${H} ---`);
  console.log(' corners TL',px(2,2),'TR',px(W-3,2),'BL',px(2,H-3),'BR',px(W-3,H-3));
  console.log(' edge samples top:', [0.1,0.3,0.5,0.7,0.9].map(t=>px(Math.round(W*t),2).join(',')).join(' | '));
  console.log(' edge samples left:',[0.1,0.3,0.5,0.7,0.9].map(t=>px(2,Math.round(H*t)).join(',')).join(' | '));
  console.log(' edge samples bot:', [0.1,0.3,0.5,0.7,0.9].map(t=>px(Math.round(W*t),H-3).join(',')).join(' | '));
}
