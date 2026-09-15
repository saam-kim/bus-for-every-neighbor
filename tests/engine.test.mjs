import assert from 'node:assert/strict';
import {SCENARIO,STOPS,STOP,RESIDENTS,DEFAULT_DESIGN,BUS_STARTS} from '../dist/data.js';
import {evaluate,summary,scheduleBus,busPosition,personPosition,resultFor,roadPath,validateDesign} from '../dist/engine.js';

const copy=x=>structuredClone(x);
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}

const initial=evaluate(DEFAULT_DESIGN);

check('deterministic result / 8 residents / initial baseline',()=>{
 assert.deepEqual(initial,evaluate(DEFAULT_DESIGN));
 assert.equal(initial.results.length,8);
 assert.deepEqual(summary(initial.results),{ontime:1,late:0,impossible:7,count:1,average:27});
});

check('fixed origins are part of every valid design',()=>{
 assert.deepEqual(DEFAULT_DESIGN.buses.map(b=>b.route[0]),BUS_STARTS);
 assert.equal(validateDesign(DEFAULT_DESIGN),true);
 const wrong=copy(DEFAULT_DESIGN);wrong.buses[0].route=['T','A'];
 assert.equal(validateDesign(wrong),false);
 const missing=copy(DEFAULT_DESIGN);missing.buses[1].route=[];
 assert.equal(validateDesign(missing),false);
});

check('round-trip formula includes roads, dwell and both turns',()=>{
 const s=scheduleBus({route:['A','T','E','F'],departure:450},0);
 // Roads: (9 + 6 + 9) x 2 = 48, middle stops: 4, terminals: 6.
 assert.equal(s.cycle,58);
 assert.deepEqual(s.departures,[450,508,566]);
 assert.deepEqual(s.visits.slice(0,7).map(v=>[v.stop,v.arr,v.dep]),[
  ['A',449,450],['T',459,460],['E',466,467],['F',476,479],
  ['E',488,489],['T',495,496],['A',505,508]
 ]);
});

check('Junho total equals walk + wait + ride + exit',()=>{
 const d={buses:[{route:['A','T','E','F'],departure:450},{route:['H','N'],departure:450}],lowBus:0};
 const e=evaluate(d),r=e.results.find(r=>r.id==='junho');
 assert.equal(r.arrival,480);
 assert.equal(r.walkIn,5);
 assert.equal(r.initialWait,15);
 assert.equal(r.inVehicle,26);
 assert.equal(r.walkOut,4);
 assert.equal(r.duration,50);
 assert.equal(r.duration,r.walkIn+r.initialWait+r.inVehicle+r.walkOut);
 assert.equal(r.status,'ontime');
});

check('Minseo reaches school on the fixed hill-origin bus',()=>{
 const d={buses:[{route:['A','T'],departure:450},{route:['H','N','S'],departure:450}],lowBus:0};
 const e=evaluate(d),p=RESIDENTS.find(p=>p.id==='minseo'),r=e.results.find(r=>r.id==='minseo');
 assert.equal(r.origin,'H');
 assert.equal(r.walkIn,4);
 assert.equal(r.rides[0].board,450);
 assert.equal(r.arrival,476);
 assert.equal(r.duration,36);
 assert.equal(personPosition(p,r,e.schedules,439).state,'출발 전');
});

check('arriving one minute after departure requires the next visit',()=>{
 const d={buses:[{route:['A','S'],departure:450},{route:['H','N'],departure:420}],lowBus:0};
 const p={id:'test',portrait:0,ready:448,deadline:600,maxWalk:10,low:false,access:{A:3},egress:{S:1}};
 const r=resultFor(p,d,evaluate(d).schedules);
 assert.ok(r.rides[0].board>450);
 // A → junction → N → S takes 20 minutes; round trip is 46 minutes.
 assert.equal(r.rides[0].board,496);
});

check('transfer needs two full minutes and an exact connection is allowed',()=>{
 const d={buses:[{route:['A','T','N','S'],departure:447},{route:['H','N'],departure:450}],lowBus:1};
 const p={id:'test',portrait:0,ready:450,deadline:600,maxWalk:1,low:false,access:{H:0},egress:{S:0}};
 const r=resultFor(p,d,evaluate(d).schedules);
 assert.equal(r.rides.length,2);
 assert.equal(r.rides[0].alight,464);
 assert.equal(r.rides[1].board,466);
 assert.equal(r.transferWait,2);
 const early=copy(d);early.buses[0].departure=446;
 const missed=resultFor(p,early,evaluate(early).schedules);
 assert.ok(missed.rides[1].board>465);
});

check('a low-floor passenger cannot transfer onto the regular bus',()=>{
 const d={buses:[{route:['A','T','N','S'],departure:447},{route:['H','N'],departure:450}],lowBus:1};
 const p={id:'test',portrait:0,ready:450,deadline:600,maxWalk:1,low:true,access:{H:0},egress:{S:0}};
 assert.equal(resultFor(p,d,evaluate(d).schedules).status,'impossible');
});

check('route, departure and low-floor changes alter outcomes',()=>{
 for(const fn of [d=>d.buses[0].route.push('E','F'),d=>d.buses[1].route.push('S'),d=>d.buses[0].departure=460,d=>d.lowBus=1]){
  const d=copy(DEFAULT_DESIGN);fn(d);assert.notDeepEqual(evaluate(d).results,initial.results);
 }
});

