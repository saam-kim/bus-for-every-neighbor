import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as data from '../dist/data.js';
import * as engine from '../dist/engine.js';
import {completedProgress,createSyncQueue} from '../dist/classroom-sync.js';

const state={scenario:data.SCENARIO.id,design:structuredClone(data.DEFAULT_DESIGN),attempts:[],reflections:['  ','','']};
assert.equal(completedProgress(state,'design').results,null);
assert.equal(completedProgress(state,'reflection').reflectionDone,0);
const first={scenario:data.SCENARIO.id,design:structuredClone(state.design),results:engine.evaluate(state.design).results};
state.attempts.push(first);
state.design.buses[0].departure+=30;
assert.deepEqual(completedProgress(state,'design').results,first.results);
assert.deepEqual(completedProgress(state,'design').design,first.design);
console.log('PASS teacher results include completed runs only');

let writes=0,release;
const queue=createSyncQueue(async()=>{writes++;await new Promise(resolve=>release=resolve);},()=>{},10000);
queue.enqueue({edit:1});const pending=queue.flush();
queue.enqueue({edit:2});queue.enqueue({edit:3});
assert.equal(writes,1);
release();await pending;
const final=queue.flush();release();await final;
queue.enqueue({edit:3});await queue.flush();
assert.equal(writes,2);
console.log('PASS sync coalesces, serializes, and deduplicates writes');
let failed=true,status=[];
const retry=createSyncQueue(async()=>{if(failed)throw Error('offline');},ok=>status.push(ok),10000);
retry.enqueue({answer:'saved locally'});await retry.flush();failed=false;await retry.flush();
assert.deepEqual(status,[false,true]);
console.log('PASS failed save retries and reports recovery');

const listeners={},storage=new Map();let renders=0;
const app={set innerHTML(v){renders++;this.html=v;},get innerHTML(){return this.html;}};
const room={code:'audit',teamName:'검토',control:{status:'active',phase:1},storageKey:'audit',sync(){}};
function harness(){
 const context=vm.createContext({...data,...engine,window:{BUS_CLASSROOM:room,addEventListener(n,f){listeners[n]=f;}},document:{querySelector(s){return s==='#app'?app:null;},querySelectorAll(){return [];},activeElement:null},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},AbortController,console});
 vm.runInContext(fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''),context);
 return expression=>vm.runInContext(expression,context);
}
let run=harness();run("state.introSeen=true;modal=null;action('run');");
const priorRenders=renders;
listeners['classroom-state']();
assert.equal(run('playing'),true);assert.equal(renders,priorRenders);
room.control={status:'paused',phase:1};listeners['classroom-state']();assert.equal(run('playing'),false);
room.control={status:'active',phase:1};listeners['classroom-state']();assert.equal(run('playing'),true);
console.log('PASS classroom updates retain animation; teacher pause/resume still works');
run("action('results');");assert.equal(run('state.attempts.length'),1);
run("action('finish');");assert.equal(run('state.attempts.length'),1);
run("action('redesign');action('run');playTime=600;updateAnimation();");
assert.equal(run('state.attempts.length'),2);
run=harness();assert.equal(run('state.attempts.length'),2);
console.log('PASS both result buttons, automatic completion, and reload preserve attempts without duplicates');

// Test each insertion position and missing stop, for every ordered three-stop
// route on both buses (1,260 distinct route-editing situations).
run("mode='design';modal=null;render=()=>{};");
let insertions=0;
for(let bus=0;bus<2;bus++){
 const origin=data.BUS_STARTS[bus],others=data.STOPS.map(s=>s.id).filter(id=>id!==origin);
 for(const x of others)for(const y of others){if(x===y)continue;
  const route=[origin,x,y];
  for(let anchor=0;anchor<route.length;anchor++)for(const id of others.filter(id=>!route.includes(id))){
   const design=structuredClone(data.DEFAULT_DESIGN);design.buses[bus].route=route;
   run(`state.design=${JSON.stringify(design)};selectedBus=${bus};selectedChip=${anchor};action('stop',{id:'${id}'});`);
   const expected=[...route];expected.splice(anchor+1,0,id);
   assert.deepEqual(JSON.parse(run('JSON.stringify(state.design.buses[selectedBus].route)')),expected);
   assert.equal(run('selectedChip'),anchor+1);assert.equal(run('validateDesign(state.design)'),true);insertions++;
  }
 }
}
assert.equal(insertions,1260);console.log('PASS all 1,260 route insertion contexts');

run(`state.design=${JSON.stringify(data.DEFAULT_DESIGN)};state.design.buses[0].route=['A','T','E','M'];selectedBus=0;selectedChip=2;undo=[];busSelections=[null,null];`);
run('mutate(()=>state.design.buses[0].departure=440);');assert.equal(run('insertionName()'),'다리 남단');
run("action('bus',{id:'1'});action('stop',{id:'H'});action('bus',{id:'0'});");assert.equal(run('insertionName()'),'다리 남단');
run('moveChip(2,1);');assert.equal(run('selectedChip'),1);assert.equal(run('insertionName()'),'다리 남단');
run("action('remove',{index:'2'});");assert.equal(run('insertionName()'),'다리 남단');
run("action('remove',{index:'1'});");assert.equal(run('insertionName()'),'아파트');
run("action('undo');");assert.equal(run('insertionName()'),'다리 남단');
run("action('stop',{id:'F'});");assert.deepEqual(JSON.parse(run('JSON.stringify(state.design.buses[0].route)')),['A','E','F','M']);
run("action('bus',{id:'1'});action('undo');");assert.equal(run('selectedBus'),0);assert.equal(run('insertionName()'),'다리 남단');
console.log('PASS cursor survives time changes, bus switch, reorder, delete and cross-bus undo');

const legacy={...state,scenario:'morning-v3',attempts:[{...first,scenario:'morning-v3'}],reflections:['이전 답변','','']};
storage.set('audit',JSON.stringify(legacy));run=harness();
assert.equal(run('state.attempts.length'),0);assert.equal(run('state.previousRecords.length'),1);
assert.equal(run('state.previousRecords[0].reflections[0]'),'이전 답변');
assert.deepEqual(JSON.parse(run('JSON.stringify(state.previousRecords[0].attempts[0].results)')),first.results);
assert.equal(completedProgress(legacy,'results').attempts,0);
run=harness();assert.equal(run('state.previousRecords.length'),1);
console.log('PASS previous-road records remain unchanged, separate, and are not duplicated on reload');
