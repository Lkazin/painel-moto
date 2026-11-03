const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
let sharp;try{sharp=require(require.resolve('sharp',{paths:[root,path.resolve(root,'../entregado')]}));}catch{throw Error('Sharp não está disponível. Use as dependências existentes do painel ou do backend entregado.');}
const pub=path.join(root,'public'),brand=path.join(pub,'brand');
const transparent={r:0,g:0,b:0,alpha:0};const dark='#16061f';
async function cutout(name,globeBottom){
 const input=path.join(root,'assets/branding',name);
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let minX=info.width,minY=info.height,maxX=0,maxY=0;
 for(let y=0;y<info.height;y++){
  let left=info.width,right=-1;
  if(y<info.height*globeBottom){for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4;if(Math.max(data[i],data[i+1],data[i+2])>105){left=Math.min(left,x);right=x;}}}
  for(let x=0;x<info.width;x++){
   const i=(y*info.width+x)*4,brightness=Math.max(data[i],data[i+1],data[i+2]);
   // Preserve source RGB. Only alpha changes; black inside the globe stays opaque.
   const interior=x>=left&&x<=right;
   const alpha=interior?255:Math.round(Math.max(0,Math.min(1,(brightness-12)/32))*255);
   data[i+3]=alpha;
   if(alpha>20){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  }
 }
 const padding=18,left=Math.max(0,minX-padding),top=Math.max(0,minY-padding),width=Math.min(info.width,maxX+padding+1)-left,height=Math.min(info.height,maxY+padding+1)-top;
 const buffer=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width,height}).png({compressionLevel:9}).toBuffer();
 return {buffer,layout:{source:name,left,top,width,height}};
}
async function contain(input,width,height,background=transparent){return sharp(input).resize(width,height,{fit:'contain',background}).png({compressionLevel:9}).toBuffer();}
async function main(){
 const symbol=await cutout('novaesweb-symbol-original.jpeg',.62);
 const logo=await cutout('novaesweb-logo-original.jpeg',.58);
 fs.writeFileSync(path.join(brand,'novaesweb-symbol.png'),symbol.buffer);
 for(const name of ['novaesweb-entregador.png','novaesweb-entregador-ui.png'])fs.writeFileSync(path.join(brand,name),logo.buffer);
 fs.writeFileSync(path.join(root,'assets/branding/cutout-layout.json'),JSON.stringify({symbol:symbol.layout,logo:logo.layout},null,2)+'\n');
 const meta=await sharp(symbol.buffer).metadata();
 async function icon(size,opaque=false,safe=false){
  // Fit the entire artwork inside the safe circle, including corners of its bounds.
  const factor = safe ? 0.77 : 0.94;
  const scale=(size*factor)/Math.hypot(meta.width,meta.height);
  const width=Math.max(1,Math.floor(meta.width*scale)),height=Math.max(1,Math.floor(meta.height*scale));
  const artwork=await sharp(symbol.buffer).resize(width,height).png().toBuffer();
  return sharp({create:{width:size,height:size,channels:4,background:opaque?dark:transparent}}).composite([{input:artwork,gravity:'centre'}]).png({compressionLevel:9}).toBuffer();
 }
 const buffers={};
 for(const [name,size,opaque,safe]of [['favicon-16.png',16,false,false],['favicon-32.png',32,false,false],['icon-192.png',192,false,false],['icon-512.png',512,false,false],['icon-maskable.png',512,true,true],['apple-touch-icon.png',180,true,true]]){buffers[name]=await icon(size,opaque,safe);fs.writeFileSync(path.join(pub,name),buffers[name]);}
 const images=[buffers['favicon-16.png'],buffers['favicon-32.png']];const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=header.length;
 images.forEach((buffer,index)=>{const size=index===0?16:32,entry=6+index*16;header[entry]=size;header[entry+1]=size;header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(buffer.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=buffer.length;});
 fs.writeFileSync(path.join(pub,'favicon.ico'),Buffer.concat([header,...images]));
 fs.writeFileSync(path.join(pub,'favicon.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,${buffers['icon-512.png'].toString('base64')}"/></svg>\n`);
 const social=await contain(logo.buffer,850,550);
 await sharp({create:{width:1200,height:630,channels:4,background:dark}}).composite([{input:social,gravity:'centre'}]).removeAlpha().png().toFile(path.join(brand,'og-novaesweb-entregador.png'));
 for(const[density,size,foreground]of [['mdpi',48,108],['hdpi',72,162],['xhdpi',96,216],['xxhdpi',144,324],['xxxhdpi',192,432]]){
  const dir=path.join(root,'android/app/src/main/res',`mipmap-${density}`);
  for(const name of ['ic_launcher.png','ic_launcher_round.png'])fs.writeFileSync(path.join(dir,name),await icon(size,true,true));
  fs.writeFileSync(path.join(dir,'ic_launcher_foreground.png'),await icon(foreground,false,true));
 }
 await sharp(logo.buffer).resize({width:320}).png().toFile(path.join(root,'android/app/src/main/res/drawable/novaesweb_splash_symbol.png'));
 // Local review sheet only, never part of the app interface.
 const logoPreview=await contain(logo.buffer,520,500);const symbolPreview=await icon(300,true,true);
 await sharp({create:{width:900,height:540,channels:4,background:dark}}).composite([{input:logoPreview,left:20,top:20},{input:symbolPreview,left:580,top:120}]).png().toFile(path.join(root,'.android-tools/brand-preview.png'));
 console.log('Imagens originais recortadas sem alterar RGB; ícones web/Android e logo de abertura atualizados.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