check('adding destinations lengthens a round trip and changes access',()=>{
 const d=copy(DEFAULT_DESIGN);d.buses[1].route=['H','N','S','M'];
 const e=evaluate(d);
 assert.ok(e.schedules[1].cycle>initial.schedules[1].cycle);
 assert.notEqual(e.results.find(r=>r.id==='minseo').arrival,null);
 assert.notDeepEqual(e.results,initial.results);
});

check('destination walk after 10:00 is unreachable',()=>{
 const d={buses:[{route:['A','T'],departure:590},{route:['H','N'],departure:420}],lowBus:0};
 const p={id:'test',portrait:0,ready:590,deadline:600,maxWalk:5,low:false,access:{A:0},egress:{T:2}};
 assert.equal(resultFor(p,d,evaluate(d).schedules).status,'impossible');
});

check('deadline equality is on time and one minute later is late',()=>{
 const d={buses:[{route:['A','T'],departure:450},{route:['H','N'],departure:450}],lowBus:0};
 const schedules=evaluate(d).schedules;
 const base={id:'test',portrait:0,ready:450,maxWalk:1,low:false,access:{A:0},egress:{T:0}};
 assert.equal(resultFor({...base,deadline:459},d,schedules).status,'ontime');
 assert.equal(resultFor({...base,deadline:458},d,schedules).late,1);
});

check('invalid count, time, duplicate and wrong origin are rejected',()=>{
 assert.equal(validateDesign({...DEFAULT_DESIGN,buses:[...DEFAULT_DESIGN.buses,DEFAULT_DESIGN.buses[0]]}),false);
 const timeBad=copy(DEFAULT_DESIGN);timeBad.buses[0].departure=400;assert.equal(validateDesign(timeBad),false);
 const duplicate=copy(DEFAULT_DESIGN);duplicate.buses[0].route=['A','T','A'];assert.equal(validateDesign(duplicate),false);
 const origin=copy(DEFAULT_DESIGN);origin.buses[1].route=['N','H'];assert.equal(validateDesign(origin),false);
});

check('the bridge junction connects apartments without a transfer-center detour',()=>{
 const direct=roadPath('N','A');
 assert.equal(direct.minutes,13);
 assert.deepEqual(direct.edges.map(e=>[e.from,e.to]),[['N','J'],['J','A']]);
 assert.ok(!direct.points.some(([x,y])=>x===STOP.T.x&&y===STOP.T.y));
 assert.equal(roadPath('N','T').minutes,8);
 assert.equal(roadPath('A','T').minutes,9);
 const bus=scheduleBus({route:['H','N','A'],departure:450},1);
 assert.deepEqual(bus.visits.slice(0,3).map(v=>[v.stop,v.arr,v.dep]),[
  ['H',449,450],['N',464,465],['A',478,481]
 ]);
 assert.ok(bus.visits.every(v=>v.stop!=='T'&&v.stop!=='J'));
 const viaCenter=scheduleBus({route:['H','N','T','A'],departure:450},1);
 assert.equal(viaCenter.visits[3].arr,483);
 const invalid=copy(DEFAULT_DESIGN);invalid.buses[1].route.push('J');
 assert.equal(validateDesign(invalid),false);
 // Passing through a stop's road point never makes it a boarding location.
 const pass=scheduleBus({route:['H','A'],departure:450},1);
 assert.ok(pass.segments.some(s=>s.to==='N'));
 assert.ok(pass.visits.every(v=>v.stop!=='N'));
});

check('shortest road paths use connected endpoints and edge totals',()=>{
 for(const a of STOPS)for(const b of STOPS){if(a.id===b.id)continue;const p=roadPath(a.id,b.id);assert.deepEqual(p.points[0],[a.x,a.y]);assert.deepEqual(p.points.at(-1),[b.x,b.y]);assert.equal(p.minutes,p.edges.reduce((t,e)=>t+e.minutes,0));}
});

const designs=[
 DEFAULT_DESIGN,
 {buses:[{route:['A','T','E','F'],departure:435},{route:['H','N','S','M'],departure:440}],lowBus:0},
 {buses:[{route:['A','F','E','M'],departure:452},{route:['H','N','T','S'],departure:428}],lowBus:1}
];
check('schedule, boarding, transfer and animation invariants hold',()=>{
 for(const d of designs){const e=evaluate(d);for(const s of e.schedules){for(let i=1;i<s.segments.length;i++){const a=s.segments[i-1],b=s.segments[i];assert.ok(b.start>=a.end);assert.deepEqual(a.points.at(-1),b.points[0]);}for(const v of s.visits){assert.deepEqual(busPosition(s,v.arr+.01).point,[STOP[v.stop].x,STOP[v.stop].y]);}}for(let i=0;i<RESIDENTS.length;i++){const p=RESIDENTS[i],r=e.results[i];if(r.arrival==null)continue;assert.equal(r.duration,r.walkIn+r.initialWait+r.inVehicle+r.transferWait+r.walkOut);assert.ok(r.arrival<=SCENARIO.end);assert.equal(r.status,r.arrival<=p.deadline?'ontime':'late');assert.ok(r.rides.length<=2);for(let j=0;j<r.rides.length;j++){const ride=r.rides[j];assert.ok(ride.board>=(j?r.rides[j-1].alight+SCENARIO.transfer:p.ready+r.walkIn));if(p.low)assert.equal(ride.busId,d.lowBus);assert.deepEqual(busPosition(e.schedules[ride.busId],ride.board).point,[STOP[ride.from].x,STOP[ride.from].y]);assert.deepEqual(personPosition(p,r,e.schedules,ride.board+.01).point,busPosition(e.schedules[ride.busId],ride.board+.01).point);}}}
});

console.log(`${checks} meaningful engine checks passed.`);
