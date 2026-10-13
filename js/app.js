const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const KEY='teba_hr_v1';
const $=(s,el=document)=>el.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>String(Math.round((+x||0)*100)/100);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const pad=n=>String(n).padStart(2,'0');
const ICON={
  home:'<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  people:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5"/><path d="M16 5.2a3.2 3.2 0 010 6M18 14.8c2 .6 3.5 2.3 3.5 5.2"/>',
  moves:'<path d="M4 6h16M4 12h16M4 18h9"/><circle cx="19" cy="18" r="2"/>',
  sum:'<path d="M5 20V11M12 20V4M19 20v-6"/>',
  more:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'
};
const svg=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

/* ---------- state ---------- */
const catOf=n=>n.startsWith('جزاء')?'pen':n.startsWith('مكافأة')?'rew':n.startsWith('تأخير')?'late':n.startsWith('إجازة')?'leave':'abs';
function seed(){
  return {v:1,
    emps:JSON.parse(JSON.stringify(DATA.emps)),
    moves:[], evals:{},
    types:DATA.regs.types.map(t=>({name:t[0],def:parseFloat(t[1])||1,unit:t[2],rule:t[3],cat:catOf(t[0])})),
    set:{grace:1,latePt:1,penPt:10,rewPt:5,absPt:10},
    theme:'auto'};
}
let S,storageOK=true;
function load(){
  try{const r=localStorage.getItem(KEY); if(r){const o=JSON.parse(r); if(o&&Array.isArray(o.emps)&&Array.isArray(o.moves)){S=o;return;}}}catch(e){}
  S=seed();
}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(S)); if(!storageOK){storageOK=true;showBanner();}}
  catch(e){storageOK=false;showBanner();}
  schedulePush();
}
function showBanner(){
  const m=[];
  if(!storageOK)m.push('تعذّر الحفظ التلقائي في هذا المتصفح. صدّر نسخة احتياطية من «الإعدادات» قبل الإغلاق.');
  if(SYNCSTATE==='ro')m.push('عرض فقط: لا تملك صلاحية تعديل البيانات المشتركة، فلن تُحفظ تعديلاتك.');
  if(SYNCSTATE==='err')m.push('تعذّرت المزامنة مؤقتاً، وستُعاد المحاولة تلقائياً.');
  $('#banner').innerHTML=m.map(x=>`<div class="banner">${x}</div>`).join('');
}
const now=new Date();
const U={view:'home',id:null,ym:now.getFullYear()+'-'+pad(now.getMonth()+1),year:now.getFullYear(),q:'',dept:'',incomplete:false,mvType:'',mvQ:'',sumF:'all',showNid:false};
const hist=[];

