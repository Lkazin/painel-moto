const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const { stripTypeScriptTypes } = require('node:module');
function helperModule() {
  const source=stripTypeScriptTypes(fs.readFileSync('src/services/pickupRouteState.ts','utf8').replace(/import[\s\S]*?from '[^']+';/g,'')).replaceAll('export function','function');
  const context={exports:{}};vm.runInNewContext(source+';Object.assign(exports,{assignmentKey,waitingPickupAssignments,activeRouteAssignments,keepPickupSelection,reconcileRouteStops,mapOptimizedStops});',context);return context.exports;
}
const helpers=helperModule();
function assignment(id,status='waiting_pickup',sequence=1){return {assignmentId:id,orderNumber:'#'+id,orderId:'order-'+id,storeId:'store',storeName:'Loja',customerName:'Cliente '+id,phone:'',address:'Rua Teste',addressNumber:'10',neighborhood:'Centro',city:'Canoas',itemsSummary:'Pedido',status,sequence,deliveryFee:8,acceptedAt:'2026-11-01T12:00:00Z',createdAt:'2026-11-01T11:00:00Z'};}
function routeResult(mode,ids){return {success:true,mode,stops:ids.map((id,index)=>({assignmentId:id,sequence:index+1})),totalDistanceMeters:4200,totalDurationSeconds:720,rule:'Regra calculada pelo servidor',source:'osrm',origin:{latitude:-29.9,longitude:-51.1}};}
function walk(node,predicate,result=[]){if(!node||typeof node!=='object')return result;if(predicate(node))result.push(node);for(const child of [node.props?.children].flat(Infinity))walk(child,predicate,result);return result;}
function nodeText(node){if(node==null||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);return [node.props?.children].flat(Infinity).map(nodeText).join(' ');}
async function component(name,props,api={}){
  const {transformSync}=await import('rolldown/utils');
  let slots=[],index=0,pending=[],dirty=false;
  const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(initial){const key=index++;if(!(key in slots))slots[key]=typeof initial==='function'?initial():initial;return [slots[key],value=>{slots[key]=typeof value==='function'?value(slots[key]):value;dirty=true;}];},useRef(initial){const key=index++;return slots[key]||(slots[key]={current:initial});},useEffect(effect,deps){const key=index++,old=slots[key];if(!old||deps.some((dep,i)=>!Object.is(dep,old.deps[i]))){pending.push(()=>{old?.cleanup?.();slots[key]={deps,cleanup:effect()};});}}};
  const source=fs.readFileSync('src/components/'+name+'.tsx','utf8').replace(/import[\s\S]*?from '[^']+';/g,'').replaceAll('export const','const');
  const transformed=transformSync(name+'.tsx',source,{jsx:{runtime:'classic'},tsconfig:false});
  assert.equal(transformed.errors.length,0);
  const icons=new Proxy({}, {get:()=>()=>null});
  const context={React:react,...react,exports:{},...helpers,api,audioAlert:{playClickSound(){},playSuccessSound(){},playErrorSound(){}},trackingService:{getState:()=>({isActive:false,lastLocation:null})},TrackingBadge:()=>null,console,Date,window:{open(){}}};
  for(const name of ['PackageCheck','Package','CheckSquare','Square','AlertTriangle','ArrowRight','Clock','MapPin','ChevronRight','Layers','Store','Navigation','ArrowUp','ArrowDown','GripVertical','CheckCircle','ShieldAlert','AlertCircle','Sparkles','Compass','MessageCircle','Map'])context[name]=icons[name];
  vm.runInNewContext(transformed.code+';exports.Component='+name+';',context);
  let currentProps=props,tree;
  function render(nextProps){if(nextProps)currentProps=nextProps;let rounds=0;do{dirty=false;index=0;pending=[];tree=context.exports.Component(currentProps);for(const effect of pending)effect();if(++rounds>10)throw new Error('Render loop');}while(dirty);return tree;}
  return {render,find:(predicate)=>walk(tree,predicate),text:()=>nodeText(tree),async settle(){await new Promise(setImmediate);return render();}};
}
test('balcão começa sem seleção, polling não remarca pedidos e retirada parcial envia snapshot explícito',async()=>{
  const a=assignment('A'),b=assignment('B'),c=assignment('C');const calls=[];
  const view=await component('ScreenOrdersPickup',{assignments:[a,b],onConfirmPickup:async(...args)=>calls.push(args),onRequestWithdraw(){},onNavigateToRoute(){}});
  view.render();const confirm=()=>view.find(node=>node.type==='button'&&nodeText(node).includes('Selecione os pedidos'))[0];assert.equal(confirm().props.disabled,true);
  view.find(node=>node.type==='input'&&node.props.type==='checkbox')[0].props.onChange();view.render();
  view.render({assignments:[{...a},{...b},c],onConfirmPickup:async(...args)=>calls.push(args),onRequestWithdraw(){},onNavigateToRoute(){}});
  const inputs=view.find(node=>node.type==='input'&&node.props.type==='checkbox');assert.deepEqual(inputs.map(node=>node.props.checked),[true,false,false]);
  view.find(node=>node.type==='button'&&nodeText(node).includes('Retirar 1 pedido'))[0].props.onClick();view.render();
  assert.match(view.text(),/2 pedido\(s\) não selecionado\(s\) serão devolvidos/);
  view.find(node=>node.type==='button'&&nodeText(node).includes('Confirmar estes pedidos'))[0].props.onClick();await view.settle();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[[['A'],['A','B','C']]]);
});
test('ordem manual e draft sobrevivem polling, removem concluídas e acrescentam novas retiradas',()=>{
  const a=assignment('A','picked_up',1),b=assignment('B','in_transit',2),c=assignment('C','picked_up',3),waiting=assignment('WAIT');
  let draft=helpers.reconcileRouteStops([b,a],[{...a},{...b},waiting],true);assert.equal(draft.map(helpers.assignmentKey).join(','),'B,A');
  draft=helpers.reconcileRouteStops(draft,[{...a,status:'delivered'},b,c,waiting],true);assert.equal(draft.map(helpers.assignmentKey).join(','),'B,C');
  assert.equal(helpers.activeRouteAssignments([a,b,waiting]).length,2);
  assert.throws(()=>helpers.mapOptimizedStops(routeResult('shortest_distance',['A','WAIT']),[a,b,waiting]),/mudaram/);
});
test('API de retirada exige seleção e transmite todos os IDs visíveis sem limite de quatro',async()=>{
  const calls=[],account={id:'account'},session={token:'shift-token',driverId:'driver',membershipId:'membership',storeId:'store'};
  class AccountRequestError extends Error{}
  const accountClient={getAccount:()=>account,getToken:()=> 'account-token',subscribe(){},validate:async()=>account,request:async(url,options)=>{calls.push({url,options});if(url.endsWith('account-bootstrap'))return {account,session,ledger:[]};return {success:true,confirmed:['A'],released:['B','C','D','E','F'],errors:{}};}};
  const source=stripTypeScriptTypes(fs.readFileSync('src/services/api.ts','utf8').replace(/import[\s\S]*?from '[^']+';/g,'')).replaceAll('export class','class').replaceAll('export const','const');
  const context={exports:{},accountClient,AccountRequestError,offlineQueue:{clearQueue(){},setContext(){},getIsOnline:()=>true},logisticsApiUrl:()=> 'https://loja.test/api/v1/logistics',localStorage:{getItem:()=>null,setItem(){},removeItem(){}},window:{dispatchEvent(){}},CustomEvent:class{},URLSearchParams,console,Date};
  vm.runInNewContext(source+';exports.api=api;',context);const api=context.exports.api;await api.synchronizeAccount();await assert.rejects(api.confirmPickup([],['A']),/Selecione/);
  const result=await api.confirmPickup(['A'],['A','B','C','D','E','F']);const body=JSON.parse(calls.at(-1).options.body);assert.deepEqual(body.assignmentIds,['A']);assert.equal(body.pickupScopeIds.length,6);assert.equal(result.released.length,5);
});
test('duas regras usam servidor, aceitam mais de quatro paradas e sugestão só é salva ao escolher',async()=>{
  const picked=Array.from({length:6},(_,i)=>assignment(String(i+1),'picked_up',i+1));const modes=[],saved=[];
  const view=await component('ScreenRoute',{assignments:[...picked,assignment('WAIT')],onReorder:async value=>saved.push(value),onSelectDelivery(){},onNavigateToOrders(){}},{getOptimizeRoute:async mode=>{modes.push(mode);return routeResult(mode,picked.map(helpers.assignmentKey).reverse());}});
  view.render();view.find(node=>node.type==='button'&&nodeText(node).includes('Menor distância'))[0].props.onClick();view.render();assert.match(view.text(),/Calculando a melhor rota/);await view.settle();assert.match(view.text(),/4,2 km/);assert.equal(saved.length,0);
  view.find(node=>node.type==='button'&&nodeText(node).includes('Maior espera primeiro'))[0].props.onClick();await view.settle();assert.deepEqual(modes,['shortest_distance','oldest_wait']);
  view.find(node=>node.type==='button'&&nodeText(node).includes('Salvar Ordem'))[0].props.onClick();await view.settle();assert.equal(saved[0].length,6);assert.equal(saved[0][0].assignmentId,'6');assert.equal(saved[0].some(stop=>stop.assignmentId==='WAIT'),false);
});
test('falha do provedor mantém rota manual, sem distância inventada e com Maps/Waze disponíveis',async()=>{
  const picked=[assignment('A','picked_up',1),assignment('B','picked_up',2)],saved=[];
  const view=await component('ScreenRoute',{assignments:picked,onReorder:async value=>saved.push(value),onSelectDelivery(){},onNavigateToOrders(){}},{getOptimizeRoute:async()=>{throw new Error('Serviço indisponível');}});
  view.render();view.find(node=>node.type==='button'&&nodeText(node).includes('Menor distância'))[0].props.onClick();await view.settle();assert.match(view.text(),/Serviço indisponível/);assert.match(view.text(),/Maps/);assert.match(view.text(),/Waze/);assert.doesNotMatch(view.text(),/km de percurso/);
  view.find(node=>node.type==='button'&&node.props['aria-label']==='Descer posição')[0].props.onClick();view.render();view.render({assignments:picked.map(item=>({...item})),onReorder:async value=>saved.push(value),onSelectDelivery(){},onNavigateToOrders(){}});
  view.find(node=>node.type==='button'&&nodeText(node).includes('Salvar Ordem'))[0].props.onClick();await view.settle();assert.equal(saved[0][0].assignmentId,'B');
});
