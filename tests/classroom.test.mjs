import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as data from '../dist/data.js';
import * as engine from '../dist/engine.js';
import {completedProgress,createSyncQueue} from '../dist/classroom-sync.js';

const state={design:structuredClone(data.DEFAULT_DESIGN),attempts:[],reflections:['  ','','']};
assert.equal(completedProgress(state,'design').results,null);
assert.equal(completedProgress(state,'reflection').reflectionDone,0);
const first={design:structuredClone(state.design),results:engine.evaluate(state.design).results};
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
