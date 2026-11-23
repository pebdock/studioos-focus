/* STUDIOOS Focus · Ripasso · interfaccia (1.0.0)
   Sezione separata da Focus. Legge in sola lettura il piano già scaricato da Focus su questo dispositivo
   (chiavi sfocus.*index) e salva i propri progressi solo in sfocus_rp_state. Nessuna richiesta di rete. */
(function(){
  "use strict";
  const C=window.STUDIOOS_RIPASSO_CORE,G=window.STUDIOOS_RIPASSO_GEN,B=window.STUDIOOS_RIPASSO_BANK;
  const KEY="sfocus_rp_state",DAY=C.DAY,ORDER=["MDP","BD","RETI","OOP","MN"];
  const TYPE={flash:"Scheda",mcq:"Risposta singola",multi:"Più risposte",open:"Risposta aperta",gen:"Esercizio"};
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const pad=n=>String(n).padStart(2,"0"),iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  const nowMin=d=>d.getHours()*60+d.getMinutes(),toMin=t=>{const m=/^(\d{1,2}):(\d{2})/.exec(t||"");return m?Number(m[1])*60+Number(m[2]):NaN};
  const fmtN=x=>{if(typeof x!=="number")return String(x);if(!Number.isFinite(x))return String(x);const a=Math.abs(x);if(a!==0&&(a<1e-3||a>=1e6))return x.toExponential(3).replace(".",",");return String(Math.round(x*1e4)/1e4).replace(".",",")};
  const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

  /* ---------------- memoria locale ---------------- */
  const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
  function fresh(){return {v:1,cards:{},log:[],prefs:{studied:true},over:0}}
  function load(){const s=store.get(KEY,null);if(!s||typeof s!=="object"||typeof s.cards!=="object")return fresh();const b=fresh();return {v:1,cards:s.cards||{},log:Array.isArray(s.log)?s.log:[],prefs:Object.assign(b.prefs,s.prefs||{}),over:Number(s.over)||0}}
  let S=load();
  function save(){S.log=S.log.slice(-4000);if(!store.set(KEY,S))toast("Salvataggio non riuscito: la memoria del browser è piena o bloccata.")}

  /* ---------------- esami e piano ---------------- */
  function daysTo(s,now){const x=B.subjects[s];if(!x)return 99;return Math.ceil((new Date(x.exam+"T09:00:00")-(now||new Date()))/DAY)}
  function open(s,now){const x=B.subjects[s];return !!x&&new Date((x.end||x.exam)+"T23:59:00")>=(now||new Date())}
  function readPlan(){
    let best=null;
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!/^sfocus\.(?:[^]*\.)?index$/.test(k))continue;const v=JSON.parse(localStorage.getItem(k));if(v&&v.idx&&typeof v.idx==="object"&&(!best||(v.at||0)>(best.at||0)))best=v}}catch(e){best=null}
    if(!best)return null;
    const list=Object.values(best.idx).filter(e=>e&&/^\d{4}-\d{2}-\d{2}$/.test(e.date||"")&&ORDER.includes(e.mat)&&e.stato!=="Rinviato");
    list.sort((a,b)=>(a.date+a.from).localeCompare(b.date+b.from));
    const now=new Date(),today=iso(now),yest=iso(new Date(now-DAY)),m=nowMin(now),P={at:best.at,past:{},all:{},cnt:{},recent:[]};
    for(const s of ORDER){P.past[s]=" ";P.all[s]=" ";P.cnt[s]=0}
    for(const e of list){const txt=" "+C.fold((e.arg||"")+" "+(e.cons||""))+" ";P.all[e.mat]+=txt;
      const done=e.date<today||(e.date===today&&toMin(e.from)<=m)||/complet|parzial/i.test(e.stato||"");
      if(done){P.past[e.mat]+=txt;P.cnt[e.mat]++}
      if((e.date===today&&toMin(e.from)<=m)||e.date===yest)P.recent.push(e)}
    P.recent.sort((a,b)=>(b.date+b.from).localeCompare(a.date+a.from));
    return P}
  let PL=readPlan();
  const reCache=new Map();
  function tagRe(t){if(reCache.has(t))return reCache.get(t);const f=C.fold(t).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const r=new RegExp("(^|[^a-z0-9])"+f+(f.length<=3?"($|[^a-z0-9])":""));reCache.set(t,r);return r}
  const tagHits=(x,txt)=>(x.tags||[]).filter(t=>tagRe(t).test(txt)).length;
  /* «già studiato»: un suo argomento compare in un blocco già iniziato; se il piano non lo nomina mai, basta che la materia sia cominciata */
  function studied(x){if(!PL)return true;if(tagHits(x,PL.past[x.s]))return true;return !tagHits(x,PL.all[x.s])&&PL.cnt[x.s]>0}

  /* ---------------- elementi e sessioni ---------------- */
  const ALL=[].concat(B.items.map(it=>({k:"i",id:it.id,s:it.s,w:it.w,tags:it.tags,t:it.t,it})),G.list.map(g=>({k:"g",id:g.id,s:g.s,w:g.w,tags:g.tags,t:"gen",g})));
  const BYID=new Map(ALL.map(x=>[x.id,x]));
  function poolOf(o){const now=new Date();return ALL.filter(x=>o.subj.includes(x.s)&&o.types.includes(x.t)&&(o.ignoreDates||open(x.s,now))&&(!o.studied||studied(x)))}
  function choose(pool,n,o){
    const now=Date.now();
    const ranked=pool.map(x=>{let p=C.priority(x,S.cards[x.id],now,daysTo(x.s),Math.random());if(o.match)p*=1+3*o.match(x);return {x,key:Math.pow(Math.random(),1/Math.max(1e-9,p))}}).sort((a,b)=>b.key-a.key);
    const out=[],cnt={};
    for(const {x} of ranked){const cap=o.caps&&o.caps[x.t];if(cap!=null&&(cnt[x.t]||0)>=cap)continue;out.push(x);cnt[x.t]=(cnt[x.t]||0)+1;if(out.length>=n)break}
    return out}
  const card=x=>{if(x.k!=="g")return x.it.opts?{x,perm:shuffle(x.it.opts.map((_,k)=>k))}:{x};const seed=(Date.now()^Math.floor(Math.random()*4294967296))>>>0;return {x,d:x.g.make(C.rng(seed))}};
  const activeSubj=()=>ORDER.filter(s=>open(s));
  const MODES={
    pausa:{t:"Pausa breve",d:"5′ · 6 domande lampo sulle cose in scadenza",ico:"⏱",n:6,types:["flash","mcq","multi","gen"],caps:{gen:1},studied:true},
    pasto:{t:"Pranzo o cena",d:"12′ · schede e quiz da fare con una mano",ico:"🍽",n:12,types:["flash","mcq","multi"],studied:true},
    fine:{t:"Fine blocco",d:"8′ · richiamo immediato del blocco appena finito",ico:"✓",n:8,types:["flash","mcq","multi","open","gen"],caps:{open:2,gen:2}},
    aperte:{t:"Domande aperte",d:"scrivi con parole tue: il sito controlla i concetti",ico:"✎",n:4,types:["open"],studied:true},
    esercizi:{t:"Esercizi infiniti",d:"numeri sempre nuovi, soluzione passo per passo",ico:"∑",n:8,types:["gen"],studied:true},
    simreti:{t:"Mini Fase 1 · RETI",d:"domande chiuse a tempo con il punteggio ufficiale",ico:"⧗",sim:true},
    simmn:{t:"Teoria MN come all'esame",d:"5 multiple + 2 aperte su IA e training · 25′",ico:"⧗",sim:true},
    libero:{t:"Libero",d:"scegli materie e tipi",ico:"☰",n:15}
  };
  let R=null;
  function start(mode,extra){
    const M=MODES[mode],o=Object.assign({subj:activeSubj(),types:M.types,caps:M.caps,studied:M.studied&&S.prefs.studied},extra||{});
    let list=[],note="",limit=0;
    if(mode==="simreti"){const p=ALL.filter(x=>x.s==="RETI"&&(x.t==="mcq"||x.t==="multi"));list=shuffle(p.slice()).slice(0,30);limit=Math.max(5,Math.round(list.length*1.5));note=`${list.length} domande in ${limit}′ (l'esame vero: 30 in 45′). Ogni risposta vale da 0 a 1: tutte e sole le vere = 1, le false tolgono punti, minimo 0.`}
    else if(mode==="simmn"){const m=shuffle(ALL.filter(x=>x.s==="MN"&&x.t==="mcq")).slice(0,5),a=shuffle(ALL.filter(x=>x.s==="MN"&&x.t==="open"&&x.tags.includes("ia"))).slice(0,2);list=m.concat(a);limit=25;note="Come la parte di teoria della prova di Metodi numerici: 5 domande a risposta multipla e 2 aperte dalla lista ufficiale DomandeIA_25_26."}
    else{
      if(mode==="fine"){const b=extra&&extra.block;if(b){const txt=" "+C.fold((b.arg||"")+" "+(b.cons||""))+" ";o.subj=[b.mat];o.studied=false;o.ignoreDates=true;o.match=x=>{const h=tagHits(x,txt);return h?Math.min(1,h/Math.max(1,Math.min(3,x.tags.length))):0};note=`Blocco ${b.mat} · ${b.from}–${b.to} · ${b.arg||""}`}else if(extra&&extra.subj){o.studied=false;note=B.subjects[o.subj[0]].label}}
      let pool=poolOf(o);
      if(pool.length<(M.n||15)&&o.studied){const wide=poolOf(Object.assign({},o,{studied:false}));if(wide.length>pool.length){note=(note?note+" · ":"")+"Pochi argomenti già studiati: aggiunte anche domande di anteprima.";pool=wide}}
      if(mode==="fine"&&o.match){const hit=pool.filter(x=>o.match(x)>0);if(hit.length>=4)pool=hit.concat(choose(pool.filter(x=>!o.match(x)),3,{}))}
      list=choose(pool,M.n||15,o)}
    if(!list.length){toast("Nessuna domanda disponibile con questi filtri.");return}
    R={mode,o,cards:list.map(card),i:0,res:[],t0:Date.now(),limit,note,deadline:limit?Date.now()+limit*60e3:0,answered:false,sim:!!M.sim,prev:null,again:new Set()};
    show("rpRun");renderRun();tick()}

  /* ---------------- registrazione ---------------- */
  function record(q,score){
    const c=R.cards[R.i],x=c.x,now=Date.now();R.prev=S.cards[x.id]?JSON.parse(JSON.stringify(S.cards[x.id])):null;
    S.cards[x.id]=C.review(S.cards[x.id],q,now,daysTo(x.s));S.log.push({t:now,id:x.id,s:x.s,q});save();
    R.res[R.i]={id:x.id,s:x.s,q,score:score==null?(q>=4?1:q>=3?.5:0):score,t:x.t};R.answered=true;
    if(q<3&&!R.sim&&x.k!=="g"&&x.t!=="open"&&!R.again.has(x.id)){R.again.add(x.id);R.cards.push(Object.assign(card(x),{retry:true}))}}
  function next(){if(!R)return;R.i++;R.answered=false;if(R.i>=R.cards.length)return finish();renderRun()}
  function more(){if(!R)return;const add=choose(poolOf(Object.assign({},R.o,{studied:false})),5,R.o).filter(x=>!R.cards.some(c=>c.x.id===x.id&&x.k!=="g"));if(!add.length){toast("Hai già visto tutte le domande di questo filtro.");return}
    R.cards=R.cards.concat(add.map(card));R.deadline=0;R.limit=0;show("rpRun");renderRun()}

  /* ---------------- interfaccia ---------------- */
  function show(id){for(const v of ["rpHome","rpRun","rpEnd","rpStats"])$(v).hidden=v!==id;window.scrollTo(0,0)}
  let toastT=0;function toast(m){const t=$("rpToast");t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true},3800)}
  const stars=w=>"●".repeat(w)+"○".repeat(5-w);
  const subjPill=s=>`<span class="rp-pill rp-s-${s.toLowerCase()}">${esc(s)}</span>`;
  function dueCount(){const now=Date.now();let n=0;for(const id in S.cards){const st=S.cards[id],x=BYID.get(id);if(x&&open(x.s)&&st.due&&st.due<=now)n++}return n}
  function renderHome(){
    PL=readPlan();const now=new Date();
    $("rpExams").innerHTML=ORDER.map(s=>{const x=B.subjects[s],d=daysTo(s,now);if(!open(s,now))return "";return `<span class="rp-exam rp-s-${s.toLowerCase()}"><b>${s}</b> ${d>0?d+" gg":d===0?"oggi":"orale"}${x.est?" (stima)":""}</span>`}).join("");
    const sg=suggest();const due=dueCount();
    $("rpSuggest").innerHTML=`<div class="rp-sugg-t">Adesso ti conviene</div><button class="rp-big" type="button" data-act="mode" data-mode="${sg.mode}"${sg.block?` data-block="${esc(sg.block.id)}"`:""}><span class="rp-ico" aria-hidden="true">${MODES[sg.mode].ico}</span><span><b>${esc(MODES[sg.mode].t)}</b><small>${esc(sg.why)}</small></span></button><p class="rp-note">${due?`${due} ${due===1?"domanda è":"domande sono"} in scadenza oggi.`:"Nessuna domanda in scadenza: si parte da quelle che ricorrono di più all'esame."}</p>`;
    $("rpModes").innerHTML=Object.entries(MODES).filter(([k])=>k!=="libero").map(([k,m])=>`<button class="rp-mode" type="button" data-act="mode" data-mode="${k}"><span class="rp-ico" aria-hidden="true">${m.ico}</span><b>${esc(m.t)}</b><small>${esc(m.d)}</small></button>`).join("");
    const subj=activeSubj();
    $("rpFreeSubj").innerHTML=ORDER.map(s=>`<button type="button" class="rp-chip rp-s-${s.toLowerCase()}" data-act="chip" data-group="s" data-v="${s}" aria-pressed="${subj.includes(s)}">${s}</button>`).join("");
    $("rpFreeType").innerHTML=Object.entries(TYPE).map(([k,v])=>`<button type="button" class="rp-chip" data-act="chip" data-group="t" data-v="${k}" aria-pressed="true">${v}</button>`).join("");
    $("rpStudied").checked=!!S.prefs.studied;
    const blocks=PL?PL.recent.slice(0,8):[];
    $("rpBlock").innerHTML=blocks.length?blocks.map(b=>`<option value="${esc(b.id)}">${esc(b.date.slice(8)+"/"+b.date.slice(5,7)+" "+b.from+"–"+b.to+" · "+b.mat+" · "+(b.arg||"").slice(0,60))}</option>`).join(""):ORDER.filter(s=>open(s)).map(s=>`<option value="subj:${s}">${s} · ${esc(B.subjects[s].label)}</option>`).join("");
    $("rpPlanNote").textContent=PL?`Piano letto da Focus su questo dispositivo (${new Date(PL.at||0).toLocaleString("it-IT",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}). I progressi del ripasso restano su questo dispositivo: usa Progressi → Esporta per spostarli.`:"Piano non ancora scaricato su questo dispositivo: apri Focus e sincronizza per avere il ripasso di fine blocco e il filtro «già studiato». Tutto il resto funziona già.";
    show("rpHome")}
  function lastBlock(){if(!PL)return null;const now=new Date(),today=iso(now),m=nowMin(now);return PL.recent.find(e=>e.date===today&&toMin(e.from)<=m)||null}
  function suggest(){const now=new Date(),m=nowMin(now),b=lastBlock();
    if(b){const end=toMin(b.to);if(m>=end-5&&m<=end+45)return {mode:"fine",block:b,why:`Hai appena chiuso ${b.mat} · ${b.arg||b.from+"–"+b.to}: richiamalo subito.`}}
    if((m>=12*60+45&&m<14*60+15)||(m>=18*60+45&&m<20*60+15))return {mode:"pasto",why:"Ora di pranzo o cena: schede e quiz da fare con una mano."};
    return {mode:"pausa",why:"Sei domande lampo, prima quelle in scadenza e quelle che escono più spesso."}}

  function head(c){const x=c.x,it=x.it,t=x.k==="g"?x.g.title:"";
    const prog=`${R.i+1} / ${R.cards.length}`;
    return `<div class="rp-meta">${subjPill(x.s)}<span class="rp-type">${esc(TYPE[x.t])}${t?" · "+esc(t):""}</span><span class="rp-sp"></span><span class="rp-freq" title="Frequenza all'esame">${stars(x.w)}</span></div>
      <div class="rp-prog" aria-label="Domanda ${prog}"><span style="width:${Math.round(100*R.i/R.cards.length)}%"></span></div>
      <div class="rp-progt"><span>${prog}</span>${R.deadline?`<span id="rpClock" class="rp-clock"></span>`:""}</div>${R.i===0&&R.note?`<p class="rp-note">${esc(R.note)}</p>`:""}`}
  function renderRun(){const c=R.cards[R.i],x=c.x,it=x.it;let h=head(c);
    if(x.k==="g"){const d=c.d,kind=d.type||"num";h+=`<div class="rp-q">${esc(d.q)}</div><form class="rp-form" data-form="num"><label class="rp-lbl" for="rpNum">La tua risposta${d.unit?" ("+esc(d.unit)+")":""}</label><input id="rpNum" class="rp-input" autocomplete="off" ${kind==="num"?'inputmode="decimal"':'inputmode="text" autocapitalize="characters"'} placeholder="${kind==="num"?"es. 0,25 · 1/4 · 2,5e-3":kind==="set"?"es. ABD":"es. 192.168.1.0"}"><div class="rp-row"><button class="rp-btn primary" type="submit">Verifica</button><button class="rp-btn" type="button" data-act="giveup">Mostra soluzione</button></div></form><div id="rpFb" aria-live="polite"></div>`}
    else if(it.t==="flash")h+=`<div class="rp-q">${esc(it.q)}</div><div class="rp-row"><button class="rp-btn primary" type="button" data-act="reveal">Mostra la risposta</button></div><div id="rpFb" aria-live="polite"></div>`;
    else if(it.t==="mcq"||it.t==="multi"){const multi=it.t==="multi";h+=`<div class="rp-q">${esc(it.q)}</div>${multi?`<p class="rp-hint">Possono essere vere più risposte: seleziona tutte e sole quelle vere.</p>`:""}<div class="rp-opts" role="group">${(c.perm||it.opts.map((_,k)=>k)).map((k,j)=>`<button type="button" class="rp-opt" data-act="${multi?"toggle":"pick"}" data-k="${k}" aria-pressed="false"><span class="rp-k">${String.fromCharCode(65+j)}</span><span>${esc(it.opts[k])}</span></button>`).join("")}</div>${multi?`<div class="rp-row"><button class="rp-btn primary" type="button" data-act="check-multi">Verifica</button></div>`:""}<div id="rpFb" aria-live="polite"></div>`}
    else if(it.t==="open")h+=`<div class="rp-q">${esc(it.q)}</div><form class="rp-form" data-form="open"><label class="rp-lbl" for="rpAns">Rispondi con parole tue (anche per punti)</label><textarea id="rpAns" class="rp-input rp-area" rows="6" spellcheck="true"></textarea><div class="rp-row"><button class="rp-btn primary" type="submit">Correggi</button><button class="rp-btn" type="button" data-act="giveup">Non la so</button></div></form><div id="rpFb" aria-live="polite"></div>`;
    $("rpCard").innerHTML=h;$("rpCard").className="rp-card rp-run rp-s-"+x.s.toLowerCase();
    const f=$("rpCard").querySelector("input,textarea");if(f&&matchMedia("(pointer:fine)").matches)f.focus();tick()}
  const nextBtn=(lbl)=>`<div class="rp-row"><button class="rp-btn primary" type="button" data-act="next">${esc(lbl||(R.i+1<R.cards.length?"Avanti":"Fine"))}</button></div>`;
  function fb(html){$("rpFb").innerHTML=html;const f=$("rpCard").querySelector("form");if(f)for(const e of f.elements)e.disabled=true}
  function onReveal(){const it=R.cards[R.i].x.it;$("rpCard").querySelector('[data-act="reveal"]').remove();
    $("rpFb").innerHTML=`<div class="rp-a">${esc(it.a)}</div><p class="rp-hint">Come è andata? Sii onesto: decide quando rivederla.</p><div class="rp-rate"><button class="rp-btn bad" type="button" data-act="rate" data-q="1">Non la sapevo</button><button class="rp-btn warn" type="button" data-act="rate" data-q="3">A metà</button><button class="rp-btn ok" type="button" data-act="rate" data-q="5">La sapevo</button></div>`}
  function onPick(k){if(R.answered)return;const it=R.cards[R.i].x.it,ok=it.ok.includes(k);
    for(const b of $("rpCard").querySelectorAll(".rp-opt")){const i=Number(b.dataset.k);b.disabled=true;if(it.ok.includes(i))b.classList.add("is-ok");else if(i===k)b.classList.add("is-ko")}
    record(ok?5:1,ok?1:0);$("rpFb").innerHTML=`<div class="rp-verdict ${ok?"ok":"bad"}">${ok?"Giusta":"Sbagliata"}</div>${it.ex?`<p class="rp-ex">${esc(it.ex)}</p>`:""}`+nextBtn()}
  function onCheckMulti(){if(R.answered)return;const it=R.cards[R.i].x.it,btns=[...$("rpCard").querySelectorAll(".rp-opt")],ch=btns.filter(b=>b.getAttribute("aria-pressed")==="true").map(b=>Number(b.dataset.k));
    if(!ch.length){toast("Seleziona almeno una risposta (all'esame una domanda senza risposta vale 0).");return}
    const sc=C.scoreMulti(ch,it.ok,it.opts.length);
    for(const b of btns){const i=Number(b.dataset.k);b.disabled=true;const t=it.ok.includes(i),c=ch.includes(i);b.classList.add(t?(c?"is-ok":"is-miss"):(c?"is-ko":"is-off"))}
    const q=sc>=.999?5:sc>=.5?3:1;record(q,sc);$("rpCard").querySelector('[data-act="check-multi"]').disabled=true;
    $("rpFb").innerHTML=`<div class="rp-verdict ${sc>=.999?"ok":sc>=.5?"warn":"bad"}">Punteggio ufficiale ${fmtN(Math.round(sc*100)/100)} su 1</div><p class="rp-hint">Verde: vera e scelta · contorno verde: vera ma non scelta · rosso: falsa scelta.</p>${it.ex?`<p class="rp-ex">${esc(it.ex)}</p>`:""}`+nextBtn()}
  const showAns=d=>Array.isArray(d.ans)?d.ans.join(", "):typeof d.ans==="number"?fmtN(d.ans):String(d.ans);
  function onNum(give){if(R.answered)return;const d=R.cards[R.i].d,v=$("rpNum").value.trim();let ok=false,parsed="";
    if(!give){if(!v){toast("Scrivi un risultato oppure chiedi la soluzione.");return}
      const kind=d.type||"num";
      if(kind==="num"){const r=C.checkNum(v,d.ans,d.tol);if(!Number.isFinite(r.parsed)){toast("Non riesco a leggere il numero: usa per esempio 0,25 oppure 1/4 oppure 2,5e-3.");return}ok=r.ok;parsed=fmtN(r.parsed)}
      else if(kind==="set"){const norm=s=>[...new Set(String(s).toUpperCase().replace(/[^A-Z]/g,""))].sort().join("");ok=norm(v)===norm(d.ans)}
      else ok=v.replace(/\s+/g,"")===String(d.ans)}
    record(ok?5:1,ok?1:0);
    fb(`<div class="rp-verdict ${ok?"ok":"bad"}">${give?"Soluzione":ok?"Giusta":"Non torna"}</div><p class="rp-a"><b>Risultato:</b> ${esc(showAns(d))}${d.unit?" "+esc(d.unit):""}${parsed&&!ok?` <span class="rp-mute">(hai scritto ${esc(parsed)})</span>`:""}</p>${d.ex?`<p class="rp-ex">${esc(d.ex)}</p>`:""}<div class="rp-row"><button class="rp-btn" type="button" data-act="again">Un altro così</button><button class="rp-btn primary" type="button" data-act="next">${R.i+1<R.cards.length?"Avanti":"Fine"}</button></div>`)}
  const VERD={giusta:["ok","Giusta"],parziale:["warn","Quasi: manca qualcosa"],rivedi:["bad","Da rivedere"],breve:["bad","Troppo breve per valutarla"]};
  function onOpen(give){if(R.answered)return;const it=R.cards[R.i].x.it,v=$("rpAns").value;
    if(give){record(0,0);fb(`<div class="rp-verdict bad">Risposta modello</div><div class="rp-a">${esc(it.model)}</div><p class="rp-hint">Concetti da dire: ${it.c.map(c=>esc(c[0])).join(" · ")}</p>`+nextBtn());return}
    const g=C.gradeOpen(v,it);if(g.verdict==="breve"&&v.trim().length<12){toast("Scrivi almeno una frase: la correzione cerca i concetti chiave.");return}
    const [cls,lbl]=VERD[g.verdict],q=g.verdict==="giusta"?5:g.verdict==="parziale"?3:1;record(q,g.score);
    fb(`<div class="rp-verdict ${cls}">${lbl} · ${Math.round(g.score*100)}% dei concetti</div><div class="rp-concepts">${g.hit.map(k=>`<span class="rp-c ok">✓ ${esc(k)}</span>`).join("")}${g.miss.map(k=>`<span class="rp-c miss">✗ ${esc(k)}</span>`).join("")}</div><details class="rp-model"${g.verdict==="giusta"?"":" open"}><summary>Risposta modello</summary><p>${esc(it.model)}</p></details><div class="rp-row">${g.verdict!=="giusta"?`<button class="rp-btn" type="button" data-act="override">L'avevo detto con altre parole</button>`:""}<button class="rp-btn primary" type="button" data-act="next">${R.i+1<R.cards.length?"Avanti":"Fine"}</button></div><p class="rp-hint">La correzione cerca i concetti chiave e accetta le formulazioni alternative previste, le altre forme della stessa parola e piccoli errori di battitura; un concetto negato («non usa…») non conta. Se l'hai espresso in un modo non previsto, correggila tu.</p>`)}
  function onOverride(){if(!R||!R.res[R.i])return;const x=R.cards[R.i].x;
    S.cards[x.id]=C.review(R.prev,4,Date.now(),daysTo(x.s));S.over=(S.over||0)+1;const l=S.log[S.log.length-1];if(l&&l.id===x.id)l.q=4;save();
    R.res[R.i].q=4;R.res[R.i].score=Math.max(.75,R.res[R.i].score||0);
    const b=$("rpCard").querySelector('[data-act="override"]');if(b){b.disabled=true;b.textContent="Segnata come giusta"}}
  function onAgain(){const c=R.cards[R.i];R.cards.splice(R.i+1,0,card(c.x));next()}
  function tick(){const el=$("rpClock");if(!R||!R.deadline||!el)return;const left=Math.max(0,R.deadline-Date.now()),m=Math.floor(left/60e3),s=Math.floor(left%60e3/1e3);el.textContent=`${pad(m)}:${pad(s)}`;el.classList.toggle("is-late",left<60e3);if(left<=0){toast("Tempo scaduto: le domande non risposte valgono 0.");return finish()}clearTimeout(tick.t);tick.t=setTimeout(tick,1e3)}

  function finish(){clearTimeout(tick.t);const res=R.res.filter(Boolean),n=res.length,good=res.filter(r=>r.q>=4).length,min=Math.max(1,Math.round((Date.now()-R.t0)/60e3));
    let h=`<h2>${esc(MODES[R.mode].t)} · fatto</h2><div class="rp-kpis"><div><b>${good}/${n}</b><small>risposte giuste</small></div><div><b>${min}′</b><small>durata</small></div><div><b>${dueCount()}</b><small>in scadenza ora</small></div></div>`;
    if(R.mode==="simreti"){const tot=R.cards.length,sc=res.reduce((a,r)=>a+(r.score||0),0),s30=sc/tot*30;h+=`<div class="rp-card"><p><b>Fase 1 stimata: ${fmtN(Math.round(s30*10)/10)}/30</b> (${fmtN(Math.round(sc*100)/100)} punti su ${tot} domande, scalati a 30).</p><p class="rp-hint">${s30>=18?"Sopra la soglia di 18/30 per accedere alla Fase 2.":"Sotto la soglia di 18/30: rivedi le domande segnate qui sotto."} Le domande senza risposta valgono 0, come all'esame. [Stima]: la banca qui non è quella ufficiale del docente.</p></div>`}
    if(R.mode==="simmn"){const mc=res.filter(r=>r.t==="mcq"),op=res.filter(r=>r.t==="open");h+=`<div class="rp-card"><p><b>Multiple:</b> ${mc.filter(r=>r.score>=1).length}/${R.cards.filter(c=>c.x.t==="mcq").length} · <b>Aperte:</b> ${op.map(r=>Math.round((r.score||0)*100)+"%").join(" · ")||"non risposte"}</p><p class="rp-hint">All'esame le aperte si scrivono in modo discorsivo: confronta sempre la tua con la risposta modello.</p></div>`}
    const last=new Map();R.cards.forEach((c,i)=>{if(R.res[i]||!last.has(c.x.id))last.set(c.x.id,{c,r:R.res[i]})});const wrong=[...last.values()].filter(z=>!z.r||z.r.q<3);
    if(wrong.length)h+=`<div class="rp-card"><h3>Da rivedere (tornano tra 10 minuti e nei prossimi giorni)</h3><ul class="rp-list">${wrong.map(z=>`<li>${subjPill(z.c.x.s)} ${esc(z.c.x.k==="g"?z.c.x.g.title:z.c.x.it.q)}</li>`).join("")}</ul></div>`;
    else h+=`<p class="rp-note">Nessun errore: queste domande torneranno più avanti, prima del rispettivo esame.</p>`;
    h+=`<div class="rp-row">${R.sim?"":`<button class="rp-btn" type="button" data-act="more">Altre 5</button>`}<button class="rp-btn primary" type="button" data-act="home">Torna al menu</button></div>`;
    $("rpEnd").innerHTML=h;show("rpEnd")}

  function renderStats(){const now=Date.now();let rows="";
    for(const s of ORDER){const xs=ALL.filter(x=>x.s===s),seen=xs.filter(x=>S.cards[x.id]&&S.cards[x.id].seen),m=xs.reduce((a,x)=>a+C.mastery(S.cards[x.id]),0)/Math.max(1,xs.length),due=xs.filter(x=>S.cards[x.id]&&S.cards[x.id].due&&S.cards[x.id].due<=now).length,hard=xs.filter(x=>S.cards[x.id]&&(S.cards[x.id].lapses||0)>=2).length,d=daysTo(s),st=PL?xs.filter(studied).length:xs.length;
      rows+=`<tr><th scope="row">${subjPill(s)}</th><td>${open(s)?(d>0?d+" gg":d===0?"oggi":"orale"):"fatto"}${B.subjects[s].est?"*":""}</td><td>${seen.length}/${xs.length}<small class="rp-mute"> · ${st} studiate</small></td><td><span class="rp-bar"><span style="width:${Math.round(m*100)}%"></span></span> ${Math.round(m*100)}%</td><td>${due}${hard?`<small class="rp-mute"> · ${hard} difficili</small>`:""}</td></tr>`}
    const today=iso(new Date()),lt=S.log.filter(l=>iso(new Date(l.t))===today),days=new Set(S.log.map(l=>iso(new Date(l.t))));let streak=0;for(let d=new Date();days.has(iso(d));d=new Date(d-DAY))streak++;
    const worst=Object.entries(S.cards).filter(([id,st])=>BYID.has(id)&&(st.lapses||0)>0).sort((a,b)=>(b[1].lapses||0)-(a[1].lapses||0)).slice(0,8);
    $("rpStats").innerHTML=`<div class="rp-card"><h2>Progressi</h2><div class="rp-kpis"><div><b>${lt.length}</b><small>risposte oggi</small></div><div><b>${lt.length?Math.round(100*lt.filter(l=>l.q>=4).length/lt.length):0}%</b><small>giuste oggi</small></div><div><b>${streak}</b><small>giorni di fila</small></div><div><b>${dueCount()}</b><small>in scadenza</small></div></div>
      <div class="rp-scroll"><table class="rp-table"><thead><tr><th scope="col">Materia</th><th scope="col">Esame</th><th scope="col">Viste</th><th scope="col">Padronanza</th><th scope="col">Scadute</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="rp-hint">Padronanza: risposte giuste di fila con intervalli crescenti (1, 3, 7… giorni), mai oltre un quarto dei giorni che mancano all'esame. *Data RETI stimata: aggiornala quando esce l'appello. Totale domande: ${B.items.length} in banca + ${G.list.length} generatori di esercizi.</p></div>
      ${worst.length?`<div class="rp-card"><h3>Le più sbagliate</h3><ul class="rp-list">${worst.map(([id,st])=>{const x=BYID.get(id);return `<li>${subjPill(x.s)} ${esc(x.k==="g"?x.g.title:x.it.q)} <span class="rp-mute">· ${st.lapses} ${st.lapses===1?"errore":"errori"}</span></li>`}).join("")}</ul></div>`:""}
      <div class="rp-card"><h3>Dati di questo dispositivo</h3><p class="rp-hint">Il ripasso salva solo qui (chiave sfocus_rp_state), non su Sheets. Esporta per portarlo su un altro dispositivo.</p><div class="rp-row"><button class="rp-btn" type="button" data-act="export">Esporta</button><label class="rp-btn rp-file">Importa<input id="rpImport" type="file" accept="application/json,.json"></label><button class="rp-btn bad" type="button" data-act="reset">Azzera</button></div></div>
      <div class="rp-row"><button class="rp-btn primary" type="button" data-act="home">Torna al menu</button></div>`;
    show("rpStats")}
  function doExport(){const blob=new Blob([JSON.stringify({app:"studioos-ripasso",version:B.version,exported:new Date().toISOString(),state:S},null,1)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="ripasso-"+iso(new Date())+".json";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
  function doImport(file){const fr=new FileReader();fr.onload=()=>{try{const j=JSON.parse(fr.result),st=j&&j.state;if(!st||typeof st.cards!=="object")throw new Error("formato");let n=0;
      for(const [id,c] of Object.entries(st.cards)){if(!c||typeof c!=="object")continue;const mine=S.cards[id];if(!mine||(c.last||0)>(mine.last||0)){S.cards[id]=c;n++}}
      const seen=new Set(S.log.map(l=>l.t+"|"+l.id));for(const l of (st.log||[]))if(l&&!seen.has(l.t+"|"+l.id))S.log.push(l);S.log.sort((a,b)=>a.t-b.t);save();toast(`Importate ${n} domande aggiornate.`);renderStats()}catch(e){toast("File non valido: serve un export del Ripasso.")}};fr.readAsText(file)}
  let resetArm=0;function doReset(btn){if(Date.now()-resetArm>4000){resetArm=Date.now();btn.textContent="Tocca di nuovo per azzerare";return}S=fresh();save();toast("Progressi del ripasso azzerati.");renderStats()}

  /* ---------------- eventi ---------------- */
  document.addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(!b||b.disabled)return;const a=b.dataset.act;
    if(a==="mode"){const m=b.dataset.mode;if(m==="fine"){let blk=null;const id=b.dataset.block||$("rpBlock").value||"";if(id.startsWith("subj:"))return start("fine",{subj:[id.slice(5)]});if(PL)blk=PL.recent.find(x=>x.id===id)||lastBlock();if(blk)return start("fine",{block:blk});const s=activeSubj()[0];return start("fine",{subj:[s]})}return start(m)}
    if(a==="free"){const sel=g=>[...document.querySelectorAll(`[data-group="${g}"][aria-pressed="true"]`)].map(x=>x.dataset.v);const subj=sel("s"),types=sel("t");if(!subj.length||!types.length)return toast("Scegli almeno una materia e un tipo.");S.prefs.studied=$("rpStudied").checked;save();return start("libero",{subj,types,studied:S.prefs.studied,ignoreDates:true})}
    if(a==="chip"){b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")==="true"?"false":"true");return}
    if(a==="reveal")return onReveal();
    if(a==="rate"){if(R.answered)return;const q=Number(b.dataset.q);record(q);return next()}
    if(a==="pick")return onPick(Number(b.dataset.k));
    if(a==="toggle"){if(R.answered)return;b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")==="true"?"false":"true");return}
    if(a==="check-multi")return onCheckMulti();
    if(a==="giveup")return R.cards[R.i].x.k==="g"?onNum(true):onOpen(true);
    if(a==="override")return onOverride();
    if(a==="again")return onAgain();
    if(a==="next")return next();
    if(a==="more")return more();
    if(a==="home"){R=null;clearTimeout(tick.t);return renderHome()}
    if(a==="stats")return renderStats();
    if(a==="quit"){if(R&&R.res.filter(Boolean).length)return finish();R=null;clearTimeout(tick.t);return renderHome()}
    if(a==="export")return doExport();
    if(a==="reset")return doReset(b)});
  document.addEventListener("submit",e=>{const f=e.target.closest("form[data-form]");if(!f)return;e.preventDefault();if(f.dataset.form==="num")onNum(false);else onOpen(false)});
  document.addEventListener("change",e=>{if(e.target.id==="rpImport"&&e.target.files[0])doImport(e.target.files[0]);if(e.target.id==="rpStudied"){S.prefs.studied=e.target.checked;save()}});
  document.addEventListener("keydown",e=>{if(!R||$("rpRun").hidden||e.altKey||e.ctrlKey||e.metaKey)return;const tag=(e.target.tagName||"").toLowerCase();
    if(tag==="textarea"){if(e.key==="Enter"&&(e.ctrlKey||e.metaKey))onOpen(false);return}if(tag==="input")return;
    const c=R.cards[R.i],t=c.x.t,q=$("rpCard");
    if(R.answered&&(e.key==="Enter"||e.key===" ")){const n=q.querySelector('[data-act="next"]');if(n){e.preventDefault();n.click()}return}
    if(t==="flash"){if((e.key===" "||e.key==="Enter")&&q.querySelector('[data-act="reveal"]')){e.preventDefault();onReveal()}else if(/^[123]$/.test(e.key)&&q.querySelector('[data-act="rate"]')){record([1,3,5][Number(e.key)-1]);next()}}
    else if((t==="mcq"||t==="multi")&&/^[1-6a-fA-F]$/.test(e.key)){const k=/\d/.test(e.key)?Number(e.key)-1:e.key.toLowerCase().charCodeAt(0)-97;const o=q.querySelectorAll(".rp-opt")[k];if(o)o.click()}
    else if(t==="multi"&&e.key==="Enter")onCheckMulti()});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!$("rpHome").hidden)renderHome()});

  /* ---------------- avvio ---------------- */
  try{const st=JSON.parse(localStorage.getItem("sfocus.settings")||"{}");document.documentElement.classList.toggle("light",st.theme==="light");document.documentElement.classList.toggle("dark",st.theme==="dark")}catch(e){}
  const qs=new URLSearchParams(location.search),m0=qs.get("modo");
  renderHome();
  if(m0&&MODES[m0]){if(m0==="fine"){const id=qs.get("blocco"),blk=PL&&(PL.recent.find(x=>x.id===id)||lastBlock());if(blk)start("fine",{block:blk});else start("pausa")}else start(m0)}
  if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js",{scope:"./"}).catch(()=>{});
  window.STUDIOOS_RIPASSO={state:()=>S,start,plan:()=>PL,_R:()=>R};
})();
