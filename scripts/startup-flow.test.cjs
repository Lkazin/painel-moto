const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const accountFixture = {id:'account-test',name:'Entregador Teste',phone:'51900000000'};
const sessionFixture = {driverId:'driver-test',membershipId:'membership-A',storeId:'store-A',storeName:'Loja A',token:'fixture-shift'};
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node,...nodes(node.props?.children)];
const text = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node);
const tick = () => new Promise(setImmediate);

async function harness(options={}) {
  const {transformSync} = await import('rolldown/utils');
  const original=fs.readFileSync('src/App.tsx','utf8');
  const source=original.replace(/import[\s\S]*?from '[^']+';/g,'').replace(/import '[^']+';/g,'').replaceAll('export const','const').replace(/export default App;?/g,'');
  const compiled=transformSync('App.tsx',source,{jsx:{runtime:'classic'},tsconfig:false});
  assert.equal(compiled.errors.length,0);
  const slots=[],effects=[],timers=new Map(),events=new Map();
  let cursor=0,dirty=false,view,clock=0,nextTimer=1,mounted=true;
  let cachedAccount=options.account || null,cachedSession=options.session || null,token=cachedAccount?'fixture-account':'';
  let syncResolve,syncReject;
  const syncCalls=[];
  let syncOperation=()=>new Promise((resolve,reject)=>{syncResolve=resolve;syncReject=reject;});
  const changed=(previous,deps)=>!previous||!deps||deps.some((value,index)=>!Object.is(value,previous.deps?.[index]));
  const hooks={
    useState(initial){const index=cursor++;if(!slots[index])slots[index]={value:typeof initial==='function'?initial():initial};return [slots[index].value,value=>{const next=typeof value==='function'?value(slots[index].value):value;if(!Object.is(next,slots[index].value)){slots[index].value=next;dirty=true;}}];},
    useRef(initial){const index=cursor++;return slots[index]||(slots[index]={current:initial});},
    useCallback(fn,deps){const index=cursor++;if(changed(slots[index],deps))slots[index]={value:fn,deps};return slots[index].value;},
    useEffect(fn,deps){const index=cursor++,previous=slots[index];if(changed(previous,deps))effects.push(()=>{previous?.cleanup?.();slots[index]={deps,cleanup:fn()};});},
  };
  const target={addEventListener(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},removeEventListener(name,fn){events.get(name)?.delete(fn);},dispatchEvent(event){for(const fn of [...(events.get(event.type)||[])])fn(event);return true;}};
  const storage=new Map();
  const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  const calls={audioStarts:0,audioStops:0,assignmentRequests:0,noticesCleared:0,notices:[],offersResponded:[],noticesRemoved:[]};
  let respondResolve;
  class Clock extends Date { static now(){return Date.parse('2026-11-03T12:00:00Z')+clock;} }
  const api={
    getDriverAccount:()=>cachedAccount,getSession:()=>cachedSession,getPresence:()=>({manualEnabled:!!options.manualEnabled,isOnline:true}),hasAccountAccess:()=>!!token,
    async synchronizeAccount(){syncCalls.push({at:clock});const result=await syncOperation();cachedAccount=result.account;cachedSession=result.session;return result;},
    async flushOfflineQueue(){return {syncedCount:0,errors:0};},async getAssignments(){calls.assignmentRequests++;return options.assignments||[];},async getHistory(){return {items:[],totalEarnings:0};},
    async getOffers(){return options.offers||[];},respondOffer(id,response){calls.offersResponded.push({id,response});return new Promise(resolve=>{respondResolve=resolve;});},async validateSession(){return {valid:true};},async logoutDriver(){token='';cachedAccount=null;cachedSession=null;target.dispatchEvent({type:'novaesweb:account-change',detail:{message:'Sessão encerrada.'}});},
    getStoresLedger:()=>options.stores||[],
  };
  const createTimer=(callback,delay=0,interval=false)=>{const id=nextTimer++;timers.set(id,{callback,at:clock+delay,delay,interval});return id;};
  const context={exports:{},...hooks,React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},
    console,Promise,Set,Map,Date:Clock,Number,Object,Array,String,Math,Error,localStorage,
    navigator:{onLine:options.online!==false},window:{...target,navigator:{},matchMedia:()=>({matches:false}),location:{reload(){}}},
    document:{...target,visibilityState:'visible',documentElement:{setAttribute(){}}},
    Event:class {constructor(type){this.type=type;}},CustomEvent:class {constructor(type,init={}){this.type=type;this.detail=init.detail;}},
    setTimeout:(fn,delay)=>createTimer(fn,delay),clearTimeout:id=>timers.delete(id),setInterval:(fn,delay)=>createTimer(fn,delay,true),clearInterval:id=>timers.delete(id),
    Capacitor:{isNativePlatform:()=>false},api,
    accountClient:{getNotice:()=>'',getToken:()=>token,getAccount:()=>cachedAccount,clear(){token='';cachedAccount=null;cachedSession=null;target.dispatchEvent({type:'novaesweb:account-change',detail:{message:'Sessão expirada.'}});}},
    offlineQueue:{getIsOnline:()=>options.online!==false,getPendingCount:()=>0,subscribe:()=>()=>{}},
    realtimeWatcher:{onUpdate:()=>()=>{},connect:async()=>{},disconnect:async()=>{}},
    setRealtimeToken(){},
    routeEstimate:{estimate:async()=>null},
    trackingService:{stop(){},start(){},getState:()=>({isActive:false})},
    audioAlert:{stopOfferAlert(){},init(){},playClickSound(){}},pushService:{initializeNative:async()=>{}},
    startupSound:{play(){calls.audioStarts++;return ()=>{calls.audioStops++;};},getEnabled:()=>false},
    triggerOfferNotification(){},requestScreenWakeLock(){},releaseScreenWakeLock(){},deliveryTrackingDecision:()=>({canFinishRoute:false}),
    publishNotice(notice){calls.notices.push(notice);},clearNotices(){calls.noticesCleared++;},removeNotice(id){calls.noticesRemoved.push(id);},
  };
  for(const block of original.matchAll(/import\s+\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    if(!block[2].includes('/components/')&&block[2]!=='lucide-react')continue;
    for(const entry of block[1].split(',')){
      const name=entry.trim().split(/\s+as\s+/).at(-1);if(!/^[A-Za-z_$][\w$]*$/.test(name))continue;
      const component=()=>null;component.displayName=name;context[name]=component;
    }
  }
  context.useExperiencePreferences=()=>({preferences:{theme:'dark',textScale:'normal',outdoor:false,focus:false,haptics:true,reducedMotion:false},updatePreferences(){}});
  context.transitionDelivery=change=>change();
  vm.runInNewContext(compiled.code+';exports.App=App;',context);
  function render(){
    if(!mounted)return view;
    for(let pass=0;pass<20;pass++){
      dirty=false;cursor=0;view=context.exports.App();while(effects.length)effects.shift()();if(!dirty)return view;
    }
    throw Error('App did not settle after effect/state processing');
  }
  const h={calls,syncCalls,render,context,
    has(name){return nodes(view).some(node=>node.type?.displayName===name);},
    component(name){return nodes(view).find(node=>node.type?.displayName===name);},
    content:()=>text(view),
    async settle(){await tick();render();await tick();return render();},
    async advance(milliseconds){const end=clock+milliseconds;for(let guard=0;guard<1000;guard++){const ready=[...timers.entries()].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!ready)break;const[id,timer]=ready;clock=timer.at;if(timer.interval)timer.at+=timer.delay;else timers.delete(id);timer.callback();render();await tick();render();}clock=end;return render();},
    async validate(result={account:accountFixture,session:sessionFixture}){syncResolve(result);return h.settle();},
    async fail(error=Error('Network unavailable'),expired=false){if(expired){token='';cachedAccount=null;cachedSession=null;target.dispatchEvent({type:'novaesweb:account-change',detail:{message:'Sessão expirada.'}});}syncReject(error);return h.settle();},
    async emit(type){target.dispatchEvent({type});return h.settle();},
    nextSync(operation){syncOperation=operation;},
    async confirmOffer(response={success:true}){respondResolve(response);return h.settle();},
    click(label){const button=nodes(view).find(node=>node.type==='button'&&text(node).trim()===label);assert(button,`Button ${label} exists`);button.props.onClick();return render();},
    unmount(){mounted=false;for(const slot of slots)slot?.cleanup?.();effects.length=0;timers.clear();},
  };
  render();return h;
}

