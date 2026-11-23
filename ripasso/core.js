/* STUDIOOS Focus · Ripasso · motore (1.0.0) — ripasso/core.js
   Nessuna rete, nessun account: correzione delle risposte aperte, numeri, ripetizione spaziata.
   Funziona anche in Node per i test (module.exports). */
(function(root){
  "use strict";
  /* ---------- testo: normalizzazione, radici, confronto tollerante ---------- */
  const STOP=new Set("il lo la i gli le un uno una di a da in con su per tra fra e ed o od che chi cui del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle col coi si se ne ci vi come quando dove anche pure poi cioe ovvero oppure sia essere e' e è sono era viene vengono ha hanno ho questo questa questi queste quello quella quelli quelle suo sua suoi sue loro piu più molto tanto tutto tutti tutte ogni cosa modo".split(" "));
  const NEG=new Set(["non","mai","nessun","nessuno","nessuna","senza"]),BRK=new Set(["ma","pero","invece","bensi","mentre"]),ONLY=new Set(["solo","soltanto","soltanto","sempre","necessariamente"]);
  const SUF=["azioni","azione","amenti","amento","imenti","imento","mente","zioni","zione","sioni","sione","ita","ismi","ismo","iste","ista","ivi","ive","iva","ivo","ici","ica","ico","iche","ichi","ori","ore","rici","rice","are","ere","ire","ato","ata","ati","ate","uto","uta","uti","ute","ito","iti","ite","ando","endo","ano","ono","e","i","a","o"];
  const GR={"α":"alpha","β":"beta","γ":"gamma","δ":"delta","ε":"epsilon","ϵ":"epsilon","η":"eta","θ":"theta","λ":"lambda","μ":"mu","ν":"nu","ξ":"xi","π":"pi","ρ":"rho","σ":"sigma","ς":"sigma","τ":"tau","φ":"phi","ϕ":"phi","χ":"chi","ψ":"psi","ω":"omega","∇":"nabla","∑":"sigma","∞":"infinito","≠":"diverso"};
  function fold(s){return String(s==null?"":s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[’'`]/g," ").replace(/[α-ωϵϕ∇∑∞≠]/g,c=>GR[c]?" "+GR[c]+" ":c).replace(/(alpha|beta|gamma|delta|epsilon|eta|theta|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|chi|psi|omega) (\d)/g,"$1$2")}
  function tokens(s){return fold(s).replace(/[^a-z0-9.+\-*/^=<>≤≥]+/g," ").replace(/(\D)\.(\D|$)/g,"$1 $2").split(/\s+/).filter(Boolean)}
  function stem(t){if(/^[0-9.+\-*/^=<>]+$/.test(t)||t.length<=4)return t;for(const x of SUF){if(t.endsWith(x)&&t.length-x.length>=3)return t.slice(0,t.length-x.length)}return t}
  function lev(a,b,max){if(Math.abs(a.length-b.length)>max)return max+1;const m=a.length,n=b.length;let p=new Array(n+1);for(let j=0;j<=n;j++)p[j]=j;for(let i=1;i<=m;i++){const c=[i];let best=i;for(let j=1;j<=n;j++){c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));if(c[j]<best)best=c[j]}if(best>max)return max+1;p=c}return p[n]}
  function same(a,b){if(a===b)return true;const L=Math.min(a.length,b.length);if(L>=5&&(a.startsWith(b)||b.startsWith(a)))return true;if(L>=5&&lev(a,b,1)<=1)return true;if(L>=8&&lev(a,b,2)<=2)return true;return false}
  /* negazione: «non», «mai», «senza»… entro 3 parole prima, interrotta da «ma/però/invece»; «non solo/non sempre/non necessariamente» non nega */
  function negated(raw,i){for(let k=i-1;k>=Math.max(0,i-3);k--){if(BRK.has(raw[k]))return false;if(NEG.has(raw[k]))return !(raw[k]==="non"&&ONLY.has(raw[k+1]))}return false}
  function prep(text){const raw=tokens(text);return raw.map((t,i)=>({t,s:stem(t),i,neg:negated(raw,i)}))}
  /* un'alternativa (es. "rapporto incrementale") è presente se tutte le sue parole non vuote compaiono vicine (finestra) */
  function matchAlt(ans,alt,win){
    const want=tokens(alt).filter(t=>!STOP.has(t)).map(stem);if(!want.length)return null;
    const needNeg=tokens(alt).some(t=>NEG.has(t));
    const pos=want.map(w=>ans.filter(a=>same(a.s,w)||same(a.t,w)).map(a=>a.i));
    if(pos.some(p=>!p.length))return null;
    if(want.length===1){const hit=ans.find(a=>a.i===pos[0][0]);if(!needNeg&&hit.neg)return pos[0].length>1?{at:pos[0][1]}:null;return {at:pos[0][0]}}
    for(const start of pos[0]){let ok=true,last=start,neg=ans[start].neg;for(let k=1;k<pos.length;k++){const c=pos[k].find(p=>Math.abs(p-start)<=win);if(c==null){ok=false;break}last=Math.max(last,c)}
      if(ok&&(needNeg||!neg))return {at:start}}
    return null}
  /* correzione di una risposta aperta: concetti = [{k:"etichetta", any:["alternativa", ...], w:1, req:false}] */
  function gradeOpen(answer,item){
    const ans=prep(answer),words=ans.filter(a=>!STOP.has(a.t)).length,concepts=(item.c||[]).map(c=>Array.isArray(c)?{k:c[0],any:c[1],w:c[2]||1,req:!!c[3]}:c);
    if(words<3)return {score:0,verdict:"breve",hit:[],miss:concepts.map(c=>c.k),words};
    const win=Math.max(6,item.win||10);let tot=0,got=0;const hit=[],miss=[];let reqMiss=false;
    for(const c of concepts){tot+=c.w;const m=(c.any||[c.k]).map(a=>matchAlt(ans,a,win)).find(Boolean);if(m){got+=c.w;hit.push(c.k)}else{miss.push(c.k);if(c.req)reqMiss=true}}
    const score=tot?got/tot:0,thr=item.thr||[.75,.45];
    const verdict=score>=thr[0]&&!reqMiss?"giusta":score>=thr[1]?"parziale":"rivedi";
    return {score,verdict,hit,miss,words}}
  /* ---------- numeri: "0,25", "1/4", "25%", "2,5e-3", "1,2·10^-3", "3 ms" ---------- */
  function parseNum(s){
    let t=String(s==null?"":s).trim().toLowerCase().replace(/\s+/g,"").replace(/×|·|\*/g,"x");
    if(!t)return NaN;let pct=false;if(t.endsWith("%")){pct=true;t=t.slice(0,-1)}
    t=t.replace(/[a-zµ]+$/i,m=>/^e/.test(m)?m:"");
    if(/^-?\d+([.,]\d+)?\/-?\d+([.,]\d+)?$/.test(t)){const [a,b]=t.split("/").map(x=>Number(x.replace(",",".")));return b?a/b*(pct?.01:1):NaN}
    const m=/^(-?[\d.,]+)(?:x10\^?\(?(-?\d+)\)?|e(-?\d+))?$/.exec(t);if(!m)return NaN;
    let mant=m[1];if(/,/.test(mant)&&/\./.test(mant))mant=mant.replace(/\./g,"").replace(",",".");else mant=mant.replace(",",".");
    let v=Number(mant);const e=m[2]!=null?Number(m[2]):m[3]!=null?Number(m[3]):0;v=v*Math.pow(10,e);return pct?v/100:v}
  function checkNum(input,expect,tol){const v=parseNum(input);if(!Number.isFinite(v))return {ok:false,parsed:NaN};
    const rel=tol&&tol.rel!=null?tol.rel:.01,abs=tol&&tol.abs!=null?tol.abs:0;const ok=Math.abs(v-expect)<=Math.max(abs,Math.abs(expect)*rel)+1e-12;return {ok,parsed:v}}
  /* ---------- risposta multipla con punteggio ufficiale RETI (Esami on line) ---------- */
  function scoreMulti(chosen,okIdx,nOpts){
    const ok=new Set(okIdx),ch=new Set(chosen);if(okIdx.length===1&&nOpts>1&&!ch.size)return 0;
    const nt=ok.size,nf=nOpts-nt;let s=0;for(const i of ch){if(ok.has(i))s+=1/nt;else s-=nf?1/nf:1}
    return Math.max(0,Math.min(1,s))}
  /* ---------- ripetizione spaziata (SM-2 ridotto, con limite legato alla data d'esame) ---------- */
  const DAY=864e5;
  function review(st,q,now,daysToExam){
    st=Object.assign({n:0,ef:2.5,int:0,due:0,lapses:0,seen:0,hist:[]},st||{});st.seen++;st.last=now;st.hist=(st.hist||[]).concat([q]).slice(-6);
    if(q<3){st.n=0;st.int=0;st.lapses++;st.due=now+10*60e3}
    else{st.n++;st.int=st.n===1?1:st.n===2?3:Math.round(st.int*st.ef);
      st.ef=Math.max(1.3,st.ef+.1-(5-q)*(.08+(5-q)*.02));
      if(q===3)st.int=Math.max(1,Math.round(st.int*.6));
      if(Number.isFinite(daysToExam)&&daysToExam>0)st.int=Math.min(st.int,Math.max(1,Math.round(daysToExam*.25)));
      st.due=now+st.int*DAY}
    return st}
  function mastery(st){if(!st||!st.seen)return 0;const h=st.hist||[];const recent=h.slice(-3);const good=recent.filter(q=>q>=4).length/Math.max(1,recent.length);return Math.min(1,.25*Math.min(st.n,3)+.25*good)}
  /* priorità: peso d'esame × arretrato × urgenza dell'esame × errori passati */
  function priority(item,st,now,daysToExam,rand){
    const w=item.w||3,urg=1+2/(1+Math.max(0,daysToExam)/7);let base;
    if(!st||!st.seen)base=.35;else if(st.due<=now)base=1+Math.min(3,(now-st.due)/DAY/Math.max(1,st.int||1));else base=.05*Math.max(0,1-(st.due-now)/(3*DAY));
    return w*base*urg*(1+.4*((st&&st.lapses)||0))*(.85+.3*(rand==null?Math.random():rand))}
  /* ---------- estrazione numeri pseudo-casuali riproducibili ---------- */
  function rng(seed){let s=(seed>>>0)||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return (s>>>0)/4294967296}}
  const api={fold,tokens,stem,same,gradeOpen,parseNum,checkNum,scoreMulti,review,mastery,priority,rng,DAY};
  root.STUDIOOS_RIPASSO_CORE=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
