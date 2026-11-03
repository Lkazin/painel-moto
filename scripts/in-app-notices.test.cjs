const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('src/services/inAppNotices.ts','utf8')).replaceAll('export class ','class ').replaceAll('export const ','const ').replaceAll('export function ','function ');
function harness(){
 let now=1000,next=0;const timers=new Map(),storage=new Map();
 const runtime={now:()=>now,schedule:(fn,delay)=>{const id=++next;timers.set(id,{fn,at:now+delay});return id;},cancel:id=>timers.delete(id),readPreference:()=>storage.get('preference')||null,writePreference:value=>storage.set('preference',value)};
 const context={exports:{},localStorage:{getItem:()=>null},setTimeout,clearTimeout};vm.runInNewContext(source+';exports.Queue=InAppNoticeQueue;',context);
 const queue=new context.exports.Queue(runtime);
 return {queue,storage,timers,Queue:context.exports.Queue,runtime,advance(ms){const target=now+ms;while(true){const due=[...timers].filter(([,timer])=>timer.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();}now=target;}};
}
const info=(id='info')=>({id,kind:'info',title:'Aviso',message:'Mensagem'});
const offer=(id='offer',expiresAt=10000)=>({id,kind:'offer',title:'Nova entrega',message:'Loja de teste',expiresAt});
test('offers preempt information and retain FIFO ordering without duplicates',()=>{
 const h=harness();h.queue.setVisible(true);h.queue.publish(info());h.queue.publish(offer('one'));h.queue.publish(offer('two'));
 assert.equal(h.queue.getState().current.id,'one');assert.equal(h.queue.getState().pendingCount,2);
 assert.equal(h.queue.publish(offer('one')),false);h.queue.remove('one');assert.equal(h.queue.getState().current.id,'two');h.queue.remove('two');assert.equal(h.queue.getState().current.id,'info');
});
test('offer requires real valid expiry and cannot reopen after expiration',()=>{
 const h=harness();h.queue.setVisible(true);let opened=0;
 assert.equal(h.queue.publish({...offer(),expiresAt:undefined}),false);assert.equal(h.queue.publish(offer('bad','not-a-date')),false);assert.equal(h.queue.publish(offer('old',999)),false);
 h.queue.publish({...offer('valid',1600),onOpen:()=>opened++});h.advance(600);assert.equal(h.queue.getState().current,null);h.queue.open('valid');assert.equal(opened,0);
});
test('hidden page pauses informative notices but expired offers never reappear',()=>{
 const h=harness();h.queue.setVisible(true);h.queue.publish(info());h.advance(1000);h.queue.setVisible(false);assert.equal(h.queue.getState().current,null);assert.equal(h.timers.size,0);
 h.advance(30000);h.queue.publish(offer('hidden',40000));h.advance(10000);h.queue.setVisible(true);assert.equal(h.queue.getState().current.id,'info');h.advance(4499);assert.equal(h.queue.getState().current.id,'info');h.advance(1);assert.equal(h.queue.getState().current,null);
});
test('clearing session removes old callbacks, queue and deduplication state',()=>{
 const h=harness();let opened=0;h.queue.setVisible(true);h.queue.publish({...offer(),onOpen:()=>opened++});h.queue.publish(info());h.queue.clear();h.queue.open('offer');h.advance(20000);
 assert.equal(opened,0);assert.equal(h.queue.getState().current,null);assert.equal(h.queue.getState().pendingCount,0);assert.equal(h.queue.publish(info()),true);
});
test('disabling animated presentation persists without dropping notices or altering callbacks',()=>{
 const h=harness();let opened=0;h.queue.setVisible(true);h.queue.setAnimated(false);h.queue.publish({...info(),onOpen:()=>opened++});
 assert.equal(h.queue.getState().animated,false);assert.equal(h.queue.getState().current.id,'info');assert.equal(h.storage.get('preference'),'false');h.queue.open('info');assert.equal(opened,1);
 assert.equal(new h.Queue(h.runtime).getAnimated(),false);
});
test('new events do not indefinitely prolong the currently displayed information',()=>{
 const h=harness();h.queue.setVisible(true);h.queue.publish(info('first'));h.advance(5000);h.queue.publish(info('second'));h.advance(500);assert.equal(h.queue.getState().current.id,'second');
});
test('cancelled queued offer is removed and stale tap cannot open another offer',()=>{
 const h=harness();let tapped=0;h.queue.setVisible(true);h.queue.publish({...offer('first'),onOpen:()=>tapped++});h.queue.publish(offer('second'));h.queue.remove('second');h.queue.open('second');assert.equal(tapped,0);assert.equal(h.queue.getState().current.id,'first');assert.equal(h.queue.getState().pendingCount,0);
});