test('first launch stays in splash for animation, then opens login without authenticated calls',async t=>{
  const h=await harness();t.after(h.unmount);
  assert(h.has('StartupSplash'));assert(!h.has('ScreenAuthDriver'));assert.equal(h.syncCalls.length,0);
  await h.advance(2999);assert(h.has('StartupSplash'));
  await h.advance(1);assert(h.has('ScreenAuthDriver'));assert(!h.has('StartupSplash'));
});

test('cached account validates during animation and never exposes protected dashboard until validation',async t=>{
  const h=await harness({account:accountFixture,session:sessionFixture});t.after(h.unmount);
  assert.equal(h.syncCalls.length,1);assert.equal(h.syncCalls[0].at,0);assert(h.has('StartupSplash'));assert(!h.has('ScreenDashboard'));
  await h.advance(3000);assert(!h.has('ScreenDashboard'));assert(!h.has('ScreenStoreConnect'));
  await h.validate();assert(h.has('ScreenDashboard'));assert(!h.has('StartupSplash'));
});

test('fast session validation still waits for animation, then opens linked store dashboard',async t=>{
  const h=await harness({account:accountFixture});t.after(h.unmount);
  await h.validate();assert(h.has('StartupSplash'));assert(!h.has('ScreenDashboard'));
  await h.advance(3000);assert(h.has('ScreenDashboard'));
});

