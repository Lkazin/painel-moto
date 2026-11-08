const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
const tick=()=>new Promise(setImmediate);
function harness(options={}) {
 const calls={check:0,request:0,configure:[],notify:[]},storage=new Map();let listener;
 const state={automatic:true,currentBuild:16,release:null,...options.updates};
 const native={status:async()=>({enabled:false,permissionGranted:true,channelEnabled:options.channel!==false}),configure:async value=>{calls.configure.push(value.enabled);return {enabled:value.enabled,permissionGranted:options.permission!=='denied',channelEnabled:options.channel!==false};},notifyAvailable:async value=>{calls.notify.push(value);return {delivered:true};}};
 const permissions={check:async()=>({display:options.permission||'granted'}),request:async()=>({display:options.requestPermission||'granted'})};
 const context={console,Capacitor:{isNativePlatform:()=>options.native!==false,getPlatform:()=> 'android',isPluginAvailable:()=>true},registerPlugin:()=>native,LocalNotifications:{checkPermissions:()=>{calls.check++;return permissions.check();},requestPermissions:()=>{calls.request++;return permissions.request();}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},appUpdates:{getState:()=>({...state}),subscribe:fn=>{listener=fn;fn({...state});return()=>{listener=null;};}},validAndroidDownloadUrl:(url,version,build)=>url===`https://github.com/Lkazin/painel-moto/releases/download/android-v${version}/NovaesWeb-Entregador-v${version}-code${build}.apk`,document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}}};
 let source=stripTypeScriptTypes(fs.readFileSync('src/services/updateNotifications.ts','utf8').replace(/import[\s\S]*?from '[^']+';/g,'')).replaceAll('export const ','const ');
 vm.createContext(context);vm.runInContext(source+';this.manager=updateNotifications;',context);
 return {manager:context.manager,calls,state,permissions,storage,emit:()=>listener?.({...state}),settle:async()=>{await tick();await tick();}};
}
const release={version:'1.1.15',build:17,id:'123:456:17',url:'https://github.com/Lkazin/painel-moto/releases/download/android-v1.1.15/NovaesWeb-Entregador-v1.1.15-code17.apk'};
test('início sem prompt configura avisos somente com permissão já concedida',async()=>{
 const h=harness();const stop=h.manager.start();await h.settle();assert.equal(h.calls.request,0);assert.equal(h.calls.configure.at(-1),true);stop();
 const denied=harness({permission:'denied'});denied.manager.start();await denied.settle();assert.equal(denied.calls.request,0);assert.equal(denied.calls.configure.at(-1),false);assert.equal(denied.calls.notify.length,0);
});
test('navegador não agenda tarefa Android nem solicita permissões',async()=>{
 const h=harness({native:false});h.manager.start();await h.manager.refresh();await h.manager.setEnabled(true);assert.equal(h.calls.check,0);assert.equal(h.calls.configure.length,0);
});
test('desativar cancela tarefa e a escolha permanece salva',async()=>{
 const h=harness();await h.manager.refresh();await h.manager.setEnabled(false);assert.equal(h.calls.configure.at(-1),false);assert.equal(h.manager.getState().enabled,false);assert.equal(h.storage.get('nw:android-update-notifications:v1'),'false');
});
test('permissão é solicitada somente pela ação explícita de ativar',async()=>{
 const h=harness({permission:'prompt'});await h.manager.refresh();assert.equal(h.calls.request,0);await h.manager.setEnabled(true);assert.equal(h.calls.request,1);assert.equal(h.calls.configure.at(-1),true);
});
test('automático desligado cancela verificação de fundo sem apagar preferência de aviso',async()=>{
 const h=harness({updates:{automatic:false,release}});h.manager.start();await h.settle();assert.equal(h.calls.configure.at(-1),false);assert.equal(h.manager.getState().enabled,true);assert.equal(h.calls.notify.length,0);
});
test('aviso só encaminha release válida mais nova e nenhum dado de conta',async()=>{
 const h=harness({updates:{release}});await h.manager.refresh();assert.equal(h.calls.notify.length,1);assert.deepEqual(Object.keys(h.calls.notify[0]).sort(),['build','releaseId','url','version']);
 h.state.release={...release,url:'https://evil.test/file.apk'};await h.manager.refresh();assert.equal(h.calls.notify.length,1);
 h.state.release={...release,build:16};await h.manager.refresh();assert.equal(h.calls.notify.length,1);
 const blocked=harness({channel:false,updates:{release}});await blocked.manager.refresh();assert.equal(blocked.calls.notify.length,0);assert.equal(blocked.manager.getState().channelEnabled,false);
});
test('desativar enquanto permissão está pendente não reativa tarefa ao responder',async()=>{
 const h=harness({permission:'prompt'});let resolve;h.permissions.request=()=>new Promise(done=>{resolve=done;});const enabling=h.manager.setEnabled(true);await tick();await h.manager.setEnabled(false);resolve({display:'granted'});await enabling;assert.equal(h.calls.configure.at(-1),false);assert.equal(h.manager.getState().enabled,false);
});
test('checagem de permissão antiga não substitui a ativação mais recente',async()=>{
 const h=harness({permission:'prompt'});let resolve;h.permissions.check=()=>new Promise(done=>{resolve=done;});const old=h.manager.refresh();await tick();h.permissions.check=async()=>({display:'granted'});await h.manager.setEnabled(true);resolve({display:'prompt'});await old;assert.equal(h.manager.getState().permission,'granted');assert.equal(h.calls.configure.at(-1),true);
});
