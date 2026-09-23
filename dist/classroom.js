import {firebaseConfig} from './firebase-config.js';

const DEMO_KEY='bus-classrooms-demo-v1';
const hasFirebase=Boolean(firebaseConfig?.apiKey&&firebaseConfig?.databaseURL&&firebaseConfig?.projectId);
let sdk,auth,db,currentUser,channel;

const now=()=>Date.now();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const readDemo=()=>{try{return JSON.parse(localStorage.getItem(DEMO_KEY))||{};}catch{return {};}};
const writeDemo=data=>{localStorage.setItem(DEMO_KEY,JSON.stringify(data));channel?.postMessage('changed');window.dispatchEvent(new Event('storage'));};
const demoUid=()=>{let id=sessionStorage.getItem('bus-demo-uid');if(!id){id='demo_'+crypto.randomUUID().replaceAll('-','').slice(0,20);sessionStorage.setItem('bus-demo-uid',id);}return id;};

export async function connectBackend(){
 if(currentUser)return {uid:currentUser.uid,isDemo:!hasFirebase};
 if(!hasFirebase){currentUser={uid:demoUid()};channel=new BroadcastChannel('bus-classrooms-demo');return {uid:currentUser.uid,isDemo:true};}
 const version='12.19.0';
 const [appMod,authMod,dbMod]=await Promise.all([
  import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
  import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
  import(`https://www.gstatic.com/firebasejs/${version}/firebase-database.js`)
 ]);
 sdk={...appMod,...authMod,...dbMod};const app=sdk.initializeApp(firebaseConfig);auth=sdk.getAuth(app);db=sdk.getDatabase(app);
 let cred=auth.currentUser?{user:auth.currentUser}:null;
 for(let attempt=0;!cred&&attempt<2;attempt++){
  try{cred=await sdk.signInAnonymously(auth);}catch(error){if(attempt===1||!String(error?.code).includes('network-request-failed'))throw error;await wait(500);}
 }
 currentUser=cred.user;
 return {uid:currentUser.uid,isDemo:false};
}

