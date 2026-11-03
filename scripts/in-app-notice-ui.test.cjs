const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const compiled=(async()=>{
 const {transformSync}=await import('rolldown/utils');
 const source=fs.readFileSync('src/components/InAppNotice.tsx','utf8').replace(/import[\s\S]*?from '[^']+';/g,'').replace(/import '[^']+';/g,'').replace('export function ','function ');
 const result=transformSync('InAppNotice.tsx',source,{jsx:{runtime:'classic'},tsconfig:false});
 assert.equal(result.errors.length,0);return result.code+';exports.InAppNotice=InAppNotice;';
})();
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const text=node=>node==null||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(''):typeof node==='object'?text(node.props?.children):String(node);
const notice=id=>({id,kind:'offer',title:'Nova entrega',message:'Loja de teste',expiresAt:9000,onOpen:()=>{}});

async function harness({animated=true,reduced=false,current=notice('offer-a')}={}){
 let state={current,pendingCount:0,animated},index=0,dirty=false,view,nextTimer=0;
 const slots=[],effects=[],listeners=new Set(),timers=new Map();
 const calls={opened:[],dismissed:[],starts:0,stops:0,unsubscribed:0};
 const hooks={
  useState(initial){const slot=index++;if(!(slot in slots))slots[slot]={value:initial};return[slots[slot].value,value=>{slots[slot].value=typeof value==='function'?value(slots[slot].value):value;dirty=true;}];},
  useRef(initial){const slot=index++;return slots[slot]||(slots[slot]={current:initial});},
  useEffect(fn){const slot=index++;if(!(slot in slots)){slots[slot]={};effects.push(()=>{slots[slot].cleanup=fn();});}},
 };
 const emit=patch=>{state={...state,...patch};for(const listener of listeners)listener({...state});};
 const context={exports:{},...hooks,window:{matchMedia:()=>({matches:reduced})},
  React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},
  BellRing:()=>null,CheckCircle2:()=>null,Info:()=>null,AlertCircle:()=>null,X:()=>null,ChevronRight:()=>null,
  subscribeNotices(listener){listeners.add(listener);listener({...state});return()=>{listeners.delete(listener);calls.unsubscribed++;};},
  startInAppNotices(){calls.starts++;return()=>{calls.stops++;};},
  openNotice(id){calls.opened.push(id);},
  dismissNotice(id){calls.dismissed.push(id);if(state.current?.id===id)emit({current:null});},
  setTimeout(fn,delay){const timer=++nextTimer;timers.set(timer,{fn,delay});return timer;},
  clearTimeout(id){timers.delete(id);},
 };
 vm.runInNewContext(await compiled,context);
 function render(){for(let pass=0;pass<10;pass++){dirty=false;index=0;view=context.exports.InAppNotice();while(effects.length)effects.shift()();if(!dirty)return view;}throw Error('Notice render did not settle');}
 const h={calls,timers,render,nodes:()=>nodes(view),content:()=>text(view),
  emit(patch){emit(patch);return render();},
  click(label){const button=nodes(view).find(node=>node.type==='button'&&(node.props['aria-label']===label||text(node)===label));assert(button,`button ${label}`);assert(!button.props.disabled);button.props.onClick();return render();},
  flushTimers(){for(const[id,timer]of [...timers]){timers.delete(id);timer.fn();}return render();},
  unmount(){for(const slot of slots)slot?.cleanup?.();},
  listeners:()=>listeners.size,
 };
 render();return h;
}

test('touch opens the currently rendered offer ID, not a previous notice',async t=>{
 const h=await harness();t.after(h.unmount);assert.match(h.content(),/Nova entrega/);h.click('Ver entrega');assert.deepEqual(h.calls.opened,['offer-a']);
 h.emit({current:notice('offer-b')});h.click('Ver entrega');assert.deepEqual(h.calls.opened,['offer-a','offer-b']);
 assert(h.nodes().some(node=>node.props.role==='status'&&node.props['aria-live']==='polite'));
});
test('animated dismiss waits for its exit then removes exactly that notice',async t=>{
 const h=await harness();t.after(h.unmount);h.click('Dispensar aviso');assert.equal(h.calls.dismissed.length,0);assert.equal(h.timers.size,1);
 assert.equal([...h.timers.values()][0].delay,150);assert(h.nodes().some(node=>node.props.className?.includes('nw-notice-leaving')));assert(h.nodes().filter(node=>node.type==='button').every(node=>node.props.disabled));
 h.flushTimers();assert.deepEqual(h.calls.dismissed,['offer-a']);assert.equal(h.render(),null);
});
test('disabled animation and reduced motion dismiss immediately without timers',async()=>{
 for(const options of [{animated:false},{reduced:true}]){
  const h=await harness(options);h.click('Dispensar aviso');assert.equal(h.timers.size,0);assert.deepEqual(h.calls.dismissed,['offer-a']);assert.equal(h.render(),null);h.unmount();
 }
});
test('unmount clears pending exit and store subscription; hidden state renders nothing',async()=>{
 const h=await harness();h.click('Dispensar aviso');assert.equal(h.timers.size,1);h.unmount();assert.equal(h.timers.size,0);assert.equal(h.listeners(),0);assert.equal(h.calls.stops,1);assert.equal(h.calls.unsubscribed,1);assert.equal(h.calls.dismissed.length,0);
 const hidden=await harness({current:null});assert.equal(hidden.render(),null);hidden.emit({current:notice('fresh')});assert.match(hidden.content(),/Nova entrega/);hidden.emit({current:null});assert.equal(hidden.render(),null);hidden.unmount();
});
