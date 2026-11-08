const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('src/services/appUpdates.ts','utf8').replace(/import[^;]+;/g,''))
 .replaceAll('export const ','const ').replaceAll('export function ','function ')+';Object.assign(exports,{ANDROID_RELEASES_API,validAndroidDownloadUrl,selectAndroidRelease,appUpdates});';
const initialTime=Date.parse('2026-11-02T15:00:00.000Z');
const tick=()=>new Promise(setImmediate);
function release(build=3,version='1.2.0'){
 return {version,build,file:`NovaesWeb-Entregador-v${version}-code${build}.apk`,sha256:'a'.repeat(64),size:10441836,notes:'Melhorias de entrega. Nova versão.'};
}
function harness(native=true){
 const calls=[],opened=[],events=new Map(),intervals=new Map(),storage=new Map();let timer=0,clock=initialTime;
 const options={info:{id:'br.com.novaesweb.entregador',version:'1.1.0',build:'2'},response:{status:200,data:release()},network:null,launcherError:null,completed:true};
 class Clock extends Date {static now(){return clock;}}
 const listeners={addEventListener(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn)},removeEventListener(name,fn){events.get(name)?.delete(fn)}};
 const context={exports:{},URL,Date:Clock,Number,Promise,JSON,Error,Math,Set,setTimeout,clearTimeout,
   setInterval(fn){intervals.set(++timer,fn);return timer},clearInterval(id){intervals.delete(id)},
   localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
   navigator:{onLine:true},document:{...listeners,visibilityState:'visible'},window:{...listeners},
   Capacitor:{isNativePlatform:()=>native,getPlatform:()=>native?'android':'web'},
   CapacitorHttp:{request:async config=>{calls.push(config);return options.network?options.network(config):options.response}},
   App:{getInfo:async()=>options.info},
   nativeAppUpdater:{start:async release=>{opened.push(release);if(options.launcherError)throw options.launcherError;if(!options.completed)throw Error('Falha nativa');}},
 };
 vm.runInNewContext(source,context);
 return {...context.exports,context,options,calls,opened,events,storage,intervals,advance:ms=>{clock+=ms},emit:name=>{for(const fn of events.get(name)||[])fn()},tickIntervals:()=>{for(const fn of intervals.values())fn()}};
}
test('manifesto próprio anuncia apenas build mais novo com SHA e tamanho',()=>{
 const h=harness();assert.equal(h.selectAndroidRelease(release(2,'1.1.0'),2),null);
 const selected=h.selectAndroidRelease(release(4,'1.3.0'),2);
 assert.equal(selected.build,4);assert.equal(selected.version,'1.3.0');assert.equal(selected.sha256,'a'.repeat(64));assert.equal(selected.size,10441836);
 assert.equal(selected.url,'https://painel-moto-three.vercel.app/downloads/NovaesWeb-Entregador-v1.3.0-code4.apk');assert.equal(selected.id,'hosted:4:'+'a'.repeat(64));
 assert.equal(h.selectAndroidRelease(release(1,'1.0.0'),2),null);
});
test('manifesto inválido ou endereço externo nunca inicia atualização',()=>{
 const h=harness();
 for(const data of [null,[],{...release(),version:'01.2.0'},{...release(),build:'3'},{...release(),build:0},{...release(),build:2147483648},{...release(),file:'../evil.apk'},{...release(),sha256:'bad'},{...release(),sha256:null},{...release(),size:0},{...release(),size:104857601}]) assert.throws(()=>h.selectAndroidRelease(data,2));
 const good='https://painel-moto-three.vercel.app/downloads/NovaesWeb-Entregador-v1.2.0-code3.apk';
 assert.equal(h.validAndroidDownloadUrl(good,'1.2.0',3),true);
 for(const url of [good+'?x=1',good+'#x',good.replace('painel-moto-three.vercel.app','evil.test'),good.replace('https:','http:'),good.replace('https://','https://user@'),good.replace('code3','code4'),'https://github.com/Lkazin/painel-moto/releases/download/android-v1.2.0/NovaesWeb-Entregador-v1.2.0-code3.apk']) assert.equal(h.validAndroidDownloadUrl(url,'1.2.0',3),false);
});
test('browser/PWA never checks the Android manifest, subscribes native lifecycle or opens an APK',async()=>{
 const h=harness(false),stop=h.appUpdates.start();await h.appUpdates.check(true);await assert.rejects(h.appUpdates.openDownload(),/aplicativo Android/);stop();
 assert.equal(h.appUpdates.getState().supported,false);assert.equal(h.calls.length,0);assert.equal(h.opened.length,0);assert.equal(h.intervals.size,0);assert.equal(h.events.size,0);
});
test('anonymous native request has bounded timeout, no credentials and reuses a single in-flight check',async()=>{
 const h=harness();let resolve;
 h.options.network=()=>new Promise(r=>{resolve=r});
 const first=h.appUpdates.check(true),second=h.appUpdates.check(true);assert.equal(first,second);await tick();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].url,h.ANDROID_RELEASES_API);assert.equal(h.calls[0].method,'GET');assert.equal(h.calls[0].disableRedirects,true);
 assert.equal(h.calls[0].readTimeout,10000);assert.deepEqual(Object.keys(h.calls[0].headers),['Accept']);
 assert.equal(h.calls[0].headers.Authorization,undefined);assert.equal(h.calls[0].headers['x-account-session'],undefined);
 resolve(h.options.response);await first;assert.equal(h.appUpdates.getState().release.build,3);assert.equal(h.appUpdates.getState().checking,false);
});
test('successful checks throttle for six hours and an installed build is normal',async()=>{
 const h=harness();h.options.response={status:200,data:release(2,'1.1.0')};await h.appUpdates.check();await h.appUpdates.check();
 assert.equal(h.calls.length,1);assert.equal(h.appUpdates.getState().error,null);assert.equal(h.appUpdates.getState().release,null);
 h.advance(6*3600000+1);await h.appUpdates.check();assert.equal(h.calls.length,2);
 await h.appUpdates.check(true);assert.equal(h.calls.length,3);
});
test('offline and rate-limit errors preserve a known update and recover without account state changes',async()=>{
 const h=harness();await h.appUpdates.check(true);const known=h.appUpdates.getState().release.id;
 h.options.response={status:403,data:{message:'API rate limit'}};await h.appUpdates.check(true);
 assert.match(h.appUpdates.getState().error,/Não foi possível/);assert.equal(h.appUpdates.getState().release.id,known);
 const before=h.calls.length;await h.appUpdates.check();assert.equal(h.calls.length,before);
 h.context.navigator.onLine=false;h.advance(30*60000+1);await h.appUpdates.check();assert.equal(h.calls.length,before);
 h.context.navigator.onLine=true;h.options.response={status:200,data:release(2,'1.1.0')};h.advance(61000);await h.appUpdates.check();
 assert.equal(h.appUpdates.getState().error,null);assert.equal(h.appUpdates.getState().release,null);assert.equal(h.appUpdates.getState().currentBuild,2);
});
test('403 and 429 use a thirty-minute automatic backoff while an explicit manual retry remains possible',async()=>{
 for(const status of [403,429]){
  const h=harness();h.options.response={status,data:{message:'Limit exceeded'}};await h.appUpdates.check();
  h.advance(29*60000);await h.appUpdates.check();assert.equal(h.calls.length,1);
  h.options.response={status:200,data:release(2,'1.1.0')};await h.appUpdates.check(true);assert.equal(h.calls.length,2);assert.equal(h.appUpdates.getState().error,null);
  h.options.response={status,data:{}};await h.appUpdates.check(true);h.advance(30*60000+1);h.options.response={status:200,data:release(2,'1.1.0')};await h.appUpdates.check();assert.equal(h.calls.length,4);
 }
});
test('dismissal stores only release identity and expires after 24 hours; another release is not hidden',async()=>{
 const h=harness();await h.appUpdates.check(true);h.appUpdates.dismiss();
 assert.equal(h.appUpdates.getState().dismissed,true);
 const saved=JSON.parse([...h.storage.values()][0]);assert.deepEqual(Object.keys(saved).sort(),['build','id','until']);assert.ok(!JSON.stringify(saved).includes('https:'));
 h.options.response={status:200,data:release(4,'1.3.0')};await h.appUpdates.check(true);assert.equal(h.appUpdates.getState().dismissed,false);
 h.appUpdates.dismiss();h.advance(24*3600000+1);await h.appUpdates.check(true);assert.equal(h.appUpdates.getState().dismissed,false);
});
test('download interno recebe somente o manifesto validado e snapshots não mudam seu destino',async()=>{
 const h=harness();await h.appUpdates.check(true);const state=h.appUpdates.getState();state.release.url='https://evil.test/not-an-update.apk';state.release.sha256='bad';
 await h.appUpdates.openDownload();assert.equal(h.opened.length,1);
 assert.equal(h.opened[0].url,'https://painel-moto-three.vercel.app/downloads/NovaesWeb-Entregador-v1.2.0-code3.apk');assert.equal(h.opened[0].sha256,'a'.repeat(64));assert.equal(h.opened[0].size,10441836);
});
test('nova tentativa usa download nativo com URL estável do site, sem navegador ou GitHub',async()=>{
 const h=harness();await h.appUpdates.check(true);await h.appUpdates.openDownload();await h.appUpdates.openDownload();assert.equal(h.opened.length,2);assert.equal(h.opened[0].url,h.opened[1].url);assert.equal(new URL(h.opened[0].url).search,'');
});
test('download launch reports native rejection or missing update to both state and its caller',async()=>{
 const h=harness();await assert.rejects(h.appUpdates.openDownload(),/atualização válida/);assert.equal(h.opened.length,0);
 await h.appUpdates.check(true);h.options.completed=false;
 await assert.rejects(h.appUpdates.openDownload(),/Não foi possível iniciar/);assert.match(h.appUpdates.getState().error,/Não foi possível iniciar/);
 h.options.completed=true;h.options.launcherError=new Error('native internal private path');
 await assert.rejects(h.appUpdates.openDownload(),/Não foi possível iniciar/);assert.ok(!h.appUpdates.getState().error.includes('private'));
});
test('StrictMode cleanup invalidates late results and removes listeners without harming another subscriber',async()=>{
 const h=harness();let resolveOld;let count=0;
 h.options.network=()=>{count++;return count===1?new Promise(r=>{resolveOld=r}):Promise.resolve({status:200,data:release(4,'1.3.0')})};
 const stopOld=h.appUpdates.start();await tick();stopOld();assert.equal(h.intervals.size,0);
 const stop=h.appUpdates.start();await tick();assert.equal(h.appUpdates.getState().release.build,4);
 resolveOld({status:200,data:release(3)});await tick();assert.equal(h.appUpdates.getState().release.build,4);
 const stopSecond=h.appUpdates.start();stop();assert.equal(h.intervals.size,1);stopSecond();assert.equal(h.intervals.size,0);
 assert.equal([...h.events.values()].reduce((n,set)=>n+set.size,0),0);
});
test('foreground and online events recheck when due, while hidden periodic checks stay idle',async()=>{
 const h=harness(),stop=h.appUpdates.start();await tick();assert.equal(h.calls.length,1);
 h.advance(6*3600000+1);h.context.document.visibilityState='hidden';h.tickIntervals();await tick();assert.equal(h.calls.length,1);
 h.context.document.visibilityState='visible';h.emit('visibilitychange');await tick();assert.equal(h.calls.length,2);
 h.options.response={status:503,data:{}};await h.appUpdates.check(true);h.advance(61000);h.options.response={status:200,data:release(2,'1.1.0')};h.emit('online');await tick();assert.equal(h.appUpdates.getState().error,null);stop();
});

test('automatic checks can be disabled without blocking a manual check',async()=>{
 const h=harness();h.appUpdates.setAutomatic(false);
 const stop=h.appUpdates.start();await tick();assert.equal(h.calls.length,0);
 await h.appUpdates.check(true);assert.equal(h.calls.length,1);
 assert.equal(h.storage.get('nw:android-update-automatic:v1'),'false');
 h.advance(6*3600000+1);h.appUpdates.setAutomatic(true);await tick();assert.equal(h.calls.length,2);stop();
});
