import {firebaseConfig} from './firebase-config.js';

const DEMO_KEY='bus-classrooms-demo-v1';
const hasFirebase=Boolean(firebaseConfig?.apiKey&&firebaseConfig?.databaseURL&&firebaseConfig?.projectId);
let sdk,auth,db,currentUser,channel,connecting;

const now=()=>Date.now();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const connectionError=()=>new Error('연결 시간이 초과되었습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.');
function within(promise,ms){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(connectionError()),ms);})]).finally(()=>clearTimeout(timer));}
const readDemo=()=>{try{return JSON.parse(localStorage.getItem(DEMO_KEY))||{};}catch{return {};}};
const writeDemo=data=>{localStorage.setItem(DEMO_KEY,JSON.stringify(data));channel?.postMessage('changed');window.dispatchEvent(new Event('storage'));};
const demoUid=()=>{let id=sessionStorage.getItem('bus-demo-uid');if(!id){id='demo_'+crypto.randomUUID().replaceAll('-','').slice(0,20);sessionStorage.setItem('bus-demo-uid',id);}return id;};

async function initializeBackend(){
 if(currentUser)return {uid:currentUser.uid,isDemo:!hasFirebase};
 if(!hasFirebase){currentUser={uid:demoUid()};channel=new BroadcastChannel('bus-classrooms-demo');return {uid:currentUser.uid,isDemo:true};}
 const version='12.19.0';
 const [appMod,authMod,dbMod]=await within(Promise.all([
  import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
  import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
  import(`https://www.gstatic.com/firebasejs/${version}/firebase-database.js`)
 ]),15000);
 sdk={...appMod,...authMod,...dbMod};const app=sdk.getApps().length?sdk.getApp():sdk.initializeApp(firebaseConfig);auth=sdk.getAuth(app);db=sdk.getDatabase(app);
 await within(auth.authStateReady(),12000);
 let cred=auth.currentUser?{user:auth.currentUser}:null;
 for(let attempt=0;!cred&&attempt<2;attempt++){
  try{cred=await within(sdk.signInAnonymously(auth),15000);}catch(error){if(attempt===1||!String(error?.code).includes('network-request-failed'))throw error;await wait(500);}
 }
 currentUser=cred.user;
 return {uid:currentUser.uid,isDemo:false};
}
export function connectBackend(){if(currentUser)return Promise.resolve({uid:currentUser.uid,isDemo:!hasFirebase});if(!connecting)connecting=initializeBackend().finally(()=>{connecting=null;});return connecting;}

