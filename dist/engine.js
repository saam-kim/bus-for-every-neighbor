import {SCENARIO,STOPS,STOP,ROADS,RESIDENTS} from './data.js';
export const time=t=>t==null?'—':`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const cache=new Map();
export function roadPath(from,to){
 const key=from+'-'+to;if(cache.has(key))return cache.get(key);
 const distance=Object.fromEntries(STOPS.map(s=>[s.id,Infinity])),prev={};distance[from]=0;const todo=new Set(STOPS.map(s=>s.id));
 while(todo.size){const u=[...todo].sort((a,b)=>distance[a]-distance[b]||a.localeCompare(b))[0];todo.delete(u);if(u===to)break;
  ROADS.forEach((r,i)=>{const v=r.a===u?r.b:r.b===u?r.a:null;if(v&&todo.has(v)&&distance[u]+r.minutes<distance[v]){distance[v]=distance[u]+r.minutes;prev[v]={u,i};}});
 }
 const edges=[];let v=to;while(v!==from){const p=prev[v];if(!p)throw Error('연결되지 않은 도로');const r=ROADS[p.i];edges.unshift({from:p.u,to:v,minutes:r.minutes,points:r.a===p.u?r.points:[...r.points].reverse()});v=p.u;}
 const result={minutes:distance[to],edges,points:edges.flatMap((e,i)=>i?e.points.slice(1):e.points)};cache.set(key,result);return result;
}
export function validateDesign(d){
 if(!d||![0,1].includes(d.lowBus)||!Array.isArray(d.buses)||d.buses.length!==2)return false;
 return d.buses.every(b=>Number.isInteger(b.departure)&&b.departure>=420&&b.departure<=599&&Array.isArray(b.route)&&b.route.length<=8&&new Set(b.route).size===b.route.length&&b.route.every(id=>STOP[id]));
}
export function scheduleBus(bus,busId,end=SCENARIO.end){
 const route=bus.route;if(route.length<2)return {busId,route,cycle:0,visits:[],segments:[],departures:[]};
 const legTimes=route.slice(1).map((s,i)=>roadPath(route[i],s).minutes);
 const cycle=2*legTimes.reduce((a,b)=>a+b,0)+2*Math.max(0,route.length-2)*SCENARIO.dwell+2*(SCENARIO.turn+SCENARIO.dwell);
 let index=0,direction=1,dep=bus.departure;const visits=[{stop:route[0],arr:dep-1,dep,busId,index:0}],segments=[],departures=[dep];
 while(dep<end){const next=index+direction,p=roadPath(route[index],route[next]);let at=dep;
  for(const edge of p.edges){segments.push({...edge,start:at,end:at+edge.minutes,busId});at+=edge.minutes;}
  index=next;const terminal=index===0||index===route.length-1;dep=at+SCENARIO.dwell+(terminal?SCENARIO.turn:0);
  visits.push({stop:route[index],arr:at,dep,busId,index:visits.length});if(index===0&&dep<=end)departures.push(dep);if(terminal)direction*=-1;
 }
 return {busId,route,cycle,visits,segments,departures};
}
function rideOptions(schedule,stop,earliest){
 const out=[];
 schedule.visits.forEach((v,i)=>{if(v.stop!==stop||v.dep<earliest||v.dep>=600)return;
  const seen=new Set([stop]);for(let j=i+1;j<schedule.visits.length;j++){const w=schedule.visits[j];if(w.arr>600)break;if(seen.has(w.stop))continue;seen.add(w.stop);out.push({busId:schedule.busId,from:stop,to:w.stop,board:v.dep,alight:w.arr,boardIndex:i,alightIndex:j,stops:schedule.visits.slice(i,j+1).map(s=>s.stop)});}
 });return out;
}
function candidates(person,design,schedules,ignoreLow=false){
 const result=[];const allowed=s=>ignoreLow||!person.low||design.lowBus===s.busId;
 for(const [origin,walk] of Object.entries(person.access)){
  if(walk>person.maxWalk)continue;
  if(person.egress[origin]!=null&&walk+person.egress[origin]<=person.maxWalk)result.push({arrival:person.ready+walk+person.egress[origin],walkIn:walk,walkOut:person.egress[origin],origin,destination:origin,rides:[]});
  for(const a of schedules.filter(allowed))for(const ride of rideOptions(a,origin,person.ready+walk)){
   const finish=rides=>{const last=rides.at(-1),exit=person.egress[last.to];if(exit==null||exit>person.maxWalk||last.alight+exit>600)return;
    result.push({arrival:last.alight+exit,origin,destination:last.to,walkIn:walk,walkOut:exit,rides});};
   finish([ride]);for(const b of schedules.filter(s=>s.busId!==a.busId&&allowed(s)))for(const second of rideOptions(b,ride.to,ride.alight+SCENARIO.transfer))finish([ride,second]);
  }
 }
 return result.sort((a,b)=>a.arrival-b.arrival||a.rides.length-b.rides.length||a.walkIn+a.walkOut-b.walkIn-b.walkOut||JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export function resultFor(person,design,schedules){
 const best=candidates(person,design,schedules)[0];
 if(!best){
  const allowed=schedules.filter(s=>!person.low||s.busId===design.lowBus);
  const servedOrigin=allowed.some(s=>s.route.some(id=>person.access[id]!=null&&person.access[id]<=person.maxWalk));
  const servedDest=allowed.some(s=>s.route.some(id=>person.egress[id]!=null));
  let reason=person.low&&candidates(person,design,schedules,true).length?'일반 버스로는 갈 수 있지만 이용 가능한 저상버스 경로가 없습니다.':!servedOrigin?'이동 가능한 집 근처 정류장에 이용할 수 있는 버스가 서지 않습니다.':!servedDest?'목적지 정류장까지 연결되는 이용 가능한 버스가 없습니다.':'출발 가능한 시각 이후 최대 1회 환승으로 10:00까지 목적지에 도착하는 연결편이 없습니다.';
  return {id:person.id,status:'impossible',arrival:null,duration:null,reason,rides:[]};
 }
 const first=best.rides[0],last=best.rides.at(-1);
 const initialWait=first?first.board-person.ready-best.walkIn:0;
 const transferWait=best.rides.length===2?best.rides[1].board-best.rides[0].alight:0;
 const inVehicle=best.rides.reduce((n,r)=>n+r.alight-r.board,0);
 const late=Math.max(0,best.arrival-person.deadline);
 return {...best,id:person.id,status:late?'late':'ontime',late,duration:best.arrival-person.ready,initialWait,transferWait,inVehicle,
  reason:late?`${time(first?.board)} 첫 탑승까지 ${initialWait}분 대기, 버스 이동 ${inVehicle}분${transferWait?`, 환승 ${transferWait}분`:''}, 출발·도착 보행 ${best.walkIn+best.walkOut}분으로 시한보다 ${late}분 늦습니다.`:`${time(best.arrival)} 도착 · 도착 시한까지 ${person.deadline-best.arrival}분 여유`};
}
export function evaluate(design){if(!validateDesign(design))throw Error('잘못된 설계');const schedules=design.buses.map((b,i)=>scheduleBus(b,i));return {schedules,results:RESIDENTS.map(p=>resultFor(p,design,schedules))};}
export function summary(results){const reachable=results.filter(r=>r.arrival!=null);return {ontime:results.filter(r=>r.status==='ontime').length,late:results.filter(r=>r.status==='late').length,impossible:results.length-reachable.length,count:reachable.length,average:reachable.length?Math.round(reachable.reduce((a,r)=>a+r.duration,0)/reachable.length):null};}
export function along(points,f){const lens=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));let d=Math.max(0,Math.min(1,f))*lens.reduce((a,b)=>a+b,0);for(let i=0;i<lens.length;i++){if(d<=lens[i]){const k=lens[i]?d/lens[i]:0;return [points[i][0]+(points[i+1][0]-points[i][0])*k,points[i][1]+(points[i+1][1]-points[i][1])*k];}d-=lens[i];}return points.at(-1);}
export function busPosition(schedule,t){
 const segment=schedule.segments.find(s=>t>=s.start&&t<s.end);if(segment)return {point:along(segment.points,(t-segment.start)/(segment.end-segment.start)),state:'운행 중'};
 let visit=schedule.visits[0];for(const v of schedule.visits){if(v.arr<=t)visit=v;else break;}
 const id=visit?.stop||schedule.route[0];return id?{point:[STOP[id].x,STOP[id].y],state:t<(schedule.visits[0]?.dep??Infinity)?'첫 출발 대기':'정차·회차'}:null;
}
export function personPosition(person,result,schedules,t){
 const origin=STOP[result.origin||Object.keys(person.access)[0]],dest=STOP[result.destination||Object.keys(person.egress)[0]],homeStop=STOP[Object.keys(person.access)[0]];
 const home=[homeStop.x-30+(person.portrait%3)*14,homeStop.y-58],end=[dest.x+22,dest.y-30];
 if(result.status==='impossible'||t<person.ready)return {point:home,state:result.status==='impossible'?'이동 불가':'출발 전'};
 if(t<person.ready+result.walkIn)return {point:along([home,[origin.x,origin.y]],(t-person.ready)/result.walkIn),state:'정류장으로 이동'};
 for(let i=0;i<result.rides.length;i++){const r=result.rides[i];if(t<r.board){const s=STOP[r.from];return {point:[s.x-12,s.y-16],state:i?'환승 대기':'버스 대기'};}if(t<r.alight)return {...busPosition(schedules[r.busId],t),state:`${r.busId+1}호차 탑승`};}
 if(t<result.arrival){const start=result.rides.at(-1)?.alight||person.ready+result.walkIn;return {point:along([[dest.x,dest.y],end],(t-start)/result.walkOut),state:'목적지로 이동'};}
 return {point:end,state:'도착'};
}
