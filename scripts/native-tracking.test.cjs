const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; }
function harness() {
  const calls = [], removed = [], http = [];
  const state = { permission: Promise.resolve({display:'granted'}), add: null };
  const plugin = {
    async addWatcher(options, cb) { calls.push({options, cb}); return state.add || 'watch-'+calls.length; },
    async removeWatcher({id}) { removed.push(id); },
  };
  const context = { exports:{}, console, Headers, DOMException, setTimeout, clearTimeout,
    Capacitor: {isNativePlatform:()=>true,getPlatform:()=>'android'},
    CapacitorHttp: {async request(options) {http.push(options); return {status:200,data:{success:true}};}},
    registerPlugin: () => plugin,
    LocalNotifications: { checkPermissions:()=>state.permission, requestPermissions:async()=>({display:'denied'}) },
  };
  let source = stripTypeScriptTypes(fs.readFileSync('src/services/nativeTracking.ts','utf8').replace(/import[^;]+;/g,''))
    .replaceAll('export class ','class ').replaceAll('export async function ','async function ').replaceAll('export function ','function ').replaceAll('export const ','const ');
  vm.runInNewContext(source+';Object.assign(exports,{NativeTrackingWatcher,nativeAccountRequest,nativeCurrentPosition});',context);
  return {...context.exports,state,calls,removed,http};
}
test('logout during permission request prevents background watcher from starting',async()=>{
  const h=harness(), gate=deferred();h.state.permission=gate.promise;
  const watcher=new h.NativeTrackingWatcher();const pending=watcher.start(()=>{},()=>{});
  await new Promise(setImmediate);await watcher.stop();gate.resolve({display:'granted'});await pending;
  assert.equal(h.calls.length,0);
});
test('logout immediately after start also invalidates queued async start',async()=>{
  const h=harness(), watcher=new h.NativeTrackingWatcher();const pending=watcher.start(()=>{},()=>{});
  await watcher.stop();await pending;assert.equal(h.calls.length,0);
});
test('late watcher is removed and callbacks cannot revive a stopped delivery',async()=>{
  const h=harness(), gate=deferred();h.state.add=gate.promise;
  let locations=0;const watcher=new h.NativeTrackingWatcher();const pending=watcher.start(()=>locations++,()=>{});
  await new Promise(setImmediate);await watcher.stop();gate.resolve('late');await pending;
  h.calls[0].cb({latitude:1,longitude:2});assert.equal(locations,0);assert.deepEqual(h.removed,['late']);
});
test('active watcher has persistent notice and is removed on stop',async()=>{
  const h=harness(), watcher=new h.NativeTrackingWatcher();let received=0;
  await watcher.start(()=>received++,()=>{});assert.match(h.calls[0].options.backgroundMessage,/entrega/);
  assert.equal(h.calls[0].options.stale,false);h.calls[0].cb({time:Date.now()});assert.equal(received,1);
  await watcher.stop();assert.deepEqual(h.removed,['watch-1']);
});
test('native HTTP preserves account header and payload with bounded timeout and no redirects',async()=>{
  const h=harness();const response=await h.nativeAccountRequest('https://store.test/api', {method:'POST',headers:{'x-account-session':'test-session'},body:JSON.stringify({latitude:-29})});
  assert.equal(response.ok,true);assert.equal(h.http[0].headers['x-account-session'],'test-session');
  assert.equal(h.http[0].data.latitude,-29);assert.equal(h.http[0].readTimeout,15000);assert.equal(h.http[0].disableRedirects,true);
  const c=new AbortController();c.abort();await assert.rejects(h.nativeAccountRequest('https://store.test/api',{signal:c.signal}),/Aborted/);
  assert.equal(h.http.length,1);
});