async function demoMutate(code,fn){const all=readDemo(),value=structuredClone(all[code]||null),next=fn(value);if(next===undefined)delete all[code];else all[code]=next;writeDemo(all);return next;}
export async function readClass(code){await connectBackend();if(!hasFirebase)return structuredClone(readDemo()[code]||null);const token=await within(currentUser.getIdToken(),12000),url=new URL(`${firebaseConfig.databaseURL}/classes/${code}.json`);url.searchParams.set('auth',token);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{signal:controller.signal,cache:'no-store'});if(response.status===401||response.status===403)throw new Error('이 수업을 읽을 권한이 없습니다. 수업을 만든 브라우저에서 열어 주세요.');if(!response.ok)throw new Error(`수업을 불러오지 못했습니다 (HTTP ${response.status}).`);return await response.json();}catch(error){if(error.name==='AbortError')throw connectionError();if(error instanceof TypeError)throw new Error('Firebase에 연결할 수 없습니다. 학교 네트워크에서 Firebase 접속이 허용되는지 확인해 주세요.');throw error;}finally{clearTimeout(timer);}}
export function watchClass(code,callback){let stop=()=>{},disposed=false;connectBackend().then(()=>{if(disposed)return;if(!hasFirebase){const send=()=>callback(structuredClone(readDemo()[code]||null));send();channel.addEventListener('message',send);window.addEventListener('storage',send);stop=()=>{channel?.removeEventListener('message',send);window.removeEventListener('storage',send);};return;}stop=sdk.onValue(sdk.ref(db,`classes/${code}`),snap=>callback(snap.exists()?snap.val():null),err=>callback(null,err));}).catch(error=>callback(null,error));return()=>{disposed=true;stop();};}
function studentView(value,teamId){if(!value)return null;const team=value.teams?.[teamId];return {...value,teams:team?{[teamId]:structuredClone(team)}:{}};}
export async function readStudentClass(code){const {uid}=await connectBackend();if(!hasFirebase)return studentView(readDemo()[code]||null,uid);const [control,team]=await Promise.all([sdk.get(sdk.ref(db,`classes/${code}/control`)),sdk.get(sdk.ref(db,`classes/${code}/teams/${uid}`))]);if(!control.exists())return null;return {code,control:control.val(),teams:team.exists()?{[uid]:team.val()}:{}};}
export function watchStudentClass(code,teamId,callback){let disposed=false,stopControl=()=>{},stopTeam=()=>{},control,team,controlReady=false;const emit=()=>{if(disposed||!controlReady)return;callback(control?{code,control,teams:team?{[teamId]:team}:{}}:null);};connectBackend().then(({uid})=>{if(disposed)return;if(uid!==teamId){callback(null,new Error('현재 기기의 모둠 기록만 구독할 수 있습니다.'));return;}if(!hasFirebase){const send=()=>callback(studentView(readDemo()[code]||null,teamId));send();channel.addEventListener('message',send);window.addEventListener('storage',send);stopControl=()=>{channel?.removeEventListener('message',send);window.removeEventListener('storage',send);};return;}stopControl=sdk.onValue(sdk.ref(db,`classes/${code}/control`),snap=>{control=snap.exists()?snap.val():null;controlReady=true;emit();},err=>callback(null,err));stopTeam=sdk.onValue(sdk.ref(db,`classes/${code}/teams/${teamId}`),snap=>{team=snap.exists()?snap.val():null;emit();},err=>callback(null,err));}).catch(error=>callback(null,error));return()=>{disposed=true;stopControl();stopTeam();};}
function initialClass(code,uid){return {code,teacherUid:uid,createdAt:now(),control:{status:'lobby',phase:0,phaseDuration:5,phaseStartedAt:now(),pausedAt:0,message:'주민 한 사람의 아침부터 살펴보세요.'},teams:{}};}
async function createRemoteClass(value){
 const token=await within(currentUser.getIdToken(),12000);
 const url=new URL(`${firebaseConfig.databaseURL}/classes/${value.code}.json`);
 url.searchParams.set('auth',token);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:controller.signal,cache:'no-store'});
  if(response.status===401||response.status===403)throw new Error('수업을 만들 권한이 없습니다. 관리자에게 Firebase 설정을 확인해 달라고 알려 주세요.');
  if(!response.ok)throw new Error(`수업 생성 요청이 실패했습니다 (HTTP ${response.status}). 잠시 후 다시 눌러 주세요.`);
  return true;
 }catch(error){if(error.name==='AbortError')throw connectionError();if(error instanceof TypeError)throw new Error('Firebase에 연결할 수 없습니다. 학교 네트워크에서 Firebase 접속이 허용되는지 확인해 주세요.');throw error;}finally{clearTimeout(timer);}
}
export async function createClass(){const {uid}=await connectBackend();for(let i=0;i<5;i++){const code=String(Math.floor(100000+Math.random()*900000)),value=initialClass(code,uid);if(!hasFirebase){if(await readClass(code))continue;await demoMutate(code,()=>value);}else await createRemoteClass(value);localStorage.setItem(`bus-teacher-${code}`,uid);return value;}throw new Error('사용 가능한 수업 코드를 만들지 못했습니다. 다시 눌러 주세요.');}
export async function updateControl(code,patch){const {uid}=await connectBackend(),klass=await readClass(code);if(!klass||klass.teacherUid!==uid)throw new Error('이 브라우저에서 만든 수업만 운영할 수 있습니다.');const clean={...patch};if(clean.phaseStartedAt==='SERVER_TIME')clean.phaseStartedAt=now();if(!hasFirebase)return demoMutate(code,v=>({...v,control:{...v.control,...clean}}));await sdk.update(sdk.ref(db,`classes/${code}/control`),clean);}
export async function joinClass(code,name){const {uid}=await connectBackend(),klass=await readStudentClass(code);if(!klass)throw new Error('수업 코드를 찾을 수 없습니다.');if(klass.control?.status==='ended')throw new Error('종료된 수업입니다.');const teamId=uid,existing=klass.teams?.[teamId];const team={...(existing||{}),uid:teamId,name:name.trim().slice(0,24),joinedAt:existing?.joinedAt||now(),lastSeen:now(),progress:existing?.progress||{mode:'waiting',attempts:0}};if(!hasFirebase)await demoMutate(code,v=>({...v,teams:{...(v.teams||{}),[teamId]:team}}));else await sdk.set(sdk.ref(db,`classes/${code}/teams/${teamId}`),team);localStorage.setItem(`bus-team-${code}`,teamId);return team;}
export async function updateTeam(code,teamId,patch){const {uid}=await connectBackend();if(uid!==teamId){const klass=await readClass(code);if(klass?.teacherUid!==uid)throw new Error('자신의 모둠 기록만 저장할 수 있습니다.');}const clean={...patch,lastSeen:now()};if(!hasFirebase)return demoMutate(code,v=>{if(!v?.teams?.[teamId])throw new Error('입장한 모둠을 찾을 수 없습니다.');return {...v,teams:{...v.teams,[teamId]:{...v.teams[teamId],...clean}}};});await sdk.update(sdk.ref(db,`classes/${code}/teams/${teamId}`),clean);}
export async function leaveTeam(code,teamId){const {uid}=await connectBackend();if(uid!==teamId){const klass=await readClass(code);if(klass?.teacherUid!==uid)throw new Error('모둠을 나갈 권한이 없습니다.');}if(!hasFirebase)return demoMutate(code,v=>{const teams={...(v?.teams||{})};delete teams[teamId];return {...v,teams};});await sdk.remove(sdk.ref(db,`classes/${code}/teams/${teamId}`));localStorage.removeItem(`bus-team-${code}`);}
export const backendMode=()=>hasFirebase?'firebase':'demo';
