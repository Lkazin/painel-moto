const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('src/services/deliveryHistory.ts','utf8').replace(/import[^;]+;/g,'')).replace('export function','function');
const context={exports:{}};vm.runInNewContext(source+';exports.normalize=normalizeDeliveryHistory;',context);
const normalize=context.exports.normalize;
test('backend history contract with missing PIN does not crash or invent confirmation',()=>{
 const result=normalize({items:[{id:'a',orderNumber:123,deliveryAddress:'Rua Teste',deliveryFee:8,deliveredAt:'2026-11-03T10:00:00Z'}]});
 assert.equal(result.items[0].address,'Rua Teste');assert.equal(result.items[0].confirmedVia,'unknown');assert.equal(result.items[0].completedAt,'2026-11-03T10:00:00Z');assert.equal(result.totalEarnings,8);
});
test('null records, missing fees, malformed numbers and empty responses are safe',()=>{
 for(const value of [null,undefined,{}, {items:'bad'}])assert.equal(normalize(value).items.length,0);
 const result=normalize([null,{}, {deliveryFee:'9.50'}, {deliveryFee:'bad'}, {deliveryFee:Infinity},{deliveryFee:-2}]);
 assert.equal(result.items.length,5);assert.equal(result.totalEarnings,9.5);assert.equal(result.hasUninformedFees,true);assert.equal(result.items[0].deliveryFee,null);
});
test('current contract preserves real confirmation, zero fee and timestamps',()=>{
 const result=normalize([{id:'a',deliveryFee:0,completedAt:'2026-11-03T10:00:00Z',confirmedVia:'store_override'},{id:'b',deliveryFee:12,confirmedVia:'pin_offline_synced'}]);
 assert.equal(result.items[0].confirmedVia,'store_override');assert.equal(result.items[1].confirmedVia,'pin_offline_synced');assert.equal(result.hasUninformedFees,false);assert.equal(result.totalEarnings,12);
});