/* ---------- helpers ---------- */
const emp=id=>S.emps.find(e=>e.id===id);
const typeOf=n=>S.types.find(t=>t.name===n);
const mvVal=m=>m.custom!=null?m.custom:(typeOf(m.type)?typeOf(m.type).def:0);
const active=()=>S.emps.filter(e=>e.status==='على رأس العمل');
const fd=iso=>{if(!iso)return '—';const p=iso.split('-');return `${+p[2]}/${+p[1]}/${p[0]}`;};
const ymLabel=ym=>{const p=ym.split('-');return `${MONTHS[+p[1]-1]} ${p[0]}`;};
function svcText(iso){
  if(!iso)return '—';
  const a=new Date(iso),b=new Date();let m=(b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth();
  if(b.getDate()<a.getDate())m--; if(m<0)return 'لم يبدأ بعد';
  const y=Math.floor(m/12),mm=m%12;
  return [y?`${y} سنة`:'',mm?`${mm} شهر`:''].filter(Boolean).join(' و ')||'أقل من شهر';
}
function ageOf(iso){
  if(!iso)return '';const a=new Date(iso),b=new Date();let y=b.getFullYear()-a.getFullYear();
  if(b.getMonth()<a.getMonth()||(b.getMonth()===a.getMonth()&&b.getDate()<a.getDate()))y--;
  return y>0&&y<100?y+' سنة':'';
}
function missing(e){
  const f=[['hire','تاريخ التعيين'],['birth','تاريخ الميلاد'],['phone','الهاتف'],['nid','الرقم القومي'],['gender','النوع'],['marital','الحالة الاجتماعية'],['address','العنوان'],['qual','المؤهل']];
  return f.filter(x=>!e[x[0]]).map(x=>x[1]);
}
const initial=n=>(n||'?').trim().charAt(0);
const nidMask=n=>n?`${n.slice(0,3)}••••••••${n.slice(-3)}`:'—';

function metrics(eid,prefix){
  const r={rewD:0,rewN:0,penD:0,penN:0,late:0,leaveD:0,sickD:0,leaveN:0,absD:0,absN:0,count:0};
  for(const m of S.moves){
    if(m.emp!==eid||!m.date.startsWith(prefix))continue;
    const t=typeOf(m.type);if(!t)continue;const v=mvVal(m);r.count++;
    if(t.cat==='rew'){r.rewD+=v;r.rewN++;}
    else if(t.cat==='pen'){r.penD+=v;r.penN++;}
    else if(t.cat==='late'){r.late+=v;}
    else if(t.cat==='leave'){if(m.type==='إجازة مرضية')r.sickD+=v;else r.leaveD+=v;r.leaveN++;}
    else if(t.cat==='abs'){r.absD+=v;r.absN++;}
  }
  return r;
}
function statusOf(mt){
  if(mt.penD>0||mt.absD>0)return {k:'bad',t:'مخالفات'};
  if(mt.late>S.set.grace)return {k:'warn',t:'تأخير'};
  if(mt.rewD>0)return {k:'rew',t:'متميز'};
  if(mt.leaveD+mt.sickD>0)return {k:'info',t:'إجازة'};
  return {k:'ok',t:'انضباط تام'};
}
function grade(n){
  if(n>=180)return {t:'ممتاز',k:'ok'};
  if(n>=160)return {t:'جيد جداً',k:'rew'};
  if(n>=140)return {t:'جيد',k:'info'};
  if(n>=120)return {t:'مقبول',k:'warn'};
  return {t:'ضعيف',k:'bad'};
}
function calcNet(eid,ym,scores,adj){
  const mt=metrics(eid,ym),st=S.set;
  const base=scores.reduce((a,b)=>a+(+b||0),0);
  const lateDed=Math.max(0,mt.late-st.grace)*st.latePt;
  const penPts=mt.penD*st.penPt,absPts=mt.absD*st.absPt,rewPts=mt.rewD*st.rewPt;
  const net=Math.max(0,base-lateDed-penPts-absPts+rewPts+(+adj||0));
  return {base,lateDed,penPts,absPts,rewPts,adj:+adj||0,net,grade:grade(net),mt};
}
function evalOf(eid,ym){
  const e=emp(eid);if(!e||!e.evaluated)return null;
  const r=S.evals[ym+'|'+eid];if(!r)return null;
  return calcNet(eid,ym,r.s,r.adj);
}
const ymYear=()=>U.ym.split('-')[0];

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2200);}
function applyTheme(){const r=document.documentElement;if(S.theme==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',S.theme);}

/* ---------- sheets ---------- */
function openSheet(title,body,foot){
  $('#sheetRoot').innerHTML=`<div class="scrim" data-act="closeSheet"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="x" data-act="closeSheet" aria-label="إغلاق">✕</button></header><div class="sbody">${body}</div>${foot?`<footer>${foot}</footer>`:''}</section>`;
  document.body.classList.add('lock');
}
function closeSheet(){$('#sheetRoot').innerHTML='';document.body.classList.remove('lock');}
let pending=null;
function confirmSheet(title,msg,okLabel,fn){
  pending=fn;
  openSheet(title,`<p>${esc(msg)}</p>`,`<button class="btn ghost" data-act="closeSheet">إلغاء</button><button class="btn danger" data-act="confirmOk">${esc(okLabel)}</button>`);
}

/* ---------- views ---------- */
function monthBar(kind){
  if(kind==='year')return `<div class="stepper"><button data-act="stepYear" data-d="1" aria-label="السنة التالية">›</button><b>${U.year}</b><button data-act="stepYear" data-d="-1" aria-label="السنة السابقة">‹</button></div>`;
  return `<div class="stepper"><button data-act="stepMonth" data-d="1" aria-label="الشهر التالي">›</button><b>${ymLabel(U.ym)}</b><button data-act="stepMonth" data-d="-1" aria-label="الشهر السابق">‹</button></div>`;
}
function header(title,sub,bar,back){
  return `<div class="hdr"><div class="hdr-top" style="gap:14px">${back?`<button class="back" data-act="back">‹ رجوع</button>`:''}${title?`<div class="brand">${esc(title)}<small>${esc(sub||'')}</small></div>`:''}</div>${bar||''}</div>`;
}

function vHome(){
  const ym=U.ym,list=active();
  const rows=list.map(e=>{const mt=metrics(e.id,ym);return {e,mt,st:statusOf(mt)};});
  const cnt={ok:0,rew:0,warn:0,bad:0,info:0};rows.forEach(r=>cnt[r.st.k]++);
  const clean=rows.length-cnt.bad-cnt.warn;
  const tot=rows.reduce((a,r)=>({rew:a.rew+r.mt.rewD,pen:a.pen+r.mt.penD,late:a.late+r.mt.late,leave:a.leave+r.mt.leaveD+r.mt.sickD,abs:a.abs+r.mt.absD,n:a.n+r.mt.count}),{rew:0,pen:0,late:0,leave:0,abs:0,n:0});
  const labels={ok:'انضباط تام',rew:'متميز',info:'إجازة',warn:'تأخير',bad:'مخالفات'};
  const depts={};list.forEach(e=>{const d=e.dept||'بدون قسم';(depts[d]=depts[d]||[]).push(e);});
  const dn=Object.keys(depts).sort((a,b)=>depts[b].length-depts[a].length);
  const maxN=Math.max(1,...dn.map(d=>depts[d].length));
  const ins=list.filter(e=>e.insured).length;
  const males=list.filter(e=>e.gender==='ذكر').length,fem=list.filter(e=>e.gender==='أنثى').length;
  const inc=list.filter(e=>missing(e).length).length;
  return `${header('مركز طيبة التخصصي للعيون','منظومة الموارد البشرية',monthBar('month'))}
  <main>
    <div class="hero">
      <div class="big">${clean}<span>من ${rows.length} موظف بلا مخالفات</span></div>
      <p>${tot.n?`${tot.n} حركة مسجلة في ${ymLabel(ym)}`:`لم تُسجَّل حركات في ${ymLabel(ym)} بعد`}</p>
      <div class="dots" role="list">${rows.map(r=>`<button class="dot" role="listitem" data-k="${r.st.k}" data-act="openEmp" data-id="${r.e.id}" aria-label="${esc(r.e.name)}: ${r.st.t}" title="${esc(r.e.name)}"></button>`).join('')}</div>
      <div class="legend">${Object.keys(labels).map(k=>`<span><i data-k="${k}"></i>${labels[k]} ${cnt[k]}</span>`).join('')}</div>
    </div>
    <div class="stats">
      <div><b>${num(tot.rew)}</b><span>أيام مكافآت</span></div>
      <div><b>${num(tot.pen)}</b><span>أيام جزاءات</span></div>
      <div><b>${num(tot.late)}</b><span>ساعات تأخير</span></div>
      <div><b>${num(tot.leave)}</b><span>أيام إجازة</span></div>
      <div><b>${num(tot.abs)}</b><span>أيام غياب</span></div>
    </div>
    <div class="sec"><h2>الأقسام<small>${dn.length} قسم</small></h2>
      <div class="list">${dn.map(d=>{
        const es=depts[d],pn=es.reduce((a,e)=>a+metrics(e.id,ym).penD,0),rw=es.reduce((a,e)=>a+metrics(e.id,ym).rewD,0),ic=es.filter(e=>e.insured).length;
        return `<button class="row" data-act="deptGo" data-d="${esc(d)}"><div class="grow"><div class="t1">${esc(d)}</div><div class="t2">مؤمن عليهم ${ic} من ${es.length}${pn?` · جزاءات ${num(pn)} يوم`:''}${rw?` · مكافآت ${num(rw)} يوم`:''}</div><div class="bar"><i style="width:${es.length/maxN*100}%"></i></div></div><div class="end"><b style="font-size:20px">${es.length}</b></div></button>`;}).join('')}</div>
    </div>
    <div class="sec"><h2>القوى العاملة</h2>
      <div class="card"><div class="kv">
        <div class="k">إجمالي العاملين</div><div class="v">${list.length}</div>
        <div class="k">ذكور / إناث</div><div class="v">${males} / ${fem}</div>
        <div class="k">التغطية التأمينية</div><div class="v">${list.length?Math.round(ins/list.length*100):0}% (${ins} موظف)</div>
        <div class="k">ملفات ناقصة البيانات</div><div class="v">${inc?`<button class="linkbtn" data-act="incGo">${inc} ملف — عرضها</button>`:'لا يوجد'}</div>
      </div></div>
    </div>
  </main>
  <button class="fab" data-act="newMove">＋ حركة جديدة</button>`;
}

function filteredEmps(){
  const q=U.q.trim();
  return S.emps.filter(e=>(!U.dept||e.dept===U.dept)&&(!q||e.name.includes(q)||(e.job||'').includes(q)||(e.phone||'').includes(q))&&(!U.incomplete||missing(e).length));
}
function empRows(){
  const l=filteredEmps();
  if(!l.length)return `<div class="empty"><b>لا توجد نتائج</b>جرّب بحثاً آخر أو غيّر القسم.</div>`;
  return `<div class="list">${l.map(e=>{
    const st=statusOf(metrics(e.id,U.ym)),m=missing(e);
    return `<button class="row" data-act="openEmp" data-id="${e.id}"><div class="av">${esc(initial(e.name))}</div><div class="grow"><div class="t1">${esc(e.name)}</div><div class="t2">${esc(e.job||'—')} · ${esc(e.dept||'—')}</div></div><div class="end">${e.status!=='على رأس العمل'?`<span class="chip" data-k="warn">${esc(e.status)}</span>`:`<span class="chip" data-k="${st.k}">${st.t}</span>`}${m.length?`<div class="t2">⚠ بيانات ناقصة</div>`:''}</div></button>`;}).join('')}</div>`;
}
function vEmps(){
  const depts=[...new Set(S.emps.map(e=>e.dept).filter(Boolean))];
  return `${header('الموظفون',`${S.emps.length} موظف مسجّل`,'')}
  <main>
    <input class="search" id="empq" data-in="empq" type="search" placeholder="ابحث بالاسم أو الوظيفة أو الهاتف" value="${esc(U.q)}" aria-label="بحث">
    <div class="chips">
      <button class="fchip" aria-pressed="${!U.dept&&!U.incomplete}" data-act="deptSet" data-d="">الكل</button>
      ${depts.map(d=>`<button class="fchip" aria-pressed="${U.dept===d}" data-act="deptSet" data-d="${esc(d)}">${esc(d)}</button>`).join('')}
      <button class="fchip" aria-pressed="${U.incomplete}" data-act="incToggle">⚠ بيانات ناقصة</button>
    </div>
    <div id="emplist" style="margin-top:6px">${empRows()}</div>
  </main>
  <button class="fab" data-act="newEmp">＋ موظف جديد</button>`;
}

function vEmp(){
  const e=emp(U.id);if(!e){return header('','', '',true)+`<main><div class="empty"><b>الملف غير موجود</b></div></main>`;}
  const ym=U.ym,mt=metrics(e.id,ym),st=statusOf(mt),ev=evalOf(e.id,ym),yr=ymYear();
  const used=metrics(e.id,yr).leaveD,left=(+e.leave||0)-used;
  const miss=missing(e);
  const mv=S.moves.filter(m=>m.emp===e.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
  return `${header('ملف الموظف','بيانات وسجل الانضباط', '',true)}
  <main>
    <div class="hero-emp"><div class="av">${esc(initial(e.name))}</div><div class="grow"><h1 style="font-size:19px;line-height:1.35">${esc(e.name)}</h1><div class="muted">${esc(e.job||'—')} · ${esc(e.dept||'—')}</div><div class="t2">${esc(e.id)}${e.status!=='على رأس العمل'?` · ${esc(e.status)}`:''}</div></div></div>
    <div class="mini">
      <div><b>${num(left)}</b><span>رصيد الإجازة (من ${num(e.leave)})</span></div>
      <div><b>${ev?num(ev.net):'—'}</b><span>${ev?ev.grade.t:'تقييم '+MONTHS[+ym.split('-')[1]-1]}</span></div>
      <div><b><span class="chip" data-k="${st.k}" style="font-size:13px">${st.t}</span></b><span>${MONTHS[+ym.split('-')[1]-1]}: ${num(mt.rewD)}+ / ${num(mt.penD)}−</span></div>
    </div>
    ${miss.length?`<div class="warnbox">بيانات ناقصة: ${miss.join('، ')}</div>`:''}
    <div class="actions">
      <button class="btn" data-act="newMove" data-id="${e.id}">＋ تسجيل حركة</button>
      ${e.evaluated?`<button class="btn ghost" data-act="evalOpen" data-id="${e.id}">${ev?'تعديل التقييم':'تقييم الشهر'}</button>`:''}
      <button class="btn ghost" data-act="editEmp" data-id="${e.id}">تعديل البيانات</button>
    </div>
    <div class="sec"><h2>البيانات الوظيفية</h2><div class="card"><div class="kv">
      <div class="k">الوظيفة</div><div class="v">${esc(e.job||'—')}</div>
      <div class="k">القسم</div><div class="v">${esc(e.dept||'—')}</div>
      <div class="k">تاريخ التعيين</div><div class="v">${fd(e.hire)}</div>
      <div class="k">مدة الخدمة</div><div class="v">${svcText(e.hire)}</div>
      <div class="k">نظام الدوام</div><div class="v">${esc(e.schedule||'—')}${e.hours?` · ${esc(e.hours)}`:''}</div>
      <div class="k">ساعات العمل</div><div class="v">${esc(e.daily)} ساعات يومياً</div>
      <div class="k">التأمين</div><div class="v">${e.insured?`مؤمن${e.insDate?` منذ ${fd(e.insDate)}`:''}`:'غير مؤمن'}</div>
      <div class="k">مدة التوظيف</div><div class="v">${esc(e.term||'—')}</div>
      <div class="k">الخضوع للتقييم</div><div class="v">${e.evaluated?'نعم':'لا'}</div>
    </div></div></div>
    <div class="sec"><h2>البيانات الشخصية</h2><div class="card"><div class="kv">
      <div class="k">الهاتف</div><div class="v">${e.phone?`<a class="ltr" href="tel:${esc(e.phone)}" style="color:var(--brand)">${esc(e.phone)}</a>`:'—'}</div>
      <div class="k">الرقم القومي</div><div class="v">${e.nid?`<span class="ltr">${U.showNid?esc(e.nid):nidMask(e.nid)}</span> <button class="linkbtn" data-act="nidToggle">${U.showNid?'إخفاء':'إظهار'}</button>`:'—'}</div>
      <div class="k">النوع</div><div class="v">${esc(e.gender||'—')}</div>
      <div class="k">تاريخ الميلاد</div><div class="v">${fd(e.birth)}${ageOf(e.birth)?` (${ageOf(e.birth)})`:''}</div>
      <div class="k">الحالة الاجتماعية</div><div class="v">${esc(e.marital||'—')}</div>
      <div class="k">العنوان</div><div class="v">${esc(e.address||'—')}${e.center?` — ${esc(e.center)}`:''}</div>
      <div class="k">المؤهل</div><div class="v">${esc(e.qual||'—')}${e.edu?` (${esc(e.edu)})`:''}</div>
      ${e.notes?`<div class="k">ملاحظات</div><div class="v">${esc(e.notes)}</div>`:''}
    </div></div></div>
    <div class="sec"><h2>سجل الحركات<small>آخر ${mv.length}</small></h2>
      ${mv.length?`<div class="list">${mv.map(m=>mvRow(m,false)).join('')}</div>`:`<div class="list"><div class="empty"><b>لا توجد حركات</b>سجّل أول حركة لهذا الموظف.</div></div>`}
    </div>
  </main>`;
}

function mvRow(m,showName){
  const t=typeOf(m.type)||{cat:'abs',unit:'يوم'};
  const k={pen:'bad',rew:'rew',late:'warn',leave:'info',abs:'bad'}[t.cat];
  const e=emp(m.emp);
  return `<button class="row" data-act="editMove" data-id="${m.id}"><div class="grow"><div class="t1">${showName?esc(e?e.name:'—'):esc(m.type)}</div><div class="t2">${showName?esc(m.type)+' · ':''}${fd(m.date)}${m.note?' · '+esc(m.note):''}</div></div><div class="end"><span class="chip" data-k="${k}">${num(mvVal(m))} ${esc(t.unit)}</span></div></button>`;
}
function mvRows(){
  let l=S.moves.filter(m=>m.date.startsWith(U.ym));
  if(U.mvType)l=l.filter(m=>m.type===U.mvType);
  const q=U.mvQ.trim();
  if(q)l=l.filter(m=>{const e=emp(m.emp);return (e&&e.name.includes(q))||(m.note||'').includes(q);});
  l.sort((a,b)=>b.date.localeCompare(a.date));
  if(!l.length)return `<div class="list"><div class="empty"><b>لا توجد حركات</b>${S.moves.some(m=>m.date.startsWith(U.ym))?'غيّر الفلتر لعرض حركات أخرى.':'اضغط «حركة جديدة» لتسجيل أول حركة في هذا الشهر.'}</div></div>`;
  return `<div class="muted small" style="margin:4px 0 8px">${l.length} حركة</div><div class="list">${l.map(m=>mvRow(m,true)).join('')}</div>`;
}
function vMoves(){
  return `${header('سجل الحركات','الجزاءات والمكافآت والتأخير والإجازات',monthBar('month'))}
  <main>
    <input class="search" id="mvq" data-in="mvq" type="search" placeholder="ابحث باسم الموظف أو الملاحظة" value="${esc(U.mvQ)}" aria-label="بحث">
    <div class="field" style="margin-top:8px"><select id="mvt" data-in="mvt" aria-label="نوع الحركة"><option value="">كل أنواع الحركات</option>${S.types.map(t=>`<option ${U.mvType===t.name?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
    <div id="mvlist" style="margin-top:8px">${mvRows()}</div>
  </main>
  <button class="fab" data-act="newMove">＋ حركة جديدة</button>`;
}

function sumData(){
  return active().map(e=>{const mt=metrics(e.id,U.ym);return {e,mt,st:statusOf(mt),net:mt.rewD-mt.penD};});
}
function vSummary(){
  let rows=sumData();
  const tot=rows.reduce((a,r)=>({rew:a.rew+r.mt.rewD,pen:a.pen+r.mt.penD,late:a.late+r.mt.late}),{rew:0,pen:0,late:0});
  const topR=[...rows].sort((a,b)=>b.mt.rewD-a.mt.rewD)[0],topP=[...rows].sort((a,b)=>b.mt.penD-a.mt.penD)[0];
  if(U.sumF==='bad')rows=rows.filter(r=>r.st.k==='bad'||r.st.k==='warn');
  if(U.sumF==='good')rows=rows.filter(r=>r.mt.rewD>0);
  if(U.sumF==='act')rows=rows.filter(r=>r.mt.count>0);
  const f=(k,l)=>`<button class="fchip" aria-pressed="${U.sumF===k}" data-act="sumF" data-k="${k}">${l}</button>`;
  return `${header('مجمع الإجراءات','إجماليات الانضباط لكل موظف',monthBar('month'))}
  <main>
    <div class="stats" style="margin-top:4px;grid-template-columns:repeat(3,1fr)">
      <div><b>${num(tot.rew)}</b><span>أيام مكافآت</span></div><div><b>${num(tot.pen)}</b><span>أيام جزاءات</span></div><div><b>${num(tot.late)}</b><span>ساعات تأخير</span></div>
    </div>
    <p class="small muted" style="margin-top:10px">${topR&&topR.mt.rewD>0?`الأكثر تميزاً: <b style="color:var(--ink)">${esc(topR.e.name)}</b> (${num(topR.mt.rewD)} يوم). `:''}${topP&&topP.mt.penD>0?`الأكثر جزاءات: <b style="color:var(--ink)">${esc(topP.e.name)}</b> (${num(topP.mt.penD)} يوم).`:''}${(!topR||topR.mt.rewD<=0)&&(!topP||topP.mt.penD<=0)?'لا توجد مكافآت أو جزاءات في هذا الشهر.':''}</p>
    <div class="chips">${f('all','الكل')}${f('act','لديهم حركات')}${f('bad','مخالفات وتأخير')}${f('good','مكافآت')}</div>
    ${rows.length?`<div class="list">${rows.map(r=>`<button class="row" data-act="openEmp" data-id="${r.e.id}"><div class="grow"><div class="t1">${esc(r.e.name)}</div><div class="t2">${esc(r.e.dept||'—')}</div><div class="t2" style="margin-top:2px">مكافآت ${num(r.mt.rewD)} · جزاءات ${num(r.mt.penD)} · تأخير ${num(r.mt.late)}س · إجازات ${num(r.mt.leaveD+r.mt.sickD)} · غياب ${num(r.mt.absD)}</div></div><div class="end"><span class="chip" data-k="${r.st.k}">${r.st.t}</span><div class="t2">صافي ${r.net>0?'+':''}${num(r.net)}</div></div></button>`).join('')}</div>`:`<div class="list"><div class="empty"><b>لا توجد نتائج</b>لا يوجد موظفون يطابقون هذا الفلتر في ${ymLabel(U.ym)}.</div></div>`}
    <div class="actions"><button class="btn ghost" data-act="exportMonth">تصدير مجمع الشهر (Excel)</button></div>
  </main>`;
}

function vEval(){
  const list=active().filter(e=>e.evaluated);
  const done=list.filter(e=>S.evals[U.ym+'|'+e.id]).length;
  return `${header('التقييم الشهري','10 معايير · الدرجة الكاملة 200',monthBar('month'),true)}
  <main>
    <p class="muted" style="margin-bottom:8px">${done} من ${list.length} موظف تم تقييمهم في ${ymLabel(U.ym)}.</p>
    <div class="list">${list.map(e=>{const ev=evalOf(e.id,U.ym);return `<button class="row" data-act="evalOpen" data-id="${e.id}"><div class="av">${esc(initial(e.name))}</div><div class="grow"><div class="t1">${esc(e.name)}</div><div class="t2">${esc(e.dept||'—')}</div></div><div class="end">${ev?`<b>${num(ev.net)}</b> <span class="chip" data-k="${ev.grade.k}">${ev.grade.t}</span>`:`<span class="chip">لم يُقيَّم</span>`}</div></button>`;}).join('')}</div>
    <div class="actions"><button class="btn ghost" data-act="evalAll">تقييم غير المقيَّمين بالدرجة الكاملة</button></div>
    <p class="small muted" style="margin-top:8px">الإدارة العليا والحسابات خارج نطاق التقييم اليومي. يمكن تغيير ذلك من بيانات كل موظف.</p>
  </main>`;
}

function vAnnual(){
  const y=U.year,list=active();
  const rows=list.map(e=>{
    if(!e.evaluated)return {e,out:true};
    const nets=[];for(let m=1;m<=12;m++){const ev=evalOf(e.id,y+'-'+pad(m));if(ev)nets.push(ev.net);}
    const yt=metrics(e.id,String(y));
    return {e,nets,avg:nets.length?nets.reduce((a,b)=>a+b,0)/nets.length:null,yt};
  });
  return `${header('التقييم السنوي',`متوسط الشهور المُقيَّمة في ${y}`,monthBar('year'),true)}
  <main><div class="list">${rows.map(r=>{
    if(r.out)return `<div class="row"><div class="grow"><div class="t1">${esc(r.e.name)}</div><div class="t2">${esc(r.e.dept||'—')}</div></div><div class="end"><span class="chip">خارج نطاق التقييم</span></div></div>`;
    const g=r.avg!=null?grade(r.avg):null,yt=r.yt;
    return `<button class="row" data-act="openEmp" data-id="${r.e.id}"><div class="grow"><div class="t1">${esc(r.e.name)}</div><div class="t2">${esc(r.e.dept||'—')} · ${r.nets.length} شهر مُقيَّم</div><div class="t2">مكافآت ${num(yt.rewD)} · جزاءات ${num(yt.penD)} · غياب ${num(yt.absD)} · تأخير ${num(yt.late)}س</div></div><div class="end">${g?`<b>${num(r.avg)}</b> <span class="chip" data-k="${g.k}">${g.t}</span>`:`<span class="chip">غير مقيَّم</span>`}</div></button>`;}).join('')}</div>
  <div class="actions"><button class="btn ghost" data-act="exportAll">تصدير كل البيانات (Excel)</button></div></main>`;
}

function vRegs(){
  const R=DATA.regs;
  const pens=R.pen.map(p=>`<div class="rule" data-s="${esc(p[1])}"><b>${esc(p[0])}. ${esc(p[1])}</b><span>${esc(p[2])} · ${esc(p[3])}<br>${esc(p[4])}</span></div>`).join('');
  return `${header('اللائحة','المرجع الرسمي للضوابط والمعايير','',true)}
  <main><div class="list">
    <details open><summary>معايير التقييم (200 درجة)</summary><div class="dbody">${R.criteria.map(c=>`<div class="rule"><b>${esc(c[0])} — ${esc(c[1])} درجة</b><span>${esc(c[3])}</span></div>`).join('')}
      <div class="rule"><b>سلم التقديرات</b><span>${R.scale.map(s=>`${esc(s[0])}: ${esc(s[1])}`).join('<br>')}</span></div>
      <div class="rule"><b>المعادلة</b><span>الصافي = مجموع المعايير − خصم التأخير − خصم الجزاءات − خصم الغياب + درجات المكافآت + التعديل</span></div></div></details>
    <details><summary>الحضور والانصراف</summary><div class="dbody">${R.att.map(a=>`<div class="rule"><b>${esc(a[0])}</b><span>${esc(a[1])}<br>الخصم: ${esc(a[2])} · ${esc(a[3])}</span></div>`).join('')}</div></details>
    <details><summary>المكافآت والحوافز</summary><div class="dbody">${R.rew.map(a=>`<div class="rule"><b>${esc(a[0])}</b><span>${esc(a[1])} · ${esc(a[2])}<br>${esc(a[3])}</span></div>`).join('')}</div></details>
    <details><summary>المخالفات والجزاءات (${R.pen.length})</summary><div class="dbody"><input class="search" data-in="penq" type="search" placeholder="ابحث في المخالفات" aria-label="بحث في المخالفات"><div id="penlist">${pens}</div></div></details>
    <details><summary>أنواع الحركات (${S.types.length})</summary><div class="dbody">${S.types.map(t=>`<div class="rule"><b>${esc(t.name)} — ${num(t.def)} ${esc(t.unit)}</b><span>${esc(t.rule)}</span></div>`).join('')}<p class="small muted" style="margin-top:8px">لتعديل القيم الافتراضية افتح «الإعدادات».</p></div></details>
  </div></main>`;
}

function vSettings(){
  const st=S.set;
  return `${header('الإعدادات','قواعد الاحتساب والنسخ الاحتياطي','',true)}
  <main>
    <div class="sec" style="margin-top:6px"><h2>قواعد احتساب التقييم</h2><div class="card" style="padding-bottom:14px">
      <div class="two"><div class="field"><label>حد السماح بالتأخير (ساعة/شهر)</label><input id="s_grace" type="number" min="0" step="0.5" value="${st.grace}"></div>
      <div class="field"><label>خصم كل ساعة زائدة (درجة)</label><input id="s_late" type="number" min="0" step="0.5" value="${st.latePt}"></div></div>
      <div class="two"><div class="field"><label>درجات خصم كل يوم جزاء</label><input id="s_pen" type="number" min="0" step="0.5" value="${st.penPt}"></div>
      <div class="field"><label>درجات إضافة كل يوم مكافأة</label><input id="s_rew" type="number" min="0" step="0.5" value="${st.rewPt}"></div></div>
      <div class="field"><label>درجات خصم كل يوم غياب بدون إذن</label><input id="s_abs" type="number" min="0" step="0.5" value="${st.absPt}"></div>
      <p class="hint" style="font-size:12.5px;color:var(--muted);margin-top:8px">القيم الأولية مأخوذة من ملف الإكسل: مكافأة اليوم = 5 درجات، وجزاء اليوم = 10 درجات. حد السماح الافتراضي ساعة واحدة حسب «اللوائح».</p>
    </div></div>
    <div class="sec"><h2>القيم الافتراضية للحركات</h2><div class="card" style="padding-bottom:12px">${S.types.map((t,i)=>`<div class="field"><label>${esc(t.name)} (${esc(t.unit)})</label><input data-ti="${i}" type="number" min="0" step="0.25" value="${t.def}"></div>`).join('')}
      <p class="small muted" style="margin-top:8px">تغيير القيمة يطبَّق تلقائياً على كل الحركات التي لم تُعدَّل قيمتها يدوياً.</p></div></div>
    <div class="actions"><button class="btn block" data-act="saveSettings">حفظ الإعدادات</button></div>
    <div class="sec"><h2>المظهر</h2><div class="chips" style="padding-top:0">${[['auto','تلقائي'],['light','فاتح'],['dark','داكن']].map(t=>`<button class="fchip" aria-pressed="${S.theme===t[0]}" data-act="theme" data-t="${t[0]}">${t[1]}</button>`).join('')}</div></div>
    <div class="sec"><h2>النسخ الاحتياطي والتصدير</h2>
      <p class="small muted" style="margin-bottom:8px">${syncText()}</p>
      <div class="actions" style="margin-top:0"><button class="btn ghost" data-act="exportAll">تصدير Excel</button><button class="btn ghost" data-act="backup">نسخة احتياطية</button><button class="btn ghost" data-act="restore">استعادة نسخة</button></div></div>
    <div class="sec"><h2>الحساب</h2><button class="btn ghost block" onclick="window.__logout&&window.__logout()">تسجيل الخروج</button></div>
    <div class="sec"><h2>إعادة الضبط</h2><button class="btn danger block" data-act="resetAll">العودة لبيانات ملف الإكسل الأصلية</button></div>
  </main>`;
}

function vMore(){
  const item=(a,t,s)=>`<button class="row" data-act="go" data-v="${a}"><div class="grow"><div class="t1">${t}</div><div class="t2">${s}</div></div><span class="muted">‹</span></button>`;
  return `${header('المزيد','','')}
  <main><div class="list">
    ${item('eval','التقييم الشهري','10 معايير من 200 درجة لكل موظف')}
    ${item('annual','التقييم السنوي','متوسط الشهور وتجميع الجزاءات والمكافآت')}
    ${item('regs','اللائحة','المعايير والمخالفات والمكافآت والحضور')}
    ${item('settings','الإعدادات','قواعد الاحتساب، النسخ الاحتياطي، المظهر')}
  </div></main>`;
}

/* ---------- render ---------- */
const NAV=[['home','الرئيسية','home'],['emps','الموظفون','people'],['moves','الحركات','moves'],['summary','المجمع','sum'],['more','المزيد','more']];
const NAVOF={home:'home',emps:'emps',emp:'emps',moves:'moves',summary:'summary',more:'more',eval:'more',annual:'more',regs:'more',settings:'more'};
const VIEWS={home:vHome,emps:vEmps,emp:vEmp,moves:vMoves,summary:vSummary,eval:vEval,annual:vAnnual,regs:vRegs,settings:vSettings,more:vMore};
function render(keepScroll){
  const y=window.scrollY;
  $('#app').innerHTML=VIEWS[U.view]()+`<nav class="nav" aria-label="التنقل">${NAV.map(n=>`<button data-act="nav" data-v="${n[0]}" ${NAVOF[U.view]===n[0]?'aria-current="page"':''}>${svg(n[2])}<span>${n[1]}</span></button>`).join('')}</nav>`;
  const hb=$('.hdr');document.documentElement.style.setProperty('--hdr',(hb?hb.offsetHeight:56)+'px');
  window.scrollTo(0,keepScroll?y:0);
}
function go(v,id){hist.push({view:U.view,id:U.id});U.view=v;if(id!==undefined)U.id=id;render();}

/* ---------- forms ---------- */
const EF=[
 ['name','الاسم الكامل','text',1],['job','الوظيفة','text'],['dept','القسم','dept'],['hire','تاريخ التعيين','date'],
 ['leave','رصيد الإجازة السنوي (يوم)','number'],['gender','النوع','gender'],['birth','تاريخ الميلاد','date'],['phone','رقم الهاتف','tel'],
 ['nid','الرقم القومي (14 رقم)','nid'],['marital','الحالة الاجتماعية','text'],['address','العنوان','text'],['center','المركز / المحافظة','text'],
 ['qual','المؤهل الدراسي','text'],['edu','درجة التعليم','text'],['schedule','جدول العمل','text'],['hours','مواعيد الدوام','text'],['daily','ساعات العمل اليومية','number'],['term','مدة التوظيف','text']
];
function openEmpForm(id){
  const e=id?emp(id):{id:'',name:'',job:'',dept:'',hire:'',leave:21,schedule:'جدول ثابت',hours:'من (8:4) عدا الجمعة',insured:false,insDate:'',daily:8,term:'دائم',gender:'',birth:'',phone:'',nid:'',marital:'',address:'',center:'',qual:'',edu:'',status:'على رأس العمل',evaluated:true,notes:''};
  const depts=[...new Set(S.emps.map(x=>x.dept).filter(Boolean))];
  const f=EF.map(([k,l,t,req])=>{
    if(t==='dept')return `<div class="field"><label for="f_dept">${l}</label><input id="f_dept" list="deptlist" value="${esc(e.dept)}"><datalist id="deptlist">${depts.map(d=>`<option value="${esc(d)}">`).join('')}</datalist></div>`;
    if(t==='gender')return `<div class="field"><label for="f_gender">${l}</label><select id="f_gender"><option value="">—</option><option ${e.gender==='ذكر'?'selected':''}>ذكر</option><option ${e.gender==='أنثى'?'selected':''}>أنثى</option></select></div>`;
    const type=t==='nid'?'text':t;
    return `<div class="field"><label for="f_${k}">${l}${req?' *':''}</label><input id="f_${k}" type="${type}" ${t==='nid'?'inputmode="numeric" maxlength="14"':''} ${t==='tel'?'inputmode="tel"':''} value="${esc(e[k])}"></div>`;
  }).join('');
  openSheet(id?'تعديل بيانات الموظف':'موظف جديد',`${f}
    <div class="check"><input type="checkbox" id="f_insured" ${e.insured?'checked':''}><label for="f_insured">مؤمن عليه</label></div>
    <div class="field"><label for="f_insDate">تاريخ التأمين</label><input id="f_insDate" type="date" value="${esc(e.insDate)}"></div>
    <div class="field"><label for="f_status">حالة العمل</label><select id="f_status">${['على رأس العمل','مستقيل','موقوف'].map(s=>`<option ${e.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div class="check"><input type="checkbox" id="f_evaluated" ${e.evaluated?'checked':''}><label for="f_evaluated">يخضع للتقييم الشهري</label></div>
    <div class="field"><label for="f_notes">ملاحظات</label><textarea id="f_notes">${esc(e.notes)}</textarea></div>
    <div id="ferr" class="warnbox" style="display:none"></div>`,
    `${id?`<button class="btn danger" data-act="delEmp" data-id="${id}" style="flex:0 0 auto">حذف</button>`:''}<button class="btn" data-act="saveEmp" data-id="${id||''}">حفظ</button>`);
}
function saveEmp(id){
  const g=k=>$('#f_'+k).value.trim();
  const err=m=>{const b=$('#ferr');b.textContent=m;b.style.display='block';b.scrollIntoView({block:'nearest'});};
  if(!g('name'))return err('اكتب اسم الموظف.');
  const nid=g('nid').replace(/\s/g,'');
  if(nid&&!/^\d{14}$/.test(nid))return err('الرقم القومي يجب أن يتكون من 14 رقماً.');
  const o=id?emp(id):{id:'EMP-'+pad(Math.max(0,...S.emps.map(x=>parseInt(x.id.slice(4))||0))+1),status:'على رأس العمل'};
  EF.forEach(([k,,t])=>{o[k]=t==='number'?(+g(k)||0):g(k);});
  o.nid=nid;o.insured=$('#f_insured').checked;o.insDate=o.insured?g('insDate'):'';o.status=$('#f_status').value;o.evaluated=$('#f_evaluated').checked;o.notes=g('notes');
  if(!id)S.emps.push(o);
  save();closeSheet();toast(id?'تم حفظ التعديلات':'تمت إضافة الموظف');
  if(!id){go('emp',o.id);}else render(true);
}

function openMoveForm(eid,mid){
  const m=mid?S.moves.find(x=>x.id===mid):null;
  const sel=m?m.emp:eid||'';
  const date=m?m.date:(U.ym===now.getFullYear()+'-'+pad(now.getMonth()+1)?now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate()):U.ym+'-01');
  const groups=[['pen','جزاءات'],['rew','مكافآت'],['late','تأخير'],['leave','إجازات'],['abs','غياب']];
  const first=m?m.type:'';
  const opts=groups.map(([c,l])=>`<optgroup label="${l}">${S.types.filter(t=>t.cat===c).map(t=>`<option ${first===t.name?'selected':''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join('');
  openSheet(m?'تعديل حركة':'حركة جديدة',`
    <div class="field"><label for="m_emp">الموظف *</label><select id="m_emp"><option value="">اختر الموظف</option>${[...active()].sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(e=>`<option value="${e.id}" ${sel===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="m_date">التاريخ *</label><input id="m_date" type="date" value="${date}"></div>
    <div class="field"><label for="m_type">نوع الحركة *</label><select id="m_type" data-in="mtype"><option value="">اختر النوع</option>${opts}</select><div class="hint" id="m_rule"></div></div>
    <div class="field"><label for="m_val" id="m_vl">القيمة</label><input id="m_val" type="number" step="0.25" min="0" inputmode="decimal" value="${m&&m.custom!=null?m.custom:''}"><div class="hint">اتركها فارغة لاستخدام القيمة الافتراضية.</div></div>
    <div class="field"><label for="m_note">البيان والملاحظات</label><textarea id="m_note">${esc(m?m.note:'')}</textarea></div>
    <div id="ferr" class="warnbox" style="display:none"></div>`,
    `${m?`<button class="btn danger" data-act="delMove" data-id="${m.id}" style="flex:0 0 auto">حذف</button>`:''}<button class="btn" data-act="saveMove" data-id="${m?m.id:''}">${m?'حفظ التعديل':'تسجيل الحركة'}</button>`);
  mtypeChange();
}
function mtypeChange(){
  const t=typeOf($('#m_type').value);
  $('#m_rule').textContent=t?t.rule:'';
  $('#m_vl').textContent=t?`القيمة (${t.unit}) — الافتراضي ${num(t.def)}`:'القيمة';
  $('#m_val').placeholder=t?num(t.def):'';
}
function saveMove(mid){
  const err=m=>{const b=$('#ferr');b.textContent=m;b.style.display='block';b.scrollIntoView({block:'nearest'});};
  const eid=$('#m_emp').value,date=$('#m_date').value,type=$('#m_type').value,raw=$('#m_val').value.trim();
  if(!eid)return err('اختر الموظف.');if(!date)return err('حدد التاريخ.');if(!type)return err('اختر نوع الحركة.');
  const t=typeOf(type);let custom=null;
  if(raw!==''){const v=parseFloat(raw);if(!(v>=0))return err('القيمة غير صحيحة.');if(v!==t.def)custom=v;}
  const rec={id:mid||uid(),emp:eid,date,type,custom,note:$('#m_note').value.trim()};
  if(mid){const i=S.moves.findIndex(x=>x.id===mid);S.moves[i]=rec;}else S.moves.push(rec);
  save();closeSheet();toast(mid?'تم حفظ التعديل':'تم تسجيل الحركة');
  if(date.slice(0,7)!==U.ym&&!mid){U.ym=date.slice(0,7);}
  render(true);
}

let EV=null;
function openEval(eid){
  const e=emp(eid),R=DATA.regs.criteria,ex=S.evals[U.ym+'|'+eid];
  EV={eid,s:ex?ex.s.slice():R.map(()=>20),adj:ex?ex.adj:0,why:ex?ex.why||'':''};
  openSheet(`تقييم ${e.name}`,`<p class="muted small">${ymLabel(U.ym)} — الدرجة من 20 لكل معيار</p>
    ${R.map((c,i)=>`<div class="crit"><div class="grow"><b>${esc(c[0])}</b></div><div class="step"><button data-act="stp" data-i="${i}" data-d="-1" aria-label="إنقاص">−</button><output id="cs${i}">${EV.s[i]}</output><button data-act="stp" data-i="${i}" data-d="1" aria-label="زيادة">+</button></div></div>`).join('')}
    <div class="two"><div class="field"><label for="e_adj">درجات تعديل (+/−)</label><input id="e_adj" data-in="evadj" type="number" step="0.5" value="${EV.adj}"></div><div class="field"><label for="e_why">سبب التعديل</label><input id="e_why" value="${esc(EV.why)}"></div></div>
    <div class="calc" id="evres"></div>`,
    `<button class="btn" data-act="saveEval">حفظ التقييم</button>`);
  evRecalc();
}
function evRecalc(){
  const c=calcNet(EV.eid,U.ym,EV.s,EV.adj);
  $('#evres').innerHTML=`<div><span>مجموع المعايير</span><b>${num(c.base)} / 200</b></div>
   <div><span>خصم التأخير (${num(c.mt.late)} ساعة)</span><b>−${num(c.lateDed)}</b></div>
   <div><span>خصم الجزاءات (${num(c.mt.penD)} يوم)</span><b>−${num(c.penPts)}</b></div>
   <div><span>خصم الغياب (${num(c.mt.absD)} يوم)</span><b>−${num(c.absPts)}</b></div>
   <div><span>مكافآت (${num(c.mt.rewD)} يوم)</span><b>+${num(c.rewPts)}</b></div>
   <div><span>تعديل</span><b>${c.adj>=0?'+':''}${num(c.adj)}</b></div>
   <div class="net"><span>الصافي</span><span>${num(c.net)} · <span class="chip" data-k="${c.grade.k}">${c.grade.t}</span></span></div>`;
}

/* ---------- export / backup ---------- */
async function dl(name,data){
  try{
    const b=data instanceof Blob?data:new Blob([data],{type:name.endsWith('.json')?'application/json':name.endsWith('.csv')?'text/csv':'application/octet-stream'});
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  }catch(e){if(!e||e.code!=='declined')toast('تعذّر حفظ الملف');}
}
function sheetRows(){
  const E=S.emps.map(e=>({'الكود':e.id,'الاسم':e.name,'الوظيفة':e.job,'القسم':e.dept,'تاريخ التعيين':e.hire,'رصيد الإجازة':e.leave,'جدول العمل':e.schedule,'مواعيد الدوام':e.hours,'التأمين':e.insured?'مؤمن':'غير مؤمن','تاريخ التأمين':e.insDate,'النوع':e.gender,'تاريخ الميلاد':e.birth,'الهاتف':e.phone,'الرقم القومي':e.nid,'الحالة الاجتماعية':e.marital,'العنوان':e.address,'المركز':e.center,'المؤهل':e.qual,'حالة العمل':e.status}));
  const M=[...S.moves].sort((a,b)=>a.date.localeCompare(b.date)).map(m=>{const e=emp(m.emp),t=typeOf(m.type);return {'التاريخ':m.date,'الموظف':e?e.name:'','القسم':e?e.dept:'','نوع الحركة':m.type,'القيمة':mvVal(m),'الوحدة':t?t.unit:'','البيان':m.note};});
  return {E,M};
}
function monthRows(ym){
  return active().map(e=>{const mt=metrics(e.id,ym),ev=evalOf(e.id,ym);return {'الموظف':e.name,'القسم':e.dept,'أيام المكافآت':mt.rewD,'أيام الجزاءات':mt.penD,'ساعات التأخير':mt.late,'أيام الإجازات':mt.leaveD+mt.sickD,'أيام الغياب':mt.absD,'صافي الأيام':mt.rewD-mt.penD,'الحالة':statusOf(mt).t,'تقييم الشهر':ev?ev.net:'','التقدير':ev?ev.grade.t:''};});
}
function mkBook(sheets){
  const wb=XLSX.utils.book_new();
  sheets.forEach(([n,rows])=>{const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{}]);XLSX.utils.book_append_sheet(wb,ws,n);});
  wb.Workbook={Views:[{RTL:true}]};
  return XLSX.write(wb,{bookType:'xlsx',type:'array'});
}
function csv(rows){
  if(!rows.length)return '\ufeff';const h=Object.keys(rows[0]);
  const q=v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
  return '\ufeff'+[h.map(q).join(',')].concat(rows.map(r=>h.map(k=>q(r[k])).join(','))).join('\r\n');
}
function exportAll(){
  const {E,M}=sheetRows(),mr=monthRows(U.ym);
  if(window.XLSX)dl(`hr-export-${U.ym}.xlsx`,mkBook([['الموظفون',E],['الحركات',M],['مجمع '+ymLabel(U.ym),mr]]));
  else dl('hr-employees.csv',csv(E));
}
function exportMonth(){
  const mr=monthRows(U.ym);
  if(window.XLSX)dl(`hr-summary-${U.ym}.xlsx`,mkBook([['المجمع',mr]]));
  else dl(`hr-summary-${U.ym}.csv`,csv(mr));
}

/* ---------- actions ---------- */
const A={
  nav(el){hist.length=0;U.view=el.dataset.v;render();},
  go(el){go(el.dataset.v);},
  back(){const h=hist.pop();if(h){U.view=h.view;U.id=h.id;}else U.view='home';render();},
  closeSheet,
  confirmOk(){const f=pending;pending=null;closeSheet();if(f)f();},
  stepMonth(el){const p=U.ym.split('-').map(Number);const d=new Date(p[0],p[1]-1+(+el.dataset.d),1);U.ym=d.getFullYear()+'-'+pad(d.getMonth()+1);U.year=d.getFullYear();render(true);},
  stepYear(el){U.year+=+el.dataset.d;render(true);},
  openEmp(el){go('emp',el.dataset.id);},
  deptGo(el){U.dept=el.dataset.d;U.incomplete=false;U.q='';hist.length=0;U.view='emps';render();},
  deptSet(el){U.dept=el.dataset.d;if(!U.dept)U.incomplete=false;render(true);},
  incGo(){U.incomplete=true;U.dept='';U.q='';hist.length=0;U.view='emps';render();},
  incToggle(){U.incomplete=!U.incomplete;render(true);},
  nidToggle(){U.showNid=!U.showNid;render(true);},
  newEmp(){openEmpForm();},
  editEmp(el){openEmpForm(el.dataset.id);},
  saveEmp(el){saveEmp(el.dataset.id);},
  delEmp(el){const id=el.dataset.id,e=emp(id);confirmSheet('حذف الموظف',`سيتم حذف ملف «${e.name}» وكل حركاته وتقييماته نهائياً. إذا ترك العمل فالأفضل تغيير حالته إلى «مستقيل».`,'حذف نهائي',()=>{S.emps=S.emps.filter(x=>x.id!==id);S.moves=S.moves.filter(m=>m.emp!==id);Object.keys(S.evals).forEach(k=>{if(k.endsWith('|'+id))delete S.evals[k];});save();hist.length=0;U.view='emps';render();toast('تم حذف الموظف');});},
  newMove(el){openMoveForm(el&&el.dataset.id);},
  editMove(el){openMoveForm(null,el.dataset.id);},
  saveMove(el){saveMove(el.dataset.id);},
  delMove(el){const id=el.dataset.id;closeSheet();S.moves=S.moves.filter(m=>m.id!==id);save();render(true);toast('تم حذف الحركة');},
  sumF(el){U.sumF=el.dataset.k;render(true);},
  evalOpen(el){openEval(el.dataset.id);},
  stp(el){const i=+el.dataset.i,v=Math.min(20,Math.max(0,EV.s[i]+(+el.dataset.d)));EV.s[i]=v;$('#cs'+i).textContent=v;evRecalc();},
  saveEval(){S.evals[U.ym+'|'+EV.eid]={s:EV.s.slice(),adj:+$('#e_adj').value||0,why:$('#e_why').value.trim()};save();closeSheet();toast('تم حفظ التقييم');render(true);},
  evalAll(){const l=active().filter(e=>e.evaluated&&!S.evals[U.ym+'|'+e.id]);if(!l.length){toast('كل الموظفين مُقيَّمون');return;}
    confirmSheet('تقييم جماعي',`سيتم تقييم ${l.length} موظف بالدرجة الكاملة (200) عن ${ymLabel(U.ym)}، ويمكنك تعديل أي تقييم لاحقاً.`,'تأكيد',()=>{l.forEach(e=>{S.evals[U.ym+'|'+e.id]={s:DATA.regs.criteria.map(()=>20),adj:0,why:''};});save();render(true);toast('تم التقييم');});},
  saveSettings(){
    const g=id=>Math.max(0,parseFloat($(id).value)||0);
    S.set={grace:g('#s_grace'),latePt:g('#s_late'),penPt:g('#s_pen'),rewPt:g('#s_rew'),absPt:g('#s_abs')};
    document.querySelectorAll('[data-ti]').forEach(i=>{const v=parseFloat(i.value);if(v>=0)S.types[+i.dataset.ti].def=v;});
    save();toast('تم حفظ الإعدادات');
  },
  theme(el){S.theme=el.dataset.t;applyTheme();save();render(true);},
  exportAll,exportMonth,
  backup(){dl(`hr-backup-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}.json`,JSON.stringify(S));},
  restore(){$('#restoreFile').value='';$('#restoreFile').click();},
  resetAll(){confirmSheet('إعادة الضبط','سيتم مسح كل الحركات والتقييمات وأي تعديلات على بيانات الموظفين، والعودة للبيانات الأصلية من ملف الإكسل.','مسح وإعادة ضبط',()=>{S=seed();save();applyTheme();render();toast('تمت إعادة الضبط');});}
};
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(el&&A[el.dataset.act]){A[el.dataset.act](el,e);}});
document.addEventListener('input',e=>{
  const k=e.target.dataset&&e.target.dataset.in;if(!k)return;
  if(k==='empq'){U.q=e.target.value;$('#emplist').innerHTML=empRows();}
  else if(k==='mvq'){U.mvQ=e.target.value;$('#mvlist').innerHTML=mvRows();}
  else if(k==='mvt'){U.mvType=e.target.value;$('#mvlist').innerHTML=mvRows();}
  else if(k==='mtype')mtypeChange();
  else if(k==='evadj'){EV.adj=+e.target.value||0;evRecalc();}
  else if(k==='penq'){const q=e.target.value.trim();document.querySelectorAll('#penlist .rule').forEach(r=>{r.style.display=!q||r.dataset.s.includes(q)?'':'none';});}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();});
$('#restoreFile').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const o=JSON.parse(r.result);if(!o||!Array.isArray(o.emps)||!Array.isArray(o.moves)||!Array.isArray(o.types))throw 0;
    confirmSheet('استعادة نسخة احتياطية',`سيتم استبدال كل البيانات الحالية بالنسخة المختارة (${o.emps.length} موظف، ${o.moves.length} حركة).`,'استعادة',()=>{S=o;save();applyTheme();render();toast('تمت الاستعادة');});
  }catch(x){toast('الملف ليس نسخة احتياطية صالحة');}};
  r.readAsText(f);
});