test('validated account without active store preserves existing store-code flow and ledger',async t=>{
  const h=await harness({account:accountFixture,stores:[{storeId:'A'},{storeId:'B'}]});t.after(h.unmount);
  await h.validate({account:accountFixture,session:null});await h.advance(3000);
  assert(h.has('ScreenStoreConnect'));assert(!h.has('ScreenDashboard'));
  assert.equal(h.component('ScreenStoreConnect').props.account.id,accountFixture.id);
});

test('multiple linked stores do not override the existing server-selected active store',async t=>{
  const h=await harness({account:accountFixture,stores:[{storeId:'A'},{storeId:'B'}]});t.after(h.unmount);
  const selected={...sessionFixture,storeId:'store-B',storeName:'Loja B'};
  await h.validate({account:accountFixture,session:selected});await h.advance(3000);
  assert(h.has('ScreenDashboard'));assert.equal(h.component('ScreenDashboard').props.session.storeId,'store-B');
});

test('expired session redirects to login after server invalidation, not cached store data',async t=>{
  const h=await harness({account:accountFixture,session:sessionFixture});t.after(h.unmount);
  await h.fail(Object.assign(Error('Expired'),{status:401}),true);await h.advance(3000);
  assert(h.has('ScreenAuthDriver'));assert(!h.has('ScreenDashboard'));assert(!h.has('ScreenStoreConnect'));
});

test('a direct unauthorized bootstrap result also invalidates the cached account',async t=>{
  const h=await harness({account:accountFixture,session:sessionFixture});t.after(h.unmount);
  await h.fail(Object.assign(Error('Expired'),{status:401}));await h.advance(3000);
  assert(h.has('ScreenAuthDriver'));assert(!h.has('ScreenDashboard'));assert(!h.has('ScreenStoreConnect'));
});

test('offline validation failure retains loading/retry without showing cached protected information',async t=>{
  const h=await harness({account:accountFixture,session:sessionFixture});t.after(h.unmount);
  await h.fail();await h.advance(3000);
  assert(!h.has('ScreenDashboard'));assert(!h.has('ScreenStoreConnect'));assert.match(h.content(),/sincronizar|conexão|internet|Sincronizando/i);
  assert(nodes(h.render()).some(node=>node.type==='button'&&/Tentar novamente/.test(text(node))));
});

