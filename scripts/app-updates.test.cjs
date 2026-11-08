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
 const name=`NovaesWeb-Entregador-v${version}-code${build}.apk`,tag=`android-v${version}`;
 return {id:build,tag_name:tag,published_at:new Date(initialTime-1000).toISOString(),draft:false,prerelease:false,body:'Melhorias de entrega.\nNova versão.',assets:[{id:build+100,name,state:'uploaded',size:10441836,browser_download_url:`https://github.com/Lkazin/painel-moto/releases/download/${tag}/${name}`}]};
}
function harness(native=true){
 const calls=[],opened=[],events=new Map(),intervals=new Map(),storage=new Map();let timer=0,clock=initialTime;
 const options={info:{id:'br.com.novaesweb.entregador',version:'1.1.0',build:'2'},response:{status:200,data:[release()]},network:null,launcherError:null,completed:true};
 class Clock extends Date {static now(){return clock;}}
 const listeners={addEventListener(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn)},removeEventListener(name,fn){events.get(name)?.delete(fn)}};
 const context={exports:{},URL,Date:Clock,Number,Promise,JSON,Error,Math,Set,setTimeout,clearTimeout,
   setInterval(fn){intervals.set(++timer,fn);return timer},clearInterval(id){intervals.delete(id)},
   localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
   navigator:{onLine:true},document:{...listeners,visibilityState:'visible'},window:{...listeners},
   Capacitor:{isNativePlatform:()=>native,getPlatform:()=>native?'android':'web'},
   CapacitorHttp:{request:async config=>{calls.push(config);return options.network?options.network(config):options.response}},
   App:{getInfo:async()=>options.info},
   AppLauncher:{openUrl:async({url})=>{opened.push(url);if(options.launcherError)throw options.launcherError;return {completed:options.completed}}},
 };
 vm.runInNewContext(source,context);
 return {...context.exports,context,options,calls,opened,events,storage,intervals,advance:ms=>{clock+=ms},emit:name=>{for(const fn of events.get(name)||[])fn()},tickIntervals:()=>{for(const fn of intervals.values())fn()}};
}
test('Android compares native build numbers and chooses the highest matching published APK',()=>{
 const h=harness();
 assert.equal(h.selectAndroidRelease([release(2,'1.1.0')],2),null);
 const selected=h.selectAndroidRelease([release(4,'1.3.0'),release(3)],2);
 assert.equal(selected.build,4);assert.equal(selected.version,'1.3.0');assert.equal(selected.url,release(4,'1.3.0').assets[0].browser_download_url);
 assert.equal(h.selectAndroidRelease([release(1,'1.0.0')],2),null);
});
test('drafts, prereleases, wrong tags, missing assets and unsafe download URLs cannot advertise updates',()=>{
 const h=harness(),invalid=[];
 for(const flag of ['draft','prerelease'])invalid.push({...release(),[flag]:true});
 invalid.push({...release(),tag_name:'web-v1.2.0'},{...release(),assets:[]},{...release(),published_at:'invalid'},{...release(),published_at:new Date(initialTime+86400000).toISOString()});
 for(const url of ['https://evil.test/update.apk','http://github.com/Lkazin/painel-moto/releases/download/android-v1.2.0/NovaesWeb-Entregador-v1.2.0-code3.apk','https://github.com/other/painel-moto/releases/download/android-v1.2.0/NovaesWeb-Entregador-v1.2.0-code3.apk',release().assets[0].browser_download_url+'?token=secret',release().assets[0].browser_download_url+'#fragment',release().assets[0].browser_download_url.replace('github.com','user:secret@github.com')]){
  const item=release();item.assets[0].browser_download_url=url;invalid.push(item);
 }
 for(const item of invalid)assert.equal(h.selectAndroidRelease([item],2,initialTime),null);
 const wrongName=release();wrongName.assets[0].name='NovaesWeb-Entregador-v9.9.9-code3.apk';assert.equal(h.selectAndroidRelease([wrongName],2),null);
 const uploading=release();uploading.assets[0].state='new';assert.equal(h.selectAndroidRelease([uploading],2),null);
 assert.throws(()=>h.selectAndroidRelease({error:'not an array'},2));
});
test('browser/PWA never checks GitHub, subscribes native lifecycle or opens an APK',async()=>{
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
test('successful checks throttle for six hours and empty published releases are normal',async()=>{
 const h=harness();h.options.response={status:200,data:[]};await h.appUpdates.check();await h.appUpdates.check();
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
 h.context.navigator.onLine=true;h.options.response={status:200,data:[]};h.advance(61000);await h.appUpdates.check();
 assert.equal(h.appUpdates.getState().error,null);assert.equal(h.appUpdates.getState().release,null);assert.equal(h.appUpdates.getState().currentBuild,2);
});
test('403 and 429 use a thirty-minute automatic backoff while an explicit manual retry remains possible',async()=>{
 for(const status of [403,429]){
  const h=harness();h.options.response={status,data:{message:'Limit exceeded'}};await h.appUpdates.check();
  h.advance(29*60000);await h.appUpdates.check();assert.equal(h.calls.length,1);
  h.options.response={status:200,data:[]};await h.appUpdates.check(true);assert.equal(h.calls.length,2);assert.equal(h.appUpdates.getState().error,null);
  h.options.response={status,data:{}};await h.appUpdates.check(true);h.advance(30*60000+1);h.options.response={status:200,data:[]};await h.appUpdates.check();assert.equal(h.calls.length,4);
 }
});
test('dismissal stores only release identity and expires after 24 hours; another release is not hidden',async()=>{
 const h=harness();await h.appUpdates.check(true);h.appUpdates.dismiss();
 assert.equal(h.appUpdates.getState().dismissed,true);
 const saved=JSON.parse([...h.storage.values()][0]);assert.deepEqual(Object.keys(saved).sort(),['build','id','until']);assert.ok(!JSON.stringify(saved).includes('https:'));
 h.options.response={status:200,data:[release(4,'1.3.0')]};await h.appUpdates.check(true);assert.equal(h.appUpdates.getState().dismissed,false);
 h.appUpdates.dismiss();h.advance(24*3600000+1);await h.appUpdates.check(true);assert.equal(h.appUpdates.getState().dismissed,false);
});
test('native launch uses only the checked real asset URL and caller snapshots cannot modify it',async()=>{
 const h=harness();await h.appUpdates.check(true);const state=h.appUpdates.getState();state.release.url='https://evil.test/not-an-update.apk';
 await h.appUpdates.openDownload();const url=new URL(h.opened[0]);
 assert.equal(url.origin+url.pathname,release().assets[0].browser_download_url);
 assert.equal(url.searchParams.get('download'),'1');
 assert.deepEqual([...url.searchParams.keys()].sort(),['download','nw_update']);
 assert.equal(url.searchParams.get('nw_update'),`${initialTime}-1`);
});
test('tentar novamente renova o link mesmo no mesmo instante sem alterar release nem usar host externo',async()=>{
 const h=harness();await h.appUpdates.check(true);
 await h.appUpdates.openDownload();await h.appUpdates.openDownload();
 assert.notEqual(h.opened[0],h.opened[1]);
 assert.equal(h.appUpdates.getState().release.url,release().assets[0].browser_download_url);
 for(const link of h.opened){const url=new URL(link);assert.equal(url.hostname,'github.com');assert.equal(url.searchParams.get('download'),'1');assert.equal(url.username,'');assert.equal(url.hash,'');}
});
test('download launch reports native rejection or missing update to both state and its caller',async()=>{
 const h=harness();await assert.rejects(h.appUpdates.openDownload(),/atualização válida/);assert.equal(h.opened.length,0);
 await h.appUpdates.check(true);h.options.completed=false;
 await assert.rejects(h.appUpdates.openDownload(),/Não foi possível abrir/);assert.match(h.appUpdates.getState().error,/Não foi possível abrir/);
 h.options.completed=true;h.options.launcherError=new Error('native internal private path');
 await assert.rejects(h.appUpdates.openDownload(),/Não foi possível abrir/);assert.ok(!h.appUpdates.getState().error.includes('private'));
});
test('StrictMode cleanup invalidates late results and removes listeners without harming another subscriber',async()=>{
 const h=harness();let resolveOld;let count=0;
 h.options.network=()=>{count++;return count===1?new Promise(r=>{resolveOld=r}):Promise.resolve({status:200,data:[release(4,'1.3.0')]})};
 const stopOld=h.appUpdates.start();await tick();stopOld();assert.equal(h.intervals.size,0);
 const stop=h.appUpdates.start();await tick();assert.equal(h.appUpdates.getState().release.build,4);
 resolveOld({status:200,data:[release(3)]});await tick();assert.equal(h.appUpdates.getState().release.build,4);
 const stopSecond=h.appUpdates.start();stop();assert.equal(h.intervals.size,1);stopSecond();assert.equal(h.intervals.size,0);
 assert.equal([...h.events.values()].reduce((n,set)=>n+set.size,0),0);
});
test('foreground and online events recheck when due, while hidden periodic checks stay idle',async()=>{
 const h=harness(),stop=h.appUpdates.start();await tick();assert.equal(h.calls.length,1);
 h.advance(6*3600000+1);h.context.document.visibilityState='hidden';h.tickIntervals();await tick();assert.equal(h.calls.length,1);
 h.context.document.visibilityState='visible';h.emit('visibilitychange');await tick();assert.equal(h.calls.length,2);
 h.options.response={status:503,data:{}};await h.appUpdates.check(true);h.advance(61000);h.options.response={status:200,data:[]};h.emit('online');await tick();assert.equal(h.appUpdates.getState().error,null);stop();
});

test('automatic checks can be disabled without blocking a manual check',async()=>{
 const h=harness();h.appUpdates.setAutomatic(false);
 const stop=h.appUpdates.start();await tick();assert.equal(h.calls.length,0);
 await h.appUpdates.check(true);assert.equal(h.calls.length,1);
 assert.equal(h.storage.get('nw:android-update-automatic:v1'),'false');
 h.advance(6*3600000+1);h.appUpdates.setAutomatic(true);await tick();assert.equal(h.calls.length,2);stop();
});
