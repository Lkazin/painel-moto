const{test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const crypto=require('node:crypto');const{prepareHostedRelease}=require('./prepare-android-release.cjs');
test('preparar release abastece download próprio e não permite substituir versão ou rebaixar manifesto',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nw-hosted-release-'));
 t.after(()=>{const resolved=path.resolve(root);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'nw-hosted-release-'))throw Error('Pasta temporária inválida');fs.rmSync(resolved,{recursive:true,force:true});});
 const apk=Buffer.from('504b03046e6f76616573776562','hex'),hash=crypto.createHash('sha256').update(apk).digest('hex');
 const config={versionName:'1.1.18',versionCode:20,assetName:'NovaesWeb-Entregador-v1.1.18-code20.apk'};
 prepareHostedRelease(root,config,apk,hash);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'release-downloads/release.json'),'utf8'));
 assert.equal(manifest.build,20);assert.equal(manifest.sha256,hash);assert.ok(fs.readFileSync(path.join(root,'release-downloads',config.assetName)).equals(apk));
 const other=Buffer.from('504b0304646966666572656e74','hex'),otherHash=crypto.createHash('sha256').update(other).digest('hex');
 assert.throws(()=>prepareHostedRelease(root,config,other,otherHash),/Não substitua/);
 assert.throws(()=>prepareHostedRelease(root,{...config,versionName:'1.1.17',versionCode:19,assetName:'NovaesWeb-Entregador-v1.1.17-code19.apk'},apk,hash),/Não rebaixe/);
});
