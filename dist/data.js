// 교육용 가상 자료. 시각은 자정부터의 분, 도로 시간과 보행 시간은 분 단위.
export const SCENARIO={id:'morning-v2',start:420,end:600,dwell:1,turn:2,transfer:2};
export const STOPS=[
 {id:'H',name:'언덕마을',x:253,y:217,zone:'언덕마을'},
 {id:'A',name:'아파트',x:231,y:527,zone:'아파트'},
 {id:'S',name:'학교',x:490,y:203,zone:'학교'},
 {id:'T',name:'환승센터',x:502,y:471,zone:'환승센터'},
 {id:'M',name:'병원',x:816,y:255,zone:'병원'},
 {id:'F',name:'공장',x:864,y:674,zone:'공장'},
 {id:'N',name:'다리 북단',x:397,y:252,zone:'환승센터'},
 {id:'E',name:'다리 남단',x:716,y:397,zone:'환승센터'}
];
export const STOP=Object.fromEntries(STOPS.map(s=>[s.id,s]));
// 학생이 빈 화면에서 시작하지 않도록 두 차량의 기점을 고정한다.
export const BUS_STARTS=['A','H'];
export const ROADS=[
 {a:'H',b:'N',minutes:14,points:[[253,217],[278,225],[303,239],[345,247],[397,252]]},
 {a:'N',b:'S',minutes:7,points:[[397,252],[424,246],[470,225],[490,217],[490,203]]},
 {a:'N',b:'T',minutes:8,points:[[397,252],[402,276],[411,320],[420,365],[412,386],[397,421],[391,452],[450,469],[502,471]]},
 {a:'A',b:'T',minutes:9,points:[[231,527],[270,519],[330,493],[389,463],[440,466],[502,471]]},
 {a:'N',b:'M',minutes:12,points:[[397,252],[424,246],[470,225],[530,231],[610,251],[679,260],[760,276],[797,274],[816,255]]},
 {a:'T',b:'E',minutes:6,points:[[502,471],[544,480],[578,495],[606,478],[655,437],[700,410],[716,397]]},
 {a:'E',b:'M',minutes:10,points:[[716,397],[728,365],[747,317],[760,286],[797,274],[816,255]]},
 {a:'E',b:'F',minutes:9,points:[[716,397],[680,430],[635,465],[605,497],[637,525],[710,560],[800,620],[864,674]]},
 {a:'A',b:'F',minutes:23,points:[[231,527],[286,566],[357,583],[455,613],[575,650],[693,682],[780,663],[864,674]]}
];
export const RESIDENTS=[
 {id:'minseo',name:'민서',role:'고등학생',portrait:0,home:'언덕마을',destination:'학교',ready:440,deadline:500,walk:'한 번에 25분까지 보행',maxWalk:25,low:false,access:{H:4,N:22},egress:{S:4},story:'아침에 동생을 돌보고 7시 20분부터 나갈 수 있어요. 1교시 전에 교실에 도착하고 싶어요.'},
 {id:'junho',name:'준호',role:'교대 근로자',portrait:1,home:'아파트',destination:'공장',ready:430,deadline:480,walk:'한 번에 15분까지 보행',maxWalk:15,low:false,access:{A:5,T:15},egress:{F:4},story:'8시에 생산 라인의 교대가 시작돼요. 정류장에 내린 뒤 작업장까지 4분이 더 걸려요.'},
 {id:'jiyeong',name:'지영',role:'휠체어 이용자',portrait:2,home:'언덕마을',destination:'병원',ready:445,deadline:540,walk:'평탄한 접근로로 6분 이동',maxWalk:6,low:true,access:{H:6},egress:{M:5},story:'9시 진료 예약이 있어요. 언덕마을 정류장에는 갈 수 있지만 계단이 있는 일반 버스는 탈 수 없어요.'},
 {id:'bokrye',name:'복례',role:'병원에 가는 주민',portrait:3,home:'언덕마을',destination:'병원',ready:440,deadline:510,walk:'지팡이 사용 · 한 번에 8분',maxWalk:8,low:false,access:{H:8},egress:{M:7},story:'8시 30분 검사를 예약했어요. 지팡이를 사용해서 멀리 있는 정류장까지 걷기는 어려워요.'},
 {id:'dohyun',name:'도현',role:'고등학생',portrait:4,home:'아파트',destination:'학교',ready:435,deadline:500,walk:'한 번에 15분까지 보행',maxWalk:15,low:false,access:{A:3,T:14},egress:{S:4},story:'7시 15분부터 출발할 수 있어요. 같은 반 민서와 8시 20분까지 등교해야 해요.'},
 {id:'eunseo',name:'은서',role:'병원 근로자',portrait:5,home:'아파트',destination:'병원',ready:425,deadline:480,walk:'한 번에 15분까지 보행',maxWalk:15,low:false,access:{A:4,T:14},egress:{M:3},story:'8시부터 병동 근무를 시작해요. 이른 아침에 나갈 수 있지만 버스의 첫 출발 시각이 중요해요.'},
 {id:'haneul',name:'하늘',role:'유아 동반 근로자',portrait:8,home:'아파트',destination:'환승센터',ready:460,deadline:505,walk:'유아차 이동 · 한 번에 8분',maxWalk:8,low:true,access:{A:6},egress:{T:4},story:'유아차를 접기 어려워 저상버스를 이용해요. 환승센터 직장 어린이집에 들러 8시 25분 근무를 시작해요.'},
 {id:'geonu',name:'건우',role:'휠체어 이용 근로자',portrait:11,home:'아파트',destination:'공장',ready:450,deadline:515,walk:'평탄한 접근로로 5분 이동',maxWalk:5,low:true,access:{A:5},egress:{F:5},story:'8시 35분 사무실 회의가 있어요. 환승한다면 두 버스가 모두 저상이어야 하므로 지금은 한 대로 가야 해요.'}
];
export const DEFAULT_DESIGN={buses:[{route:['A','T'],departure:450},{route:['H','N'],departure:450}],lowBus:0};
export const LESSON=[['주민 상황 확인',5],['첫 노선 설계',8],['운행과 결과 확인',5],['놓친 주민 검토',7],['재설계',8],['전후 비교',5],['개념 정리',7]];
