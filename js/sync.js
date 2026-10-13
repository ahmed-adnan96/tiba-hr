/* ---------- shared sync (db) ---------- */
var SYNCSTATE='local';
let DB=null,syncReady=false,pushTimer=null,pushing=false;
const SYNC={emps:{},moves:{},evals:{},config:''};
const SCOLS=['emps','moves','evals','config'];
const latest={},defd={};
const stable=o=>o===null||typeof o!=='object'?JSON.stringify(o):Array.isArray(o)?'['+o.map(stable).join(',')+']':'{'+Object.keys(o).filter(k=>o[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stable(o[k])).join(',')+'}';
/* مفتاح آمن: YYYY-MM|eid → YYYY-MM_eid (ولو الـ id فيه _ مش بيتلخبط) */
const evKey=k=>{const i=k.indexOf('|');return i<0?k:k.slice(0,i)+'_'+k.slice(i+1);};
const evBack=id=>{const m=String(id).match(/^(\d{4}-\d{2})_(.+)$/);return m?m[1]+'|'+m[2]:id.replace('_','|');};
const clone=o=>JSON.parse(JSON.stringify(o));
const evObj=v=>({s:(v.s||[]).map(Number),adj:+v.adj||0,why:v.why||''});
const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
function saveLocalOnly(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function syncText(){
  return SYNCSTATE==='ok'?'<b style="color:var(--ok)">المزامنة تعمل:</b> بياناتك محفوظة على حسابك وتظهر على كل أجهزتك.'
    :SYNCSTATE==='connecting'?'جارٍ الاتصال بالمزامنة...'
    :SYNCSTATE==='ro'?'عرض فقط: لا تملك صلاحية تعديل البيانات المشتركة.'
    :SYNCSTATE==='err'?'تعذّرت المزامنة مؤقتاً وستُعاد المحاولة تلقائياً.'
    :'المزامنة غير متاحة في هذا العرض، فالبيانات تُحفظ على هذا الجهاز فقط. خذ نسخة احتياطية بشكل دوري.';
}
function setSyncState(s){if(SYNCSTATE!==s){SYNCSTATE=s;showBanner();if(U.view==='settings')render(true);}}
function snapLocal(){
  const m={emps:{},moves:{},evals:{},config:stable({set:S.set,types:S.types})};
  S.emps.forEach(e=>{m.emps[e.id]=stable(e);});
  S.moves.forEach(x=>{m.moves[x.id]=stable(x);});
  Object.keys(S.evals).forEach(k=>{m.evals[evKey(k)]=stable(evObj(S.evals[k]));});
  return m;
}
function schedulePush(){if(!DB||!syncReady)return;clearTimeout(pushTimer);pushTimer=setTimeout(pushDiff,600);}
async function pushDiff(){
  if(!DB||!syncReady)return;
  if(pushing){schedulePush();return;}
  pushing=true;
  try{
    const cur=snapLocal(),jobs=[];
    for(const col of ['emps','moves','evals']){
      for(const id in cur[col])if(SYNC[col][id]!==cur[col][id])jobs.push({col,id,v:cur[col][id]});
      for(const id in SYNC[col])if(!(id in cur[col]))jobs.push({col,id,v:null});
    }
    if(SYNC.config!==cur.config)jobs.push({col:'config',id:'main',v:cur.config});
    for(const j of jobs){
      const ref=DB.doc(j.col+'/'+j.id);
      if(j.v===null){await ref.delete();delete SYNC[j.col][j.id];}
      else{await ref.set(JSON.parse(j.v));if(j.col==='config')SYNC.config=j.v;else SYNC[j.col][j.id]=j.v;}
    }
    setSyncState('ok');
  }catch(e){
    const c=e&&e.code;
    if(c==='invalid_argument'||c==='revoked')setSyncState('ro');
    else{setSyncState('err');setTimeout(schedulePush,6000);}
  }
  pushing=false;
}
function safeRender(){
  const a=document.activeElement;
  if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&$('#app').contains(a))return;
  render(true);
}
function firstSync(){
  const L=latest;
  const dbEmps=L.emps.docs.map(d=>clone(d.data()));
  if(dbEmps.length){
    S.emps=dbEmps.sort(byId);
    const c=L.config.docs.find(d=>d.id==='main');
    if(c){const cd=c.data();if(cd.set)S.set=clone(cd.set);if(Array.isArray(cd.types))S.types=clone(cd.types);}
    let mig=false;try{mig=localStorage.getItem('teba_hr_mig')==='1';}catch(e){}
    const dm={};L.moves.docs.forEach(d=>{dm[d.id]=clone(d.data());});
    const lm=mig?[]:S.moves.filter(m=>!(m.id in dm));
    S.moves=Object.values(dm).concat(lm);
    const de={};L.evals.docs.forEach(d=>{const k=evBack(d.id);if(k)de[k]=evObj(d.data());});
    if(!mig)Object.keys(S.evals).forEach(k=>{if(!(k in de))de[k]=evObj(S.evals[k]);});
    S.evals=de;
    const cur=snapLocal();
    L.emps.docs.forEach(d=>{SYNC.emps[d.id]=cur.emps[d.id];});
    L.moves.docs.forEach(d=>{SYNC.moves[d.id]=cur.moves[d.id];});
    L.evals.docs.forEach(d=>{SYNC.evals[d.id]=cur.evals[d.id];});
    if(c)SYNC.config=cur.config;
  }
  syncReady=true;SYNCSTATE='ok';
  try{localStorage.setItem('teba_hr_mig','1');}catch(e){}
  saveLocalOnly();showBanner();safeRender();schedulePush();
}
function applyIncoming(col,snap){
  const local=snapLocal(),applied=[],seen={};
  const dirty=id=>col==='config'?SYNC.config!==local.config:SYNC[col][id]!==local[col][id];
  snap.docs.forEach(d=>{
    const id=d.id;seen[id]=1;
    if(col==='config'){
      if(id!=='main'||dirty())return;
      const cd=d.data();if(cd.set)S.set=clone(cd.set);if(Array.isArray(cd.types))S.types=clone(cd.types);
      applied.push(id);return;
    }
    if(dirty(id))return;
    const data=clone(d.data());
    if(col==='emps'){const i=S.emps.findIndex(e=>e.id===id);if(i<0)S.emps.push(data);else S.emps[i]=data;}
    else if(col==='moves'){const i=S.moves.findIndex(m=>m.id===id);if(i<0)S.moves.push(data);else S.moves[i]=data;}
    else{const k=evBack(id);if(k)S.evals[k]=evObj(data);}
    applied.push(id);
  });
  if(col!=='config'){
    Object.keys(SYNC[col]).forEach(id=>{
      if(seen[id]||SYNC[col][id]!==local[col][id])return;
      if(col==='emps')S.emps=S.emps.filter(e=>e.id!==id);
      else if(col==='moves')S.moves=S.moves.filter(m=>m.id!==id);
      else{const k=evBack(id);if(k)delete S.evals[k];}
      delete SYNC[col][id];
    });
    if(col==='emps')S.emps.sort(byId);
  }
  const after=snapLocal();
  let changed=false;
  if(col==='config'){
    if(applied.length){SYNC.config=after.config;}
    changed=after.config!==local.config;
  }else{
    applied.forEach(id=>{SYNC[col][id]=after[col][id];});
    const A=after[col],B=local[col],ka=Object.keys(A),kb=Object.keys(B);
    changed=ka.length!==kb.length||ka.some(k=>A[k]!==B[k]);
  }
  if(changed){saveLocalOnly();safeRender();}
}
function onSnap(col,snap){
  latest[col]=snap;
  if(!syncReady){
    if(!snap.metadata.fromCache)defd[col]=true;
    if(SCOLS.every(c=>defd[c]))firstSync();
    return;
  }
  if(snap.metadata.fromCache)return;
  applyIncoming(col,snap);
}
async function initSync(){
  try{
    if(!(window.claude&&claude.use))return;
    DB=await claude.use('db');
    if(!DB)return;
  }catch(e){DB=null;return;}
  SYNCSTATE='connecting';showBanner();
  SCOLS.forEach(col=>{
    try{DB.collection(col).onSnapshot(s=>onSnap(col,s),()=>{setSyncState('err');});}
    catch(e){setSyncState('err');}
  });
}
