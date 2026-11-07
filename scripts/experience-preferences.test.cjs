const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
function harness(stored=null){
 const memory=new Map(stored?[['nw:driver-experience:v1',stored]]:[]),vibrations=[];
 let reduced=false;
 const context={localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},window:{matchMedia:()=>({matches:reduced})},navigator:{vibrate:p=>{vibrations.push(p);return true;}}};
 let source=stripTypeScriptTypes(fs.readFileSync('src/services/experiencePreferences.ts','utf8').replace(/import[^;]+;/g,''));
 source=source.replaceAll('export function ','function ');
 vm.createContext(context); vm.runInContext(source+';Object.assign(this,{normalizeExperience,getExperiencePreferences,updatePreferences,subscribeExperience,hapticFeedback,prefersReducedMotion});',context);
 return {...context,memory,vibrations,setReduced:value=>{reduced=value;}};
}
test('preferências inválidas não persistem campos estranhos nem quebram o padrão',()=>{
 const h=harness('{bad json');assert.equal(h.getExperiencePreferences().theme,'dark');
 h.updatePreferences({theme:'evil',textScale:'huge',token:'private',outdoor:true});
 const saved=JSON.parse(h.memory.get('nw:driver-experience:v1'));
 assert.equal(saved.theme,'dark');assert.equal(saved.textScale,'normal');assert.equal(saved.outdoor,true);assert.equal('token' in saved,false);
});
test('preferências notificam a interface e podem ser desativadas sem reiniciar',()=>{
 const h=harness();let calls=0;const stop=h.subscribeExperience(()=>calls++);
 assert.equal(h.hapticFeedback(),true);h.updatePreferences({haptics:false});assert.equal(h.hapticFeedback('success'),false);assert.equal(h.vibrations.length,1);
 assert.equal(calls,1);stop();h.updatePreferences({focus:true});assert.equal(calls,1);
});
test('redução de movimento respeita escolha do app e configuração do aparelho',()=>{
 const h=harness();assert.equal(h.prefersReducedMotion(),false);h.setReduced(true);assert.equal(h.prefersReducedMotion(),true);
 h.setReduced(false);h.updatePreferences({reducedMotion:true});assert.equal(h.prefersReducedMotion(),true);
});
