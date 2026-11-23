/* STUDIOOS Focus · Ripasso · esercizi numerici infiniti (1.0.0)
   Ogni generatore crea un esercizio nuovo con soluzione esatta e passaggi, sugli schemi che ricorrono agli esami. */
(function(root){
  "use strict";
  const fact=n=>{let r=1;for(let i=2;i<=n;i++)r*=i;return r};
  const C=(n,k)=>k<0||k>n?0:Math.round(fact(n)/(fact(k)*fact(n-k)));
  const gcd=(a,b)=>b?gcd(b,a%b):a,lcm=(a,b)=>a/gcd(a,b)*b;
  const r2=x=>Math.round(x*100)/100,r3=x=>Math.round(x*1000)/1000,r4=x=>Math.round(x*1e4)/1e4;
  const fmt=x=>{if(!Number.isFinite(x))return String(x);const a=Math.abs(x);if(a!==0&&(a<1e-3||a>=1e6))return x.toExponential(3).replace(".",",");return String(r4(x)).replace(".",",")};
  function erf(x){const t=1/(1+.3275911*Math.abs(x)),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return x>=0?y:-y}
  const Phi=z=>.5*(1+erf(z/Math.SQRT2));
  const pick=(r,a)=>a[Math.floor(r()*a.length)],int=(r,a,b)=>a+Math.floor(r()*(b-a+1));
  const G=[];const add=(id,s,w,tags,title,make)=>G.push({id,s,w,tags,title,make});
  /* ===================== MDP ===================== */
  add("g-mdp-bayes","MDP",5,["bayes","condizionat"],"Bayes con test diagnostico",r=>{
    const p=pick(r,[.01,.02,.05,.1]),se=pick(r,[.9,.95,.98,.99]),sp=pick(r,[.9,.95,.97,.99]);
    const num=se*p,den=se*p+(1-sp)*(1-p),v=num/den;
    return {q:`Una malattia ha prevalenza ${fmt(p)}. Il test ha sensibilità P(+|M)=${fmt(se)} e specificità P(−|non M)=${fmt(sp)}. Calcola P(M|+).`,ans:v,tol:{rel:.01},
      ex:`Probabilità totale: P(+) = ${fmt(se)}·${fmt(p)} + ${fmt(1-sp)}·${fmt(1-p)} = ${fmt(den)}. Bayes: P(M|+) = ${fmt(num)}/${fmt(den)} = ${fmt(v)}.`}});
  add("g-mdp-binom","MDP",4,["binomial","discret"],"Binomiale",r=>{
    const n=int(r,5,12),k=int(r,1,n-1),p=pick(r,[.1,.2,.25,.3,.4,.5]);const v=C(n,k)*Math.pow(p,k)*Math.pow(1-p,n-k);
    return {q:`X ~ Bin(n=${n}, p=${fmt(p)}). Calcola P(X = ${k}).`,ans:v,tol:{rel:.01},ex:`P(X=${k}) = C(${n},${k})·p^${k}·(1−p)^${n-k} = ${C(n,k)}·${fmt(Math.pow(p,k))}·${fmt(Math.pow(1-p,n-k))} = ${fmt(v)}. E[X]=np=${fmt(n*p)}, Var=np(1−p)=${fmt(n*p*(1-p))}.`}});
  add("g-mdp-poisson","MDP",4,["poisson","discret"],"Poisson",r=>{
    const l=pick(r,[.5,1,1.5,2,3,4]),k=int(r,0,4),v=Math.exp(-l)*Math.pow(l,k)/fact(k);
    return {q:`X ~ Poisson(λ=${fmt(l)}). Calcola P(X = ${k}).`,ans:v,tol:{rel:.01},ex:`P(X=k)=e^(−λ)λ^k/k! = e^(−${fmt(l)})·${fmt(Math.pow(l,k))}/${fact(k)} = ${fmt(v)}. E[X]=Var[X]=λ.`}});
  add("g-mdp-exp","MDP",5,["esponenzial","continu","memoria"],"Esponenziale e assenza di memoria",r=>{
    const l=pick(r,[.2,.5,1,2]),s=int(r,1,4),t=int(r,1,3),v=Math.exp(-l*t);
    return {q:`X ~ Exp(λ=${fmt(l)}). Calcola P(X > ${s+t} | X > ${s}).`,ans:v,tol:{rel:.01},ex:`Assenza di memoria: P(X>s+t | X>s) = P(X>t) = e^(−λt) = e^(−${fmt(l*t)}) = ${fmt(v)}.`}});
  add("g-mdp-norm","MDP",5,["normale","continu","standardizz"],"Normale: standardizzazione",r=>{
    const mu=pick(r,[0,10,50,100]),sg=pick(r,[1,2,5,10]),z=pick(r,[-1.5,-1,-.5,.5,1,1.5,2]),a=mu+z*sg,v=Phi(z);
    return {q:`X ~ N(μ=${mu}, σ=${sg}). Calcola P(X ≤ ${fmt(a)}).`,ans:v,tol:{abs:.003},ex:`Z=(X−μ)/σ: z=(${fmt(a)}−${mu})/${sg}=${fmt(z)}. P = Φ(${fmt(z)}) = ${fmt(v)}.`}});
  add("g-mdp-ev","MDP",5,["valore atteso","varianza","attesa"],"Valore atteso e varianza di una v.a. discreta",r=>{
    const off=int(r,-1,2),xs=[off,off+1,off+2,off+4],ws=[int(r,1,4),int(r,1,4),int(r,1,4),int(r,1,4)],S=ws.reduce((a,b)=>a+b),ps=ws.map(w=>w/S);
    const E=xs.reduce((a,x,i)=>a+x*ps[i],0),E2=xs.reduce((a,x,i)=>a+x*x*ps[i],0),V=E2-E*E,askVar=r()<.5;
    return {q:`X assume i valori ${xs.join(", ")} con probabilità ${ws.map(w=>w+"/"+S).join(", ")}. Calcola ${askVar?"Var[X]":"E[X]"}.`,ans:askVar?V:E,tol:{rel:.01},
      ex:`E[X] = Σx·p = ${fmt(E)}. E[X²] = ${fmt(E2)}. Var[X] = E[X²] − E[X]² = ${fmt(V)}.`}});
  add("g-mdp-cov","MDP",4,["covarianz","varianza"],"Varianza di una combinazione lineare",r=>{
    const a=pick(r,[1,2,3,-1,-2]),b=pick(r,[1,2,-1,3]),vx=int(r,1,9),vy=int(r,1,9),cv=pick(r,[-2,-1,0,1,2]),v=a*a*vx+b*b*vy+2*a*b*cv;
    return {q:`Var[X]=${vx}, Var[Y]=${vy}, Cov(X,Y)=${cv}. Calcola Var[${a}X ${b<0?"−":"+"} ${Math.abs(b)}Y].`,ans:v,tol:{abs:.001},ex:`Var[aX+bY] = a²Var X + b²Var Y + 2ab·Cov = ${a*a}·${vx} + ${b*b}·${vy} + ${2*a*b}·${cv} = ${v}.`}});
  add("g-mdp-anagram","MDP",3,["combinator","anagramm","permutazion"],"Anagrammi con lettere ripetute",r=>{
    const w=pick(r,["BANANA","MATEMATICA","STATISTICA","CESENA","PROBABILITA","ANANAS","PAPPAGALLO"]);const cnt={};for(const c of w)cnt[c]=(cnt[c]||0)+1;
    const v=fact(w.length)/Object.values(cnt).reduce((a,k)=>a*fact(k),1);
    return {q:`Quanti anagrammi (anche senza senso) ha la parola ${w}?`,ans:v,tol:{abs:.5},ex:`Permutazioni con ripetizione: ${w.length}! / (${Object.entries(cnt).filter(([,k])=>k>1).map(([c,k])=>k+"! per "+c).join(", ")||"nessuna ripetizione"}) = ${v}.`}});
  add("g-mdp-incl","MDP",3,["inclusione","esclusione"],"Inclusione–esclusione",r=>{
    const N=pick(r,[100,200,500,1000]),a=pick(r,[2,3,4,6]),b=pick(r,[5,7,9,10].filter(x=>x!==a)),v=Math.floor(N/a)+Math.floor(N/b)-Math.floor(N/lcm(a,b));
    return {q:`Quanti interi tra 1 e ${N} sono divisibili per ${a} oppure per ${b}?`,ans:v,tol:{abs:.5},ex:`|A∪B| = ⌊${N}/${a}⌋ + ⌊${N}/${b}⌋ − ⌊${N}/${lcm(a,b)}⌋ = ${Math.floor(N/a)} + ${Math.floor(N/b)} − ${Math.floor(N/lcm(a,b))} = ${v} (mcm(${a},${b})=${lcm(a,b)}).`}});
  add("g-mdp-stars","MDP",3,["combinator","stelle","ripetizion"],"Combinazioni con ripetizione (stelle e barre)",r=>{
    const n=int(r,5,12),k=int(r,3,5),v=C(n+k-1,k-1);
    return {q:`Quante soluzioni intere non negative ha x₁ + … + x${k===3?"₃":k===4?"₄":"₅"} = ${n}?`,ans:v,tol:{abs:.5},ex:`Stelle e barre: C(n+k−1, k−1) = C(${n+k-1}, ${k-1}) = ${v}.`}});
  add("g-mdp-tlc","MDP",4,["tlc","limite centrale","normale"],"Teorema del limite centrale",r=>{
    const n=pick(r,[36,50,64,100]),mu=pick(r,[1,2,5]),sg=pick(r,[1,2,3]),z=pick(r,[-1,.5,1,1.5,2]),s=n*mu+z*sg*Math.sqrt(n),v=Phi(z);
    return {q:`X₁,…,X${n<100?"ₙ":"ₙ"} i.i.d. con n=${n}, media ${mu} e deviazione standard ${sg}. Con il TLC stima P(X₁+…+Xₙ ≤ ${fmt(s)}).`,ans:v,tol:{abs:.004},
      ex:`S ≈ N(nμ, nσ²) = N(${n*mu}, ${n*sg*sg}). z = (${fmt(s)} − ${n*mu})/(${sg}·√${n}) = ${fmt(z)}. P ≈ Φ(${fmt(z)}) = ${fmt(v)}.`}});
  /* ===================== BD ===================== */
  function closure(X,F){const c=new Set(X);let ch=true;while(ch){ch=false;for(const [l,r] of F)if([...l].every(a=>c.has(a))&&[...r].some(a=>!c.has(a))){[...r].forEach(a=>c.add(a));ch=true}}return [...c].sort().join("")}
  function keys(U,F){const res=[];const at=[...U];const n=at.length;const subs=[];for(let m=1;m<(1<<n);m++)subs.push(at.filter((_,i)=>m>>i&1).join(""));subs.sort((a,b)=>a.length-b.length);
    for(const s of subs){if(res.some(k=>[...k].every(a=>s.includes(a))))continue;if(closure(s,F).length===n)res.push(s)}return res}
  function randFD(r){const U="ABCDE";for(let tries=0;tries<50;tries++){const F=[];const m=int(r,3,4);for(let i=0;i<m;i++){let l=[...U].filter(()=>r()<.3).join("")||pick(r,[...U]);if(l.length>3)l=l.slice(0,2);const rest=[...U].filter(a=>!l.includes(a));const rr=rest.filter(()=>r()<.35).join("")||pick(r,rest);F.push([l,rr])}
      const K=keys(U,F);if(K.length&&K.length<=3&&K[0].length<=3)return {U,F,K}}return {U,F:[["A","B"],["B","C"],["CD","E"]],K:["AD"]}}
  const fdTxt=F=>F.map(([l,r])=>l+" → "+r).join(", ");
  add("g-bd-closure","BD",4,["dipendenz","chiusur","normalizz"],"Chiusura di un insieme di attributi",r=>{
    const {U,F}=randFD(r),X=pick(r,[...U])+(r()<.5?pick(r,[...U]):"");const Xs=[...new Set(X)].sort().join(""),v=closure(Xs,F);
    return {q:`R(${[...U].join(", ")}) con F = { ${fdTxt(F)} }. Calcola la chiusura (${Xs})⁺ (scrivi le lettere, es. ABD).`,type:"set",ans:v,
      ex:`Parti da {${Xs}} e applica ogni DF il cui lato sinistro è contenuto nell'insieme finché non cambia più: (${Xs})⁺ = ${v}.`}});
  add("g-bd-keys","BD",4,["chiav","dipendenz","normalizz"],"Chiavi candidate",r=>{
    const {U,F,K}=randFD(r);
    return {q:`R(${[...U].join(", ")}) con F = { ${fdTxt(F)} }. Quante sono le chiavi candidate? (rispondi con un numero)`,ans:K.length,tol:{abs:.5},
      ex:`Le chiavi sono gli insiemi minimali X con X⁺ = ${U}: ${K.join(", ")}. Gli attributi che non compaiono mai a destra stanno in ogni chiave.`}});
  /* ===================== MN ===================== */
  add("g-mn-bisez","MN",4,["bisezion","zeri"],"Bisezione: numero di iterazioni",r=>{
    const a=pick(r,[0,1,-1,2]),b=a+pick(r,[1,2,3,4]),e=pick(r,[1e-2,1e-3,1e-4,1e-5,1e-6]),v=Math.ceil(Math.log2((b-a)/e));
    return {q:`Bisezione su [${a}, ${b}]: quante iterazioni servono al minimo per garantire |x_k − α| ≤ ${fmt(e)}?`,ans:v,tol:{abs:.5},ex:`|x_k − α| ≤ (b−a)/2^k ≤ tol ⇒ k ≥ log₂((b−a)/tol) = log₂(${b-a}/${fmt(e)}) = ${fmt(Math.log2((b-a)/e))} ⇒ k = ${v}.`}});
  add("g-mn-eps","MN",4,["virgola mobile","precision","numeri finiti","macchina"],"Precisione di macchina",r=>{
    const beta=pick(r,[2,10]),t=beta===2?pick(r,[8,10,24,53]):pick(r,[3,4,5,8]),v=.5*Math.pow(beta,1-t);
    return {q:`Sistema F(β=${beta}, t=${t}) con arrotondamento: quanto vale la precisione di macchina u = ½·β^(1−t)?`,ans:v,tol:{rel:.001},ex:`u = ½·${beta}^(1−${t}) = ${fmt(v)}: è il massimo errore relativo di rappresentazione |fl(x)−x|/|x|.`}});
  add("g-mn-cond","MN",5,["condizionament","norm","sistemi lineari"],"Numero di condizione in norma ∞",r=>{
    let a,b,c,d,det;do{a=int(r,1,9);b=int(r,-5,5);c=int(r,-5,5);d=int(r,1,9);det=a*d-b*c}while(Math.abs(det)<1);
    const inv=[[d/det,-b/det],[-c/det,a/det]],n=M=>Math.max(Math.abs(M[0][0])+Math.abs(M[0][1]),Math.abs(M[1][0])+Math.abs(M[1][1])),A=[[a,b],[c,d]],v=n(A)*n(inv);
    return {q:`A = [[${a}, ${b}], [${c}, ${d}]]. Calcola K∞(A) = ‖A‖∞·‖A⁻¹‖∞.`,ans:v,tol:{rel:.01},ex:`‖A‖∞ = max somma per righe dei moduli = ${n(A)}. A⁻¹ = (1/${det})·[[${d}, ${-b}], [${-c}, ${a}]], ‖A⁻¹‖∞ = ${fmt(n(inv))}. K∞ = ${fmt(v)}.`}});
  add("g-mn-errrel","MN",4,["condizionament","errore relativo","perturbaz"],"Stima dell'errore con il condizionamento",r=>{
    const K=pick(r,[10,100,1e3,1e4]),rb=pick(r,[1e-6,1e-5,1e-4]),v=K*rb;
    return {q:`Ax=b con K(A)=${fmt(K)}. Se ‖δb‖/‖b‖ = ${fmt(rb)}, qual è la stima massima di ‖δx‖/‖x‖?`,ans:v,tol:{rel:.001},ex:`‖δx‖/‖x‖ ≤ K(A)·‖δb‖/‖b‖ = ${fmt(K)}·${fmt(rb)} = ${fmt(v)}: più K è grande, più il problema amplifica gli errori sui dati.`}});
  add("g-mn-newton","MN",4,["newton","zeri"],"Un passo del metodo di Newton",r=>{
    const c=pick(r,[2,3,5,7,10]),x0=pick(r,[1,2,3]),f=x0*x0-c,fp=2*x0,v=x0-f/fp;
    return {q:`f(x) = x² − ${c}, x₀ = ${x0}. Calcola x₁ con il metodo di Newton.`,ans:v,tol:{rel:.001},ex:`x₁ = x₀ − f(x₀)/f′(x₀) = ${x0} − (${f})/(${fp}) = ${fmt(v)}. Per radici semplici Newton converge con ordine 2.`}});
  add("g-mn-trap","MN",3,["trapez","integrazion","quadratur"],"Trapezi composita",r=>{
    const n=pick(r,[2,4,5]),k=pick(r,[2,3]),h=1/n;let s=0;for(let i=0;i<=n;i++){const x=i*h,fx=Math.pow(x,k);s+=(i===0||i===n)?fx:2*fx}const v=h/2*s;
    return {q:`Approssima ∫₀¹ x^${k} dx con la formula dei trapezi composita su ${n} sottointervalli.`,ans:v,tol:{rel:.002},ex:`h = 1/${n}; T = h/2·[f(0) + 2Σf(x_i) + f(1)] = ${fmt(v)} (valore esatto 1/${k+1} = ${fmt(1/(k+1))}; errore O(h²)).`}});
  /* ===================== RETI ===================== */
  add("g-reti-delay","RETI",5,["ritard","trasmission","propagazion"],"Ritardo di trasmissione + propagazione",r=>{
    const L=pick(r,[500,1000,1500,4000]),R=pick(r,[1,10,100]),d=pick(r,[100,500,1000,3000]),tx=L*8/(R*1e6),pr=d*1e3/2e8,v=(tx+pr)*1e3;
    return {q:`Pacchetto di ${L} byte su un link da ${R} Mb/s lungo ${d} km (v = 2·10⁸ m/s). Ritardo totale di trasmissione + propagazione, in ms?`,ans:v,tol:{rel:.01},unit:"ms",
      ex:`T_tx = L/R = ${L*8} bit / ${R}·10⁶ = ${fmt(tx*1e3)} ms. T_prop = d/v = ${d*1e3} m / 2·10⁸ = ${fmt(pr*1e3)} ms. Totale ${fmt(v)} ms.`}});
  add("g-reti-sf","RETI",5,["store","multi-hop","ritard"],"Store-and-forward su più link",r=>{
    const N=int(r,2,4),L=pick(r,[1000,1500]),R=pick(r,[1,2,10]),v=N*L*8/(R*1e6)*1e3;
    return {q:`Un pacchetto di ${L} byte attraversa ${N} link uguali da ${R} Mb/s (store-and-forward, propagazione ed elaborazione trascurabili). Ritardo end-to-end in ms?`,ans:v,tol:{rel:.01},unit:"ms",
      ex:`Ogni nodo riceve tutto il pacchetto prima di inoltrarlo: N·L/R = ${N}·${L*8}/${R}·10⁶ s = ${fmt(v)} ms.`}});
  add("g-reti-sw","RETI",5,["stop-and-wait","stop and wait","efficienz","arq"],"Efficienza Stop-and-Wait",r=>{
    const L=pick(r,[1000,1500,8000]),R=pick(r,[1,10,100]),rtt=pick(r,[10,30,60,100]),tx=L*8/(R*1e6)*1e3,v=tx/(rtt+tx);
    return {q:`Stop-and-Wait: trame di ${L} byte, link ${R} Mb/s, RTT = ${rtt} ms (ACK di durata trascurabile). Calcola l'efficienza U.`,ans:v,tol:{rel:.01},
      ex:`T = L/R = ${fmt(tx)} ms. U = T/(RTT + T) = ${fmt(tx)}/(${rtt} + ${fmt(tx)}) = ${fmt(v)}.`}});
  add("g-reti-win","RETI",4,["finestra","banda-ritardo","go-back-n","pipelin"],"Finestra per saturare il link",r=>{
    const L=pick(r,[1000,1500]),R=pick(r,[10,100]),rtt=pick(r,[20,50,100]),tx=L*8/(R*1e6)*1e3,v=Math.ceil((rtt+tx)/tx);
    return {q:`Protocollo a finestra: trame da ${L} byte, link ${R} Mb/s, RTT ${rtt} ms. Finestra minima W (in trame) per avere efficienza 1?`,ans:v,tol:{abs:.5},
      ex:`Serve W·T ≥ RTT + T con T = ${fmt(tx)} ms ⇒ W ≥ ${fmt((rtt+tx)/tx)} ⇒ W = ${v}.`}});
  add("g-reti-seq","RETI",4,["go-back-n","selective repeat","finestra","numerazion"],"Finestra massima con k bit di numerazione",r=>{
    const k=int(r,2,5),sr=r()<.5,v=sr?Math.pow(2,k-1):Math.pow(2,k)-1;
    return {q:`Con numeri di sequenza su ${k} bit, finestra di trasmissione massima per ${sr?"Selective Repeat":"Go-Back-N"}?`,ans:v,tol:{abs:.5},
      ex:sr?`SR: W ≤ 2^(k−1) = ${v} (finestre di trasmissione e ricezione non devono sovrapporsi).`:`GBN: W ≤ 2^k − 1 = ${v} (altrimenti un ACK perso rende ambigua una trama ritrasmessa).`}});
  const ip=n=>[24,16,8,0].map(s=>n>>>s&255).join(".");
  add("g-reti-subnet","RETI",4,["indirizz","subnet","ip","cidr"],"Indirizzi IPv4 e sottoreti",r=>{
    const p=pick(r,[24,25,26,27,28,29]),a=(pick(r,[192,172,10])<<24|int(r,0,255)<<16|int(r,0,255)<<8|int(r,1,254))>>>0,mask=(0xffffffff<<(32-p))>>>0,net=(a&mask)>>>0,bc=(net|~mask)>>>0;
    const k=pick(r,["rete","broadcast","host"]);
    const q=k==="host"?`Quanti host utilizzabili ha una sottorete /${p}?`:`Host ${ip(a)}/${p}: indirizzo di ${k==="rete"?"rete":"broadcast"}?`;
    return {q,type:k==="host"?"num":"str",ans:k==="host"?Math.pow(2,32-p)-2:ip(k==="rete"?net:bc),tol:{abs:.5},
      ex:`Maschera /${p} = ${ip(mask)}. Rete = IP AND maschera = ${ip(net)}; broadcast = rete con bit di host a 1 = ${ip(bc)}; host utilizzabili 2^${32-p} − 2 = ${Math.pow(2,32-p)-2}.`}});
  add("g-reti-hamming","RETI",4,["hamming","distanza","rivelazion","correzion"],"Distanza di Hamming",r=>{
    const d=int(r,2,7),det=r()<.5,v=det?d-1:Math.floor((d-1)/2);
    return {q:`Un codice ha distanza minima di Hamming d = ${d}. Quanti errori per parola può ${det?"rivelare":"correggere"} con certezza?`,ans:v,tol:{abs:.5},
      ex:`Rivela fino a d−1 = ${d-1} errori; corregge fino a ⌊(d−1)/2⌋ = ${Math.floor((d-1)/2)}.`}});
  add("g-reti-rtt","RETI",4,["rtt","timeout","tcp"],"Stima dell'RTT in TCP",r=>{
    const est=pick(r,[80,100,120,150]),smp=est+pick(r,[-40,-20,20,40,60]),v=.875*est+.125*smp;
    return {q:`TCP: EstimatedRTT = ${est} ms, nuovo SampleRTT = ${smp} ms, α = 0,125. Nuovo EstimatedRTT in ms?`,ans:v,tol:{rel:.001},unit:"ms",
      ex:`EstimatedRTT = (1−α)·EstimatedRTT + α·SampleRTT = 0,875·${est} + 0,125·${smp} = ${fmt(v)} ms. Timeout = EstimatedRTT + 4·DevRTT.`}});
  add("g-reti-ss","RETI",5,["slow start","congestion","cwnd","ssthresh"],"Slow start e congestion avoidance",r=>{
    const th=pick(r,[8,16,32]),k=int(r,3,8);let c=1;for(let i=0;i<k;i++)c=c<th?Math.min(c*2,th):c+1;
    return {q:`TCP parte con cwnd = 1 MSS e ssthresh = ${th} MSS, nessuna perdita. Quanto vale cwnd (in MSS) dopo ${k} RTT?`,ans:c,tol:{abs:.5},
      ex:`Slow start: cwnd raddoppia a ogni RTT fino a ssthresh = ${th}; poi congestion avoidance: +1 MSS per RTT. Dopo ${k} RTT: ${c} MSS.`}});
  const api={list:G,byId:Object.fromEntries(G.map(g=>[g.id,g])),Phi,closure,keys};
  root.STUDIOOS_RIPASSO_GEN=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
