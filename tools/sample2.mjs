import sharp from './sharp.mjs';
const {data,info}=await sharp('../_source/juegos4.png').removeAlpha().raw().toBuffer({resolveWithObject:true});
const {width:W,height:H,channels:C}=info;
const P=(x,y)=>{const i=(y*W+x)*C;return [data[i],data[i+1],data[i+2]];};
console.log('W,H',W,H);
// PS4 banner strip: top of first row, around y=8..18, x within first box (~30..120)
for(let y=4;y<=26;y+=2){ console.log('y='+y, [40,60,80,100,160,180,200].map(x=>P(x,y).join(',')).join('  ')); }
console.log('--- cloth gap columns near x=130 ---');
for(let y=40;y<=120;y+=20){ console.log('y='+y, [128,130,132,134,136].map(x=>P(x,y).join(',')).join('  ')); }
