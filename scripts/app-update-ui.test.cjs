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
const initialState = {supported:true,checking:false,currentVersion:'1.1.0',currentBuild:2,release:publishedRelease,dismissed:false,error:null,checkedAt:1730000000000,automatic:true};
const initialNotify = {supported:true,enabled:true,permission:'prompt',channelEnabled:null,busy:false,error:null};
const text = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node,...nodes(node.props?.children)];

async function harness(exportName='AppUpdateNotice', stateUpdate={}, notifyUpdate={}) {
  let state={...initialState,...stateUpdate},notifyState={...initialNotify,...notifyUpdate},view,active,dirty=false,mounted=false;
  const instances=new Map(),effects=[],listeners=new Set(),notifyListeners=new Set(),calls={starts:0,stops:0,unsubscribes:0,downloads:0,dismisses:0,checks:[],automatic:[],notificationEnables:[],notificationRefreshes:0};
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
    setAutomatic(value){calls.automatic.push(value);emit({automatic:value});},
  };
  function emitNotify(update){notifyState={...notifyState,...update};for(const listener of notifyListeners)listener({...notifyState});}
  let nextNotificationEnable=async value=>{emitNotify({enabled:value});};
  const updateNotifications={
    getState:()=>({...notifyState}),
    subscribe(listener){notifyListeners.add(listener);listener({...notifyState});return ()=>notifyListeners.delete(listener);},
    async refresh(){calls.notificationRefreshes++;},
    setEnabled(value){calls.notificationEnables.push(value);return nextNotificationEnable(value);},
  };
  const jsx=(type,props)=>({type,props:props||{}}),context={exports:{},require(id){
    if(id==='react')return hooks;
    if(id==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
    if(id==='lucide-react')return new Proxy({}, {get:()=>()=>null});
    if(id==='../services/appUpdates')return {appUpdates};
    if(id==='../services/updateNotifications')return {updateNotifications};
    if(id.endsWith('.css'))return {};
    throw Error(`Unexpected dependency in update UI: ${id}`);
  }};
  Object.assign(context,hooks,{appUpdates,updateNotifications,React:{createElement:(type,props,...children)=>jsx(type,{...props,children}),Fragment:'fragment'},Download:()=>null,RefreshCw:()=>null,X:()=>null,BellRing:()=>null});
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
    emitNotify(update){emitNotify(update);return render();},
    button(label){const found=nodes(view).find(node=>node.type==='button'&&(node.props['aria-label']===label||text(node)===label));assert.ok(found,`Button '${label}' exists`);return found;},
    async click(label){const button=h.button(label);assert.ok(!button.props.disabled,`Button '${label}' is enabled`);button.props.onClick();render();await new Promise(setImmediate);return render();},
    async settle(){await new Promise(setImmediate);if(mounted)return render();},
    failDownload(){nextDownload=()=>Promise.reject(Error('Browser unavailable'));},
    pendingDownload(promise){nextDownload=()=>promise;},
    failNotificationEnable(){nextNotificationEnable=()=>Promise.reject(Error('Permission unavailable'));},
    checkbox(label){const found=nodes(view).find(node=>node.type==='label'&&text(node).includes(label));assert.ok(found,`Label '${label}' exists`);return nodes(found).find(node=>node.type==='input'&&node.props.type==='checkbox');},
    async change(label,checked){const input=h.checkbox(label);assert.ok(!input.props.disabled);input.props.onChange({target:{checked}});render();await new Promise(setImmediate);return render();},
    listenerCount:()=>listeners.size,
    notificationListenerCount:()=>notifyListeners.size,
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

test('aviso compacto inclui notas sem cabeçalho Markdown e não abre permissão Android ao montar',async t=>{
  const h=await harness('AppUpdateNotice',{release:{...publishedRelease,notes:'# Novidades **Melhorias** em [pedidos](https://example.test).'}});t.after(h.unmount);
  assert.match(h.content(),/Novidades Melhorias em pedidos\./);
  assert.doesNotMatch(h.content(),/# Novidades|\*\*|https:\/\/example/);
  assert.equal(h.calls.notificationRefreshes,0);
  assert.deepEqual(h.calls.notificationEnables,[]);
  assert.equal(h.notificationListenerCount(),0);
  const css=fs.readFileSync('src/components/AppUpdateNotice.css','utf8');
  assert.match(css,/safe-area-inset-top/);
  assert.doesNotMatch(css,/position:\s*fixed|bottom:\s*calc\(84px/);
});

test('configurações só consultam permissão; solicitar aviso exige toque explícito',async t=>{
  const h=await harness('AppUpdateSettings');t.after(h.unmount);
  assert.equal(h.calls.notificationRefreshes,1);
  assert.deepEqual(h.calls.notificationEnables,[]);
  assert.equal(h.notificationListenerCount(),1);
  assert.match(h.content(),/Falta permitir/);
  await h.click('Permitir aviso no celular');
  assert.deepEqual(h.calls.notificationEnables,[true]);
  h.emitNotify({permission:'granted',channelEnabled:true});
  assert.match(h.content(),/Permissão e canal de atualização habilitados/);
  await h.change('Notificar sobre novas versões',false);
  assert.deepEqual(h.calls.notificationEnables,[true,false]);
  assert.match(h.content(),/Aviso no celular desativado/);
  h.unmount();assert.equal(h.notificationListenerCount(),0);
});

test('permissão negada ou canal bloqueado orientam Android e conferem sem pedir permissão',async t=>{
  const h=await harness('AppUpdateSettings',{}, {permission:'denied',channelEnabled:false});t.after(h.unmount);
  assert.match(h.content(),/Configurações → Aplicativos → NovaesWeb Entregador → Notificações/);
  await h.click('Verificar permissão');
  assert.equal(h.calls.notificationRefreshes,2);
  assert.deepEqual(h.calls.notificationEnables,[]);
  h.emitNotify({permission:'granted',channelEnabled:false});
  assert.match(h.content(),/Aviso bloqueado/);
});

test('aviso no celular não força verificação automática e mostra limitações e privacidade',async t=>{
  const h=await harness('AppUpdateSettings',{automatic:false},{permission:'granted',channelEnabled:null});t.after(h.unmount);
  assert.match(h.content(),/verificação automática está desligada/);
  assert.match(h.content(),/canal de atualização ainda precisa ser conferido/);
  assert.match(h.content(),/mesmo com o app fechado/);
  assert.match(h.content(),/restrições de bateria/);
  assert.match(h.content(),/Não envia dados da sua conta/);
  assert.deepEqual(h.calls.automatic,[]);
  await h.change('Verificar novas versões automaticamente',true);
  assert.deepEqual(h.calls.automatic,[true]);
  assert.doesNotMatch(h.content(),/verificação automática está desligada/);
});

test('recurso indisponível fica desabilitado e falha de ativação permanece recuperável',async t=>{
  const unavailable=await harness('AppUpdateSettings',{}, {supported:false,permission:'unavailable'});t.after(unavailable.unmount);
  assert.equal(unavailable.checkbox('Notificar sobre novas versões').props.disabled,true);
  assert.match(unavailable.content(),/Versões antigas não recebem esse recurso/);
  const failed=await harness('AppUpdateSettings');t.after(failed.unmount);
  failed.failNotificationEnable();await failed.click('Permitir aviso no celular');
  assert.match(failed.content(),/Não foi possível configurar o aviso/);
  assert.ok(failed.button('Permitir aviso no celular'));
  failed.emitNotify({busy:true});assert.equal(failed.button('Permitir aviso no celular').props.disabled,true);
});
