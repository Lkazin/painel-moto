const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('src/services/trackingPresentation.ts','utf8').replace(/import[^;]+;/g,''))
  .replace('export function trackingPresentation','function trackingPresentation');
const ctx={exports:{},Date,Number,Math};
vm.runInNewContext(source+';exports.trackingPresentation=trackingPresentation;',ctx);
const present=ctx.exports.trackingPresentation;
const now=Date.parse('2026-11-02T12:00:00Z');
const state={isActive:true,driverId:'own-driver',lastLocation:{latitude:-29.9,longitude:-51.1,timestamp:now-1000,accuracy:10},lastPushedAt:new Date(now-1000).toISOString()};

test('capture without confirmed send never claims server synchronization',()=>{
 assert.equal(present({...state,lastPushedAt:null},'granted',true,now).kind,'captured');
 assert.match(present({...state,lastPushedAt:null},'granted',true,now).detail,/ainda não confirmou/);
});
test('inactive, denied and offline states never claim live sharing',()=>{
 assert.equal(present({...state,isActive:false},'granted',true,now).kind,'paused');
 assert.equal(present(state,'denied',true,now).kind,'denied');
 assert.equal(present(state,'granted',false,now).kind,'offline');
});
test('fresh confirmation expires to stale and lost without a new callback',()=>{
 assert.equal(present(state,'granted',true,now).kind,'fresh');
 assert.equal(present(state,'granted',true,now+31000).kind,'stale');
 assert.equal(present(state,'granted',true,now+121000).kind,'lost');
});
test('old confirmed send does not become current because device has a new capture',()=>{
 assert.equal(present({...state,lastPushedAt:new Date(now-60000).toISOString()},'granted',true,now).kind,'stale');
 assert.equal(present({...state,lastPushedAt:new Date(now-121000).toISOString()},'granted',true,now).kind,'lost');
});
test('invalid or inaccurate captures and future confirmations are never shown as fresh',()=>{
 for(const patch of [{latitude:91},{longitude:181},{accuracy:101},{timestamp:now+6000},{timestamp:undefined}]) {
  assert.notEqual(present({...state,lastLocation:{...state.lastLocation,...patch}},'granted',true,now).kind,'fresh');
 }
 assert.equal(present({...state,lastPushedAt:new Date(now+6000).toISOString()},'granted',true,now).kind,'captured');
 assert.equal(present({...state,error:'Falha no envio'},'granted',true,now).kind,'stale');
});