test('navigation and foreground return do not restart splash or opening audio',async t=>{
  const h=await harness({account:accountFixture});t.after(h.unmount);
  await h.validate();await h.advance(3000);assert(h.has('ScreenDashboard'));
  const starts=h.calls.audioStarts;
  h.component('GlassBottomNav').props.onNavigate('history');await h.settle();assert(h.has('ScreenHistory'));assert(!h.has('StartupSplash'));
  h.nextSync(async()=>({account:accountFixture,session:sessionFixture}));await h.emit('focus');
  assert(h.has('ScreenHistory'));assert(!h.has('StartupSplash'));assert.equal(h.calls.audioStarts,starts);
});

const offerFixture = id => ({offerId:id,id,orderNumber:id,storeId:'store-A',storeName:'Loja A',expiresAt:'2026-11-03T12:01:00Z',createdAt:'2026-11-03T12:00:00Z'});

test('capsule integration: simultaneous offers keep real expiry and tap opens matching offer without accepting',async t=>{
  const first=offerFixture('offer-A'),second=offerFixture('offer-B');
  const h=await harness({account:accountFixture,manualEnabled:true,offers:[first,second]});t.after(h.unmount);
  await h.validate();await h.advance(3000);
  const notices=h.calls.notices.filter(notice=>notice.kind==='offer');
  assert.deepEqual(notices.map(notice=>notice.id),['offer:offer-A','offer:offer-B']);
  assert.equal(notices[0].expiresAt,first.expiresAt);assert.equal(notices[1].expiresAt,second.expiresAt);
  assert.equal(h.calls.offersResponded.length,0);
  notices[1].onOpen();h.render();
  assert.equal(h.component('ModalOfferReceived').props.offer.offerId,'offer-B');
  assert.equal(h.calls.offersResponded.length,0,'opening an offer never accepts or rejects it');
});

test('capsule integration: acceptance success is published only after backend acknowledgement',async t=>{
  const offer=offerFixture('offer-A');
  const h=await harness({account:accountFixture,manualEnabled:true,offers:[offer]});t.after(h.unmount);
  await h.validate();await h.advance(3000);
  const accepted=h.component('ModalOfferReceived').props.onAccept(offer.offerId);
  await h.settle();
  assert.equal(h.calls.offersResponded.length,1);assert.equal(h.calls.offersResponded[0].response,'accepted');
  assert(!h.calls.notices.some(notice=>notice.kind==='success'));
  await h.confirmOffer();await accepted;h.render();
  assert(h.calls.notices.some(notice=>notice.kind==='success'&&notice.id==='offer:offer-A:accepted'&&/aceita/i.test(notice.title)));
  assert(h.calls.noticesRemoved.includes('offer:offer-A'));
});

test('capsule integration: offline delivery is pending validation and never announced as delivered success',async t=>{
  const assignment={assignmentId:'assignment-A',id:'assignment-A',storeId:'store-A',orderNumber:'101',status:'picked_up',deliveryFee:8};
  const h=await harness({account:accountFixture,assignments:[assignment]});t.after(h.unmount);
  await h.validate();await h.advance(3000);
  h.component('ScreenDashboard').props.onNavigateToRoute();h.render();
  h.component('ScreenRoute').props.onSelectDelivery(assignment);h.render();
  h.component('ScreenActiveDelivery').props.onOpenPinConfirmation(assignment);h.render();
  await h.component('ScreenPinConfirm').props.onDeliverySuccess('Saved locally',true);await h.settle();
  assert(h.calls.notices.some(notice=>notice.kind==='info'&&/Pendente de validação online/i.test(notice.message)));
  assert(!h.calls.notices.some(notice=>notice.kind==='success'));
  assert(!h.has('ModalRouteCompleted'));
});