async function demoMutate(code,fn){const all=readDemo(),value=structuredClone(all[code]||null),next=fn(value);if(next===undefined)delete all[code];else all[code]=next;writeDemo(all);return next;}
export async function readClass(code){await connectBackend();if(!hasFirebase)return structuredClone(readDemo()[code]||null);const snap=await sdk.get(sdk.ref(db,`classes/${code}`));return snap.exists()?snap.val():null;}
export function watchClass(code,callback){let stop=()=>{},disposed=false;connectBackend().then(()=>{if(disposed)return;if(!hasFirebase){const send=()=>callback(structuredClone(readDemo()[code]||null));send();channel.addEventListener('message',send);window.addEventListener('storage',send);stop=()=>{channel?.removeEventListener('message',send);window.removeEventListener('storage',send);};return;}stop=sdk.onValue(sdk.ref(db,`classes/${code}`),snap=>callback(snap.exists()?snap.val():null),err=>callback(null,err));}).catch(error=>callback(null,error));return()=>{disposed=true;stop();};}
function studentView(value,teamId){if(!value)return null;const team=value.teams?.[teamId];return {...value,teams:team?{[teamId]:structuredClone(team)}:{}};}
export async function readStudentClass(code){const {uid}=await connectBackend();if(!hasFirebase)return studentView(readDemo()[code]||null,uid);const [control,team]=await Promise.all([sdk.get(sdk.ref(db,`classes/${code}/control`)),sdk.get(sdk.ref(db,`classes/${code}/teams/${uid}`))]);if(!control.exists())return null;return {code,control:control.val(),teams:team.exists()?{[uid]:team.val()}:{}};}
export function watchStudentClass(code,teamId,callback){let disposed=false,stopControl=()=>{},stopTeam=()=>{},control,team,controlReady=false;const emit=()=>{if(disposed||!controlReady)return;callback(control?{code,control,teams:team?{[teamId]:team}:{}}:null);};connectBackend().then(({uid})=>{if(disposed)return;if(uid!==teamId){callback(null,new Error('현재 기기의 모둠 기록만 구독할 수 있습니다.'));return;}if(!hasFirebase){const send=()=>callback(studentView(readDemo()[code]||null,teamId));send();channel.addEventListener('message',send);window.addEventListener('storage',send);stopControl=()=>{channel?.removeEventListener('message',send);window.removeEventListener('storage',send);};return;}stopControl=sdk.onValue(sdk.ref(db,`classes/${code}/control`),snap=>{control=snap.exists()?snap.val():null;controlReady=true;emit();},err=>callback(null,err));stopTeam=sdk.onValue(sdk.ref(db,`classes/${code}/teams/${teamId}`),snap=>{team=snap.exists()?snap.val():null;emit();},err=>callback(null,err));}).catch(error=>callback(null,error));return()=>{disposed=true;stopControl();stopTeam();};}
function initialClass(code,uid){return {code,teacherUid:uid,createdAt:now(),control:{status:'lobby',phase:0,phaseDuration:5,phaseStartedAt:now(),pausedAt:0,message:'주민 한 사람의 아침부터 살펴보세요.'},teams:{}};}
export async function createClass(){const {uid}=await connectBackend();for(let i=0;i<20;i++){const code=String(Math.floor(100000+Math.random()*900000)),value=initialClass(code,uid);try{if(!hasFirebase){if(await readClass(code))continue;await demoMutate(code,()=>value);}else await sdk.set(sdk.ref(db,`classes/${code}`),value);}catch(error){if(String(error?.code||error).includes('PERMISSION_DENIED'))continue;throw error;}localStorage.setItem(`bus-teacher-${code}`,uid);return value;}throw new Error('수업 코드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');}
export async function updateControl(code,patch){const {uid}=await connectBackend(),klass=await readClass(code);if(!klass||klass.teacherUid!==uid)throw new Error('이 브라우저에서 만든 수업만 운영할 수 있습니다.');const clean={...patch};if(clean.phaseStartedAt==='SERVER_TIME')clean.phaseStartedAt=now();if(!hasFirebase)return demoMutate(code,v=>({...v,control:{...v.control,...clean}}));await sdk.update(sdk.ref(db,`classes/${code}/control`),clean);}
export async function joinClass(code,name){const {uid}=await connectBackend(),klass=await readStudentClass(code);if(!klass)throw new Error('수업 코드를 찾을 수 없습니다.');if(klass.control?.status==='ended')throw new Error('종료된 수업입니다.');const teamId=uid,existing=klass.teams?.[teamId];const team={...(existing||{}),uid:teamId,name:name.trim().slice(0,24),joinedAt:existing?.joinedAt||now(),lastSeen:now(),progress:existing?.progress||{mode:'waiting',attempts:0}};if(!hasFirebase)await demoMutate(code,v=>({...v,teams:{...(v.teams||{}),[teamId]:team}}));else await sdk.set(sdk.ref(db,`classes/${code}/teams/${teamId}`),team);localStorage.setItem(`bus-team-${code}`,teamId);return team;}
export async function updateTeam(code,teamId,patch){const {uid}=await connectBackend();if(uid!==teamId){const klass=await readClass(code);if(klass?.teacherUid!==uid)throw new Error('자신의 모둠 기록만 저장할 수 있습니다.');}const clean={...patch,lastSeen:now()};if(!hasFirebase)return demoMutate(code,v=>{if(!v?.teams?.[teamId])throw new Error('입장한 모둠을 찾을 수 없습니다.');return {...v,teams:{...v.teams,[teamId]:{...v.teams[teamId],...clean}}};});await sdk.update(sdk.ref(db,`classes/${code}/teams/${teamId}`),clean);}
export async function leaveTeam(code,teamId){const {uid}=await connectBackend();if(uid!==teamId){const klass=await readClass(code);if(klass?.teacherUid!==uid)throw new Error('모둠을 나갈 권한이 없습니다.');}if(!hasFirebase)return demoMutate(code,v=>{const teams={...(v?.teams||{})};delete teams[teamId];return {...v,teams};});await sdk.remove(sdk.ref(db,`classes/${code}/teams/${teamId}`));localStorage.removeItem(`bus-team-${code}`);}
export const backendMode=()=>hasFirebase?'firebase':'demo';
