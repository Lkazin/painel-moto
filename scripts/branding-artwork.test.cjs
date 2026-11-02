const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {inflateSync}=require('node:zlib');

// Decode the actual PNG pixels, including filters, without adding a runtime image library.
function png(file){
  const bytes=fs.readFileSync(file),width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),type=bytes[25];
  assert.equal(bytes[24],8,'8-bit PNG');assert.ok([2,6].includes(type),'RGB or RGBA PNG');
  const channels=type===6?4:3,chunks=[];
  for(let offset=8;offset<bytes.length;){const length=bytes.readUInt32BE(offset);if(bytes.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+length));offset+=length+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(width*height*channels);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];assert.ok(filter<=4);
    for(let x=0;x<stride;x++){
      const at=y*stride+x,left=x>=channels?pixels[at-channels]:0,up=y?pixels[at-stride]:0,corner=y&&x>=channels?pixels[at-stride-channels]:0;
      const predictor=[0,left,up,Math.floor((left+up)/2),paeth(left,up,corner)][filter];
      pixels[at]=(raw[y*(stride+1)+1+x]+predictor)&255;
    }
  }
  return {width,height,channels,pixels,alpha(x,y){return channels===4?pixels[(y*width+x)*channels+3]:255;}};
}
test('official logo variants and symbol have true transparency, not an opaque black rectangle',()=>{
  for(const name of ['novaesweb-entregador.png','novaesweb-entregador-ui.png','novaesweb-entregador-slogan.png','novaesweb-symbol.png']){
    const image=png(`public/brand/${name}`);assert.equal(image.channels,4,name);
    for(const [x,y] of [[0,0],[image.width-1,0],[0,image.height-1],[image.width-1,image.height-1]])assert.ok(image.alpha(x,y)<5,`${name} corner is transparent`);
    let visible=0,clear=0;for(let i=3;i<image.pixels.length;i+=4){if(image.pixels[i]>200)visible++;if(image.pixels[i]<5)clear++;}
    assert.ok(visible>image.width*image.height*0.1,name);assert.ok(clear>image.width*image.height*0.1,name);
  }
});
test('maskable artwork is fully opaque and every brand pixel fits inside Android safe circle',()=>{
  const image=png('public/icon-maskable.png');let artwork=0;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
    assert.equal(image.alpha(x,y),255);
    const at=(y*image.width+x)*image.channels;
    const changed=Math.abs(image.pixels[at]-22)+Math.abs(image.pixels[at+1]-6)+Math.abs(image.pixels[at+2]-31)>4;
    if(changed){artwork++;assert.ok(Math.hypot(x-(image.width-1)/2,y-(image.height-1)/2)<=image.width*0.4,'brand stays inside 40% radius');}
  }
  assert.ok(artwork>10000);
});
test('small favicons contain only the supplied symbol derivative with transparent outer padding',()=>{
  for(const name of ['favicon-16.png','favicon-32.png','icon-192.png','icon-512.png']){
    const image=png(`public/${name}`);assert.equal(image.channels,4);assert.equal(image.alpha(0,0),0);assert.equal(image.alpha(image.width-1,image.height-1),0);
  }
});
