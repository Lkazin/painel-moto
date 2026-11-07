const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
test('prévia de vibração usa a escolha temporária e preserva preferência salva',()=>{
 const stored=new Map([['nw:driver-vibration:v1','false'],['nw:driver-offer-sound:tech-default-v2','done'],['nw:driver-offer-sound:v1','soft']]);
 const calls=[];
 const context={console,window:{},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},navigator:{vibrate:p=>{calls.push(p);return true;}}};
 const source=stripTypeScriptTypes(fs.readFileSync('src/utils/audioAlert.ts','utf8')).replaceAll('export const ','const ');
 vm.createContext(context);vm.runInContext(source+';this.audio=audioAlert;',context);
 assert.equal(context.audio.previewOfferSound('tech',true),true);assert.equal(calls.length,1);
 assert.equal(context.audio.getVibrationEnabled(),false);assert.equal(context.audio.getOfferSound(),'soft');
 assert.equal(stored.get('nw:driver-vibration:v1'),'false');assert.equal(stored.get('nw:driver-offer-sound:v1'),'soft');
 context.audio.previewOfferSound('tech',false);assert.equal(calls.length,1);
});
