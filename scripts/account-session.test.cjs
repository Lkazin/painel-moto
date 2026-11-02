const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const { stripTypeScriptTypes } = require('node:module');
const BASE = 'https://entregado001-oe6y.vercel.app/api/v1/logistics';
function server(){
  let sequence=0;const accounts=new Map(),tokens=new Map(),challenges=new Map(),calls=[];let unavailable=false;
  function response(status,data){return {ok:status>=200&&status<300,status,json:async()=>data};}
  const shift = account => ({token:'drv_v1.signed-test-session',driverId:account.id,driverName:account.name,phone:account.phone,storeId:'store-A',storeName:'Loja Teste',membershipId:'membership-A',role:'entregador_plantao',expiresAt:'2099-01-01',isActivated:true,deviceFingerprint:'test'});
  return {calls,setUnavailable(value){unavailable=value;},async fetch(url,options={}){
    if(unavailable)throw new TypeError('Network unavailable');
    const body=options.body?JSON.parse(options.body):{};const headers=new Headers(options.headers);calls.push({url,body,headers});
    const action=new URL(url).pathname.split('/').at(-1);
    if(action==='start'){
      if(body.phone!=='11999999999'||body.code!=='AC-123456ABCDEF')return response(404,{success:false,error:'Telefone ou código de primeiro acesso inválidos.'});
      const challenge={onboardingToken:'onboarding-'+(++sequence),name:'Entregador Teste',phone:body.phone,storeName:'Loja Teste',expiresAt:new Date(Date.now()+15*60000).toISOString()};
      challenges.set(challenge.onboardingToken,challenge);return response(200,{success:true,...challenge});
    }
    if(action==='complete'){
      const challenge=challenges.get(body.onboardingToken);
      if(!challenge)return response(403,{success:false,error:'Autorização inválida ou expirada.'});
      if(!body.address||body.address.length<8||!body.vehicleModel||body.password?.length<8)return response(400,{success:false,error:'Complete seus dados.'});
      const account={id:'account-'+challenge.phone,name:challenge.name,phone:challenge.phone,vehiclePlate:body.vehiclePlate||'',vehicleModel:body.vehicleModel,address:body.address,createdAt:'2026-11-01'};
      const token='account-session-'+(++sequence),entry={account,password:body.password,active:token,session:shift(account)};
      accounts.set(challenge.phone,entry);tokens.set(token,entry);challenges.delete(body.onboardingToken);
      return response(200,{success:true,account,accountToken:token});
    }
    if(action==='register'||action==='verify-code')return response(403,{success:false,error:'Utilize Primeiro acesso.'});
    if(action==='login'){
      const entry=accounts.get(body.identifier);
      if(!entry||entry.password!==body.password)return response(401,{success:false,error:'Telefone ou senha incorretos.'});
      const token='account-session-'+(++sequence);entry.active=token;tokens.set(token,entry);return response(200,{success:true,account:entry.account,accountToken:token});
    }
    const token=headers.get('x-account-session'),entry=tokens.get(token);
    if(!entry||entry.active!==token)return response(401,{success:false,code:'ACCOUNT_SESSION_REPLACED'});
    if(action==='logout'){entry.active='';return response(200,{success:true});}
    if(action==='me')return response(200,{success:true,account:entry.account});
    if(action==='account-bootstrap')return response(200,{success:true,account:entry.account,session:entry.session,ledger:[{storeId:'store-A',storeName:'Loja Teste',completedCount:2,canceledCount:0,totalToReceive:16,lastShiftDate:'2026-11-01'}]});
    if(action==='invite-activate'){
      if(body.inviteCode!=='NW-123456')return response(404,{success:false,error:'Código inválido'});
      entry.session=shift(entry.account);return response(200,{success:true});
    }
    if(action==='delivery-confirm')return response(200,{success:true,message:'Entrega confirmada'});
    return response(200,{success:true});
  }};
}
function browser(server, memory = new Map()) {
  let online = true; const modules = {}; const events = [];
  const storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  function load(file) {
    if (modules[file]) return modules[file];
    let source = fs.readFileSync('src/services/' + file + '.ts', 'utf8').replace(/import \{[\s\S]*?\} from '..\/types';/g, '');
    source = stripTypeScriptTypes(source).replace(/import \{([^}]+)\} from '(.+)';/g, (_all, names, path) => 'const {' + names + '}=require(' + JSON.stringify(path) + ');').replaceAll('export class ', 'class ').replaceAll('export const ', 'const ');
    const exported = file === 'accountClient' ? 'accountClient,AccountRequestError,ACCOUNT_REPLACED_MESSAGE' : file === 'api' ? 'api,ApiClient' : 'offlineQueue';
    source += ';Object.assign(exports,{' + exported + '});';
    const context = { exports: {}, console, Date, URL, URLSearchParams, Headers, AbortController, crypto: require('node:crypto').webcrypto, localStorage: storage, navigator: { get onLine() { return online; } }, window: { addEventListener() { }, dispatchEvent(event) { events.push(event); } }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }, fetch: server.fetch.bind(server), require: name => name === './nativeTracking' ? { supportsBackgroundTracking: () => false } : name === './logisticsConfig' ? { logisticsApiUrl: () => BASE } : load(name.replace('./', '')) };
    vm.runInNewContext(source, context, { filename: file + '.ts' }); return modules[file] = context.exports;
  }
  return { api: load('api').api, account: load('accountClient').accountClient, queue: load('offlineQueue').offlineQueue, memory, events, setOnline(value) { online = value; } };
}
const firstAccess=async b=>{const challenge=await b.api.startFirstAccess('11999999999','AC-123456ABCDEF');return b.api.completeFirstAccess({onboardingToken:challenge.onboardingToken,password:'SenhaSegura123',address:'Rua Teste, 100, Centro, Canoas RS',vehicleModel:'Honda CG 160'});};
test('cadastro central, senha errada rejeitada e dados recuperados em outro aparelho', async () => {
  const backend = server(), phone = browser(backend); await firstAccess(phone); await phone.api.activateStoreShift('nw-123456');
  const computer = browser(backend); await assert.rejects(computer.api.loginDriver('11999999999', 'errada'), /incorretos/); assert.equal(computer.api.getDriverAccount(), null);
  await computer.api.loginDriver('11999999999', 'SenhaSegura123'); assert.equal(computer.api.getDriverAccount().id, phone.api.getDriverAccount().id); assert.equal(computer.api.getSession().membershipId, 'membership-A'); assert.equal(computer.api.getStoresLedger()[0].totalToReceive, 16);
  await assert.rejects(phone.api.synchronizeAccount(), /outro aparelho/); assert.equal(phone.api.getDriverAccount(), null); assert.equal(phone.api.getSession(), null); assert.equal(phone.queue.getQueue().length, 0);
});
test('recarregar valida a conta antes de restaurar plantão e falha de rede não faz logout', async () => {
  const backend = server(), first = browser(backend); await firstAccess(first); await first.api.activateStoreShift('NW-123456');
  const reloaded = browser(backend, first.memory); assert.equal(reloaded.api.getSession(), null); await reloaded.api.synchronizeAccount(); assert.equal(reloaded.api.getSession().storeId, 'store-A');
  backend.setUnavailable(true); await assert.rejects(reloaded.api.synchronizeAccount(), /Network/); assert.ok(reloaded.api.getDriverAccount());
});
test('fila offline usa sessão original e sessão substituída não sincroniza confirmação', async () => {
  const backend = server(), first = browser(backend); await firstAccess(first); await first.api.activateStoreShift('NW-123456'); first.setOnline(false);
  const result = await first.api.confirmDelivery('assignment-A', '1234'); assert.equal(result.isOfflinePending, true); assert.equal(first.queue.getQueue()[0].accountToken, first.account.getToken());
  const second = browser(backend); await second.api.loginDriver('11999999999', 'SenhaSegura123'); first.setOnline(true);
  await assert.rejects(first.api.flushOfflineQueue(), /outro aparelho/); assert.equal(first.queue.getQueue().length, 0); assert.equal(backend.calls.filter(call => call.url.endsWith('/delivery-confirm')).length, 0);
});
test('código inválido não cria sessão e logout não encerra plantão no servidor', async () => {
  const backend = server(), first = browser(backend); await firstAccess(first); await assert.rejects(first.api.activateStoreShift('NW-INVALID'), /inválido/); assert.equal(first.api.getSession().storeId, 'store-A');
  await first.api.activateStoreShift('NW-123456'); await first.api.logoutDriver(); assert.equal(first.api.getDriverAccount(), null); assert.equal(backend.calls.some(call => call.url.endsWith('/shift-close')), false);
  await first.api.loginDriver('11999999999', 'SenhaSegura123'); assert.equal(first.api.getSession().storeId, 'store-A');
});

