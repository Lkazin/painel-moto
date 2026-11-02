const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');


const compiledSource=(async()=>{
  const {transformSync}=await import('rolldown/utils');
  const source=fs.readFileSync('src/components/AppUpdateNotice.tsx','utf8')
    .replace(/import[\s\S]*?from '[^']+';/g,'').replace(/import '[^']+';/g,'').replaceAll('export function ','function ');
  const result=transformSync('AppUpdateNotice.tsx',source,{jsx:{runtime:'classic'},tsconfig:false});
  assert.equal(result.errors.length,0);
  return result.code+';Object.assign(exports,{AppUpdateNotice,AppUpdateSettings});';
})();
const publishedRelease = {version:'1.2.0',build:3,id:'release:asset:3',url:'https://github.com/Lkazin/painel-moto/releases/download/android-v1.2.0/NovaesWeb-Entregador-v1.2.0-code3.apk',notes:'Correções e melhorias.'};
const initialState = {supported:true,checking:false,currentVersion:'1.1.0',currentBuild:2,release:publishedRelease,dismissed:false,error:null,checkedAt:1730000000000};
const text = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node,...nodes(node.props?.children)];

async function harness(exportName='AppUpdateNotice', stateUpdate={}) {
  let state={...initialState,...stateUpdate},view,active,dirty=false,mounted=false;
  const instances=new Map(),effects=[],listeners=new Set(),calls={starts:0,stops:0,unsubscribes:0,downloads:0,dismisses:0,checks:[]};
  let nextDownload=()=>Promise.resolve();
  const changed=(previous,deps)=>!previous||deps.some((value,index)=>value!==previous.deps[index]);
  const hooks={
    useState(initial){const owner=active,index=owner.cursor++;if(!owner.slots[index])owner.slots[index]={value:typeof initial==='function'?initial():initial};return [owner.slots[index].value,value=>{owner.slots[index].value=typeof value==='function'?value(owner.slots[index].value):value;dirty=true;}];},
    useEffect(fn,deps){const owner=active,index=owner.cursor++,previous=owner.slots[index];if(changed(previous,deps))effects.push(()=>{previous?.cleanup?.();owner.slots[index]={deps,cleanup:fn()};});},
  };
  function emit(update){state={...state,...update};for(const listener of listeners)listener({...state});}
  const appUpdates={
    subscribe(listener){listeners.add(listener);listener({...state});return ()=>{listeners.delete(listener);calls.unsubscribes++;};},
    start(){calls.starts++;let stopped=false;return ()=>{if(!stopped){calls.stops++;stopped=true;}};},
    async check(force){calls.checks.push(force);},
    dismiss(){calls.dismisses++;emit({dismissed:true});},
    openDownload(){calls.downloads++;return nextDownload();},
  };
  const jsx=(type,props)=>({type,props:props||{}}),context={exports:{},require(id){
    if(id==='react')return hooks;
    if(id==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
    if(id==='lucide-react')return new Proxy({}, {get:()=>()=>null});
    if(id==='../services/appUpdates')return {appUpdates};
    if(id.endsWith('.css'))return {};
    throw Error(`Unexpected dependency in update UI: ${id}`);
  }};
  Object.assign(context,hooks,{appUpdates,React:{createElement:(type,props,...children)=>jsx(type,{...props,children}),Fragment:'fragment'},Download:()=>null,RefreshCw:()=>null,X:()=>null});
  vm.runInNewContext(await compiledSource,context);
  const component=context.exports[exportName];
  function expand(node,path,visited){
    if(Array.isArray(node))return node.map((child,index)=>expand(child,`${path}.${index}`,visited));
    if(!node||typeof node!=='object')return node;
    if(typeof node.type==='function'){
      let instance=instances.get(path);
      if(!instance||instance.type!==node.type){instance?.slots.forEach(slot=>slot?.cleanup?.());instance={type:node.type,slots:[],cursor:0};instances.set(path,instance);}
      visited.add(path);instance.cursor=0;const previous=active;active=instance;const output=node.type(node.props);active=previous;
      return expand(output,`${path}.result`,visited);
    }
    return {...node,props:{...node.props,children:expand(node.props?.children,`${path}.children`,visited)}};
  }
  function render(){
    mounted=true;
    for(let pass=0;pass<20;pass++){
      dirty=false;const visited=new Set();view=expand(jsx(component,{}),'root',visited);
      for(const [path,instance]of instances)if(!visited.has(path)){instance.slots.forEach(slot=>slot?.cleanup?.());instances.delete(path);}
      while(effects.length)effects.shift()();
      if(!dirty)return view;
    }
    throw Error('Update UI did not settle after effect/state processing.');
  }
  const h={calls,emit(update){emit(update);return render();},render,content:()=>text(view),nodes:()=>nodes(view),
    button(label){const found=nodes(view).find(node=>node.type==='button'&&(node.props['aria-label']===label||text(node)===label));assert.ok(found,`Button '${label}' exists`);return found;},
    async click(label){const button=h.button(label);assert.ok(!button.props.disabled,`Button '${label}' is enabled`);button.props.onClick();render();await new Promise(setImmediate);return render();},
    async settle(){await new Promise(setImmediate);if(mounted)return render();},
    failDownload(){nextDownload=()=>Promise.reject(Error('Browser unavailable'));},
    pendingDownload(promise){nextDownload=()=>promise;},
    listenerCount:()=>listeners.size,
    unmount(){mounted=false;for(const instance of instances.values())instance.slots.forEach(slot=>slot?.cleanup?.());instances.clear();effects.length=0;},
  };
  render();return h;
}

test('browser and no published update show no notification; dismissed update remains accessible in settings',async t=>{
  const browser=await harness('AppUpdateNotice',{supported:false});t.after(browser.unmount);assert.equal(browser.render(),null);
  const browserSettings=await harness('AppUpdateSettings',{supported:false});t.after(browserSettings.unmount);assert.equal(browserSettings.render(),null);
  const noRelease=await harness('AppUpdateNotice',{release:null});t.after(noRelease.unmount);assert.equal(noRelease.render(),null);
  const dismissed=await harness('AppUpdateNotice',{dismissed:true});t.after(dismissed.unmount);assert.equal(dismissed.render(),null);
  const settings=await harness('AppUpdateSettings',{dismissed:true});t.after(settings.unmount);assert.match(settings.content(),/Versão 1\.2\.0 disponível/);assert.ok(settings.button('Baixar e atualizar'));
});

test('native update banner displays version and download action without a blocking modal',async t=>{
  const h=await harness();t.after(h.unmount);assert.match(h.content(),/Nova versão disponível/);assert.match(h.content(),/NovaesWeb Entregador 1\.2\.0/);
  assert.equal(h.nodes().find(node=>node.type==='aside').props.role,'status');assert.ok(!h.nodes().some(node=>node.props.role==='dialog'||node.props['aria-modal']));
  assert.match(h.content(),/Conclua suas entregas/);assert.equal(h.calls.downloads,0);
  await h.click('Baixar e atualizar');assert.equal(h.calls.downloads,1);assert.equal(h.calls.dismisses,0);assert.match(h.content(),/Nova versão disponível/);
  await h.click('Agora não');assert.equal(h.calls.dismisses,1);assert.equal(h.render(),null);
});

test('manual version check forces refresh and handles checking, outage and no available release',async t=>{
  const h=await harness('AppUpdateSettings',{release:null});t.after(h.unmount);assert.match(h.content(),/Versão instalada: 1\.1\.0/);
  assert.equal(h.calls.starts,0,'settings observes the shared service without starting a second lifecycle');
  await h.click('Verificar atualização');assert.deepEqual(h.calls.checks,[true]);
  h.emit({checking:true});assert.equal(h.button('Verificando…').props.disabled,true);assert.doesNotMatch(h.content(),/Nenhuma atualização publicada/);
  h.emit({checking:false,error:'Offline'});assert.match(h.content(),/Não foi possível verificar agora/);assert.doesNotMatch(h.content(),/Nenhuma atualização publicada/);
  h.emit({error:null});assert.match(h.content(),/Nenhuma atualização publicada disponível/);
  h.emit({release:publishedRelease});assert.ok(h.button('Baixar e atualizar'));
});

test('failed download stays in the update notice with retry instead of dismissing it',async t=>{
  const h=await harness();t.after(h.unmount);h.failDownload();await h.click('Baixar e atualizar');
  assert.equal(h.calls.downloads,1);assert.match(h.content(),/Não foi possível abrir o download/);assert.equal(h.calls.dismisses,0);assert.ok(h.button('Baixar e atualizar'));
});

test('pending download disables its button and normal behavior resumes when opening finishes',async t=>{
  const h=await harness();t.after(h.unmount);let resolve;h.pendingDownload(new Promise(done=>{resolve=done;}));
  await h.click('Baixar e atualizar');assert.equal(h.button('Abrindo download…').props.disabled,true);assert.equal(h.calls.downloads,1);
  resolve();await h.settle();assert.equal(h.button('Baixar e atualizar').props.disabled,false);
});

test('mount cleanup and strict replay own exactly one active subscription and lifecycle',async()=>{
  const h=await harness();assert.equal(h.listenerCount(),1);assert.equal(h.calls.starts-h.calls.stops,1);
  h.unmount();assert.equal(h.listenerCount(),0);assert.equal(h.calls.stops,1);assert.equal(h.calls.unsubscribes,1);
  h.render();assert.equal(h.listenerCount(),1);assert.equal(h.calls.starts-h.calls.stops,1);
  h.unmount();assert.equal(h.listenerCount(),0);assert.equal(h.calls.starts,h.calls.stops);
});
