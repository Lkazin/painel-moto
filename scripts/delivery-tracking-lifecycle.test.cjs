const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const source = stripTypeScriptTypes(fs.readFileSync('src/services/deliveryTrackingLifecycle.ts','utf8').replace(/import[^;]+;/g,''))
  .replace('export function ', 'function ');
const context = {exports:{}};vm.runInNewContext(source+';exports.decide=deliveryTrackingDecision;',context);
const decide=context.exports.decide;
const assignment=(id,status='picked_up')=>({assignmentId:id,status});
test('offline queued delivery never finishes route or removes its active tracking assignment',()=>{
 const result=decide([assignment('A')],'A',false);
 assert.equal(result.canFinishRoute,false);assert.equal(result.remaining.length,1);
 assert.equal(decide([],'A',false).canFinishRoute,false);
});
test('confirmed delivery keeps GPS for the remaining route without waiting-pickup orders',()=>{
 const result=decide([assignment('A'),assignment('B','in_transit'),assignment('C','waiting_pickup')],'A',true);
 assert.equal(result.canFinishRoute,false);assert.equal(result.remaining.length,1);assert.equal(result.remaining[0].assignmentId,'B');
});
test('last server-confirmed delivery can finish GPS even if stale snapshot still contains completed stop',()=>{
 assert.equal(decide([assignment('A')],'A',true).canFinishRoute,true);
 assert.equal(decide([assignment('A','delivered')],'A',true).canFinishRoute,true);
});