test('resposta atrasada de sessão antiga não desconecta o novo login', async () => {
  const backend = server(); const original = backend.fetch.bind(backend); let finish;
  backend.fetch = (url, options) => url.endsWith('/delayed') ? new Promise(resolve => { finish = resolve; }) : original(url, options);
  const first = browser(backend); await firstAccess(first);
  const pending = first.account.request(BASE + '/delayed'); await first.api.logoutDriver(); await first.api.loginDriver('11999999999', 'SenhaSegura123');
  finish({ ok: false, status: 401, json: async () => ({ success: false, code: 'ACCOUNT_SESSION_REPLACED' }) });
  await assert.rejects(pending, error => error.code === 'STALE_REQUEST'); assert.ok(first.api.getDriverAccount()); assert.ok(first.account.getToken());
});

test('primeiro acesso não autentica nem persiste autorização antes de completar os dados',async()=>{
  const backend=server(),first=browser(backend);
  await assert.rejects(first.api.startFirstAccess('11999999999','NW-123456'),/primeiro acesso inválidos/);
  const challenge=await first.api.startFirstAccess('11999999999','AC-123456ABCDEF');
  assert.equal(challenge.name,'Entregador Teste');assert.equal(challenge.storeName,'Loja Teste');
  assert.equal(first.api.getDriverAccount(),null);assert.equal(first.api.getSession(),null);assert.equal(first.account.getToken(),'');assert.equal(first.events.length,0);
  assert.equal([...first.memory.values()].some(value=>String(value).includes(challenge.onboardingToken)),false);
  const reloaded=browser(backend,first.memory);
  await assert.rejects(reloaded.api.completeFirstAccess({onboardingToken:challenge.onboardingToken,password:'SenhaSegura123',address:'Rua Teste, 100',vehicleModel:'CG 160'}),/expirou/);
  const account=await first.api.completeFirstAccess({onboardingToken:challenge.onboardingToken,password:'SenhaSegura123',address:'Rua Teste, 100',vehicleModel:'CG 160'});
  assert.equal(account.name,'Entregador Teste');assert.equal(account.address,'Rua Teste, 100');assert.equal(account.vehiclePlate,'');
  assert.equal(first.api.getSession().storeId,'store-A');
  const start=backend.calls.find(call=>call.url.endsWith('/start')&&call.body.code.startsWith('AC-'));
  assert.equal(start.body.phone,'11999999999');assert.equal(start.body.code,'AC-123456ABCDEF');
  const complete=backend.calls.find(call=>call.url.endsWith('/complete'));
  assert.equal(complete.body.onboardingToken,challenge.onboardingToken);assert.equal(complete.body.name,undefined);assert.equal(complete.body.phone,undefined);
  assert.equal(backend.calls.some(call=>call.url.endsWith('/register')||call.url.endsWith('/verify-code')),false);
});
test('voltar cancela autorização e resposta atrasada do start é ignorada',async()=>{
  const backend=server();const original=backend.fetch.bind(backend);let finish;
  backend.fetch=(url,options)=>url.endsWith('/start')?new Promise(resolve=>{finish=()=>original(url,options).then(resolve);}):original(url,options);
  const first=browser(backend),pending=first.api.startFirstAccess('11999999999','AC-123456ABCDEF');first.api.cancelFirstAccess();finish();
  await assert.rejects(pending,error=>error.code==='STALE_REQUEST');assert.equal(first.api.getDriverAccount(),null);assert.equal(first.account.getToken(),'');
});
test('conclusão cancelada não instala conta nem sessão com resposta atrasada',async()=>{
  const backend=server();const original=backend.fetch.bind(backend);let finish;
  backend.fetch=(url,options)=>url.endsWith('/complete')?new Promise(resolve=>{finish=()=>original(url,options).then(resolve);}):original(url,options);
  const first=browser(backend),challenge=await first.api.startFirstAccess('11999999999','AC-123456ABCDEF');
  const pending=first.api.completeFirstAccess({onboardingToken:challenge.onboardingToken,password:'SenhaSegura123',address:'Rua Teste, 100',vehicleModel:'CG 160'});
  first.api.cancelFirstAccess();finish();await assert.rejects(pending,error=>error.code==='STALE_REQUEST');
  assert.equal(first.api.getDriverAccount(),null);assert.equal(first.api.getSession(),null);assert.equal(first.account.getToken(),'');
});

test('autorização expirada ou resposta incompleta não autentica a conta',async()=>{
  const backend=server();const original=backend.fetch.bind(backend);
  backend.fetch=async(url,options)=>{
    const response=await original(url,options);
    if(url.endsWith('/start')){const data=await response.json();return {...response,json:async()=>({...data,expiresAt:'2000-01-01T00:00:00Z'})};}
    return response;
  };
  const first=browser(backend);await assert.rejects(first.api.startFirstAccess('11999999999','AC-123456ABCDEF'),/autorização válida/);
  assert.equal(first.account.getToken(),'');assert.equal(first.api.getDriverAccount(),null);
});
