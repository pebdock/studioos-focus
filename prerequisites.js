/* STUDIOOS Focus · prerequisiti mirati (2.0.1)
   Il piano (colonna Consegna) apre i blocchi interessati con una riga
   «PREREQUISITI MIRATI (R13i) · titolo · N′ dentro il blocco · codici · fonti» seguita da «Come: …».
   Qui quella riga diventa: avviso nel check-in del blocco (hook di learning-ui.js), una finestra con
   tracce, pagine, metodo e criterio, e una scheda in Studio › Materiali con i prossimi appuntamenti.
   Il piano resta l'unica fonte: niente calendario scritto nel codice, nessun dato salvato, e i link
   ai documenti arrivano solo dalla colonna Materiali del foglio privato (mai identificativi nel codice). */
(function(root){
  "use strict";
  const doc=root.document;
  const SRC={
    R13:{file:"Fisica_Prerequisiti_Consolidamento_R13.pdf",short:"Scheda matematica R13"},
    R13i:{file:"Prerequisiti_Matematica_FIS_MDP_R13i.pdf",short:"Scheda R13i"},
    T04:{file:"04 - Trig_Deriv_Integr.pdf",short:"Dispensa 04"}};
  // codice → [titolo, scheda, pagina della traccia, pagina della soluzione]
  const CATALOG={
    E1:["Unità e ordini di grandezza","R13",3,6],E2:["Isolare una variabile","R13",3,6],E3:["Logaritmi e tempo caratteristico","R13",3,6],
    E4:["Trigonometria e componenti","R13",3,6],E5:["Prodotti fra vettori","R13",3,6],E6:["Derivare una legge oraria","R13",3,6],
    E7:["Regola della catena","R13",4,7],E8:["Integrare con condizioni iniziali","R13",4,7],E9:["Integrale e lavoro con segno","R13",4,7],
    E10:["Derivata e integrale di 1/r","R13",4,7],E11:["Esponenziale e circuito RC","R13",4,7],E12:["Derivare un flusso","R13",4,7],
    E13:["Derivata vettoriale e moto circolare","R13",5,8],E14:["Ponte al proiettile","R13",5,8],E15:["Integrale e densità","R13",5,8],
    E16:["Derivate e piccoli errori","R13",5,8],
    G1:["Flusso attraverso una superficie piana","R13i",2,5],G2:["Simmetria: sfera e cilindro","R13i",2,5],G3:["Sfera carica uniforme","R13i",2,5],
    R1:["Equazione del circuito RC","R13i",2,5],R2:["Energia dissipata in carica","R13i",2,5],L1:["Prodotto vettoriale e Lorentz","R13i",2,5],
    A1:["Circuitazione su una circonferenza","R13i",2,5],
    S1:["Serie geometrica","R13i",3,6],S2:["Derivare la serie geometrica","R13i",3,6],S3:["Serie esponenziale e Poisson","R13i",3,6],
    S4:["Binomio di Newton","R13i",3,6],I1:["Uniforme: polinomi su un intervallo","R13i",3,6],I2:["Integrale improprio: esponenziale","R13i",4,6],
    I3:["Per parti: momenti dell'esponenziale","R13i",4,6],I4:["Da F alla densità","R13i",4,6],I5:["Standardizzare: cambio di variabile","R13i",4,6],
    I6:["Integrale gaussiano e simmetria","R13i",4,6]};
  // 2.2.0 · basi usate ma non spiegate (MN, BD, OOP, RETI): ricerca testuale nei materiali del corso del 16/11 [Inferenza], da confermare studiando.
  const BASI={"MN": [["Indipendenza lineare, base, spazio vettoriale", "48 pp in 17 file (es. Sistemi Lineari_Metodi_Numerici_Diretti)", "non spiegata", "sistem|diretti|minimi quadrati|svd|qr"], ["Ortogonalità e basi ortonormali", "19 pp in 6 file", "non spiegata", "qr|svd|minimi quadrati|coniugato|discesa"], ["Rango di una matrice", "15 pp in 3 file (Interpolazione, Sovradeterminati)", "non spiegata", "minimi quadrati|sovradetermin|interpolaz|svd"], ["Autovalori, autovettori, raggio spettrale", "23 pp in 7 file (Norme_vettoriali_e_matriciali p. 7–8)", "solo richiami", "norme|condizionamento|jacobi|seidel|sor|iterativ"], ["Matrice inversa e trasposta", "6 pp in 4 file", "non spiegata", "diretti|lu|cholesky|minimi quadrati|norme"], ["Derivata, limite e convergenza (una variabile)", "32 e 63 pp in 13 file", "non spiegata (solo più variabili nei richiami del corso)", "zeri|newton|secant|discesa|gradiente|backprop|training"], ["Teorema del valor medio (Lagrange)", "8 pp in 2 file (Interpolazione)", "non spiegato", "interpolaz|zeri|newton|convergenza"], ["Logaritmo e probabilità di base", "5 e 3 pp (MLP, Introduzione AI)", "non spiegati", "mlp|cnn|ia|training|ottimizzat"], ["Polinomio di Taylor; calcolo in più variabili", "file di richiamo del corso (Polinomio_taylor, CalcoloDifferenziale_Più_Variabili)", "ripasso fornito dal corso", "newton multivariat|sistemi non lineari|discesa|gradiente"]], "BD": [["Operatori logici AND/OR/NOT e tavole di verità", "78 pp in 24 file", "non spiegati", "sql|algebra relazionale|query|null"], ["Insiemi, prodotto cartesiano, relazione", "98 pp in 20 file (03-ModelloER p. 6 lo richiama)", "solo richiami", "modello relazionale|algebra relazionale|er|relazion"], ["Funzione matematica", "24 pp in 10 file", "non spiegata", "normalizzaz|dipendenz|forme normali"], ["Complessità e notazione O", "15 pp in 8 file", "non spiegata", "indici|organizzazion|b-tree|hash|costo"], ["Hashing", "17 pp in 3 file", "non spiegato", "hash|organizzazion|indici"], ["Java di base", "27 pp in 6 file (13-JDBC)", "non spiegato", "jdbc|orm|java"]], "OOP": [["Sintassi imperativa (if, cicli, metodi)", "156 pp in 20 file", "data per nota", "structured|lab|esercizi|classi"], ["Array", "57 pp in 19 file", "non spiegati come concetto", "array|structured|reference|collections"], ["Strutture dati (liste, mappe, insiemi) e hashing", "62 e 41 pp", "solo l'uso in Java", "collections|generic|hash|equals"], ["UML (diagrammi delle classi)", "40 pp in 13 file", "non spiegato", "progettaz|pattern|interfacce|ereditariet|uml"], ["Compilazione, JVM, riga di comando, git e Gradle", "54 e 11 pp; git/Gradle in 00-Intro p. 9", "solo cenni", "lab|build|progetto|gradle|git"]], "RETI": [["Probabilità di base", "55 pp in 8 file (4_ControlloCanale p. 31)", "non spiegata", "controllo|canale|errori|aloha|csma|efficienza|mac"], ["Frequenza, segnali, campionamento", "53 pp in 13 file", "non spiegati", "nyquist|campion|fisico|segnal|laboratorio 1"], ["Binario, esadecimale, XOR e polinomi modulo 2", "14, 10 e 20 pp (4_ControlloCanale, Laboratorio 4)", "solo nel codice del laboratorio", "crc|checksum|parit|controllo|laboratorio 4"], ["Logaritmo e decibel", "7 pp (6_TCP p. 74, Laboratorio 7 p. 102)", "non spiegati", "capacit|attenuaz|laboratorio 7|tcp"]]};
  const HEAD=/(?:^|\n)PREREQUISITI MIRATI(?:\s*\([^)\n]*\))?\s*·\s*([^\n]+)(?:\n([^\n]*))?/;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const okUrl=u=>/^https:\/\/(?:drive|docs)\.google\.com\/[^\s"'<>]+$/i.test(u)?u:"";

  function parse(cons){
    const m=HEAD.exec(String(cons||""));if(!m)return null;
    const parts=m[1].split(/\s+·\s+/).map(x=>x.trim()).filter(Boolean);if(parts.length<3)return null;
    const title=parts[0],mm=/(\d+)\s*′/.exec(parts[1]||""),minutes=mm?+mm[1]:0;
    const last=parts[parts.length-1],hasSrc=/\.pdf\b/i.test(last),codesTxt=parts.slice(2,hasSrc?-1:undefined).join(" · ");
    const optional=new Set();for(const g of codesTxt.matchAll(/\(([^)]*se avanza[^)]*)\)/gi))for(const c of g[1].matchAll(/\b([EGRLASI]\d{1,2})\b/g))optional.add(c[1]);
    const seen=new Set(),codes=[];for(const c of codesTxt.matchAll(/\b([EGRLASI]\d{1,2})\b/g))if(CATALOG[c[1]]&&!seen.has(c[1])){seen.add(c[1]);codes.push({code:c[1],optional:optional.has(c[1])})}
    const extra=codesTxt.replace(/\([^)]*\)/g,"").split(/[,·]/).map(x=>x.trim()).filter(x=>x&&!/^[EGRLASI]\d{1,2}$/.test(x));
    const how=/^\s*Come:/i.test(m[2]||"")?m[2].replace(/^\s*Come:\s*/i,"").trim():"";
    return {title,minutes,codes,extra,sources:hasSrc?last:"",how};
  }
  function item(c){const k=CATALOG[c.code];return {code:c.code,label:k[0],source:k[1],file:SRC[k[1]].file,short:SRC[k[1]].short,page:k[2],sol:k[3],optional:c.optional,
    title:c.code+": "+k[0]+(c.optional?" (se avanza)":"")}}
  function forBlock(block){const p=parse(block&&block.cons);if(!p)return [];return p.codes.map(item).concat(p.extra.map(x=>({code:"",label:x,title:x,optional:false})))}
  function links(block){const out=[],seen=new Set();
    for(const raw of String(block&&block.mats||"").split(/\s*\|\s*|\n/)){const url=okUrl((/(https:\/\/\S+)/.exec(raw)||[])[1]||"");if(!url)continue;
      for(const k of Object.keys(SRC))if(raw.includes(SRC[k].file)&&!seen.has(k)){seen.add(k);out.push({key:k,file:SRC[k].file,short:SRC[k].short,url})}}
    return out}
  function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function blocks(){try{return (root.STUDIOOS_STUDY&&root.STUDIOOS_STUDY.snapshot().blocks)||[]}catch(e){return []}}
  function planned(list,from){return (list||[]).filter(b=>b&&b.stato!=="Rinviato"&&parse(b.cons)&&(!from||String(b.date)>=from)).sort((a,b)=>String(a.date+a.from).localeCompare(String(b.date+b.from)))}
  const dm=d=>String(d||"").slice(8,10)+"/"+String(d||"").slice(5,7);

  function body(b){const p=parse(b.cons),its=forBlock(b).filter(x=>x.code),ls=links(b);
    return `<p class="eyebrow">Prima di questo argomento · ${esc(b.mat)} · ${esc(dm(b.date))} ${esc(b.from)}</p><h2 id="prqTitle">${esc(p.title)}</h2>
      <p class="small mute">${p.minutes?esc(p.minutes)+"′ dentro il blocco, ":""}già compresi nei minuti del piano.</p>
      <ul class="rel-list">${its.map(x=>`<li><b>${esc(x.code)} · ${esc(x.label)}${x.optional?' <span class="pill">se avanza</span>':""}</b><span>${esc(x.short)} · traccia p. ${esc(x.page)}, soluzione p. ${esc(x.sol)}</span></li>`).join("")}
      ${forBlock(b).filter(x=>!x.code).map(x=>`<li><b>${esc(x.label)}</b><span>Vedi le fonti indicate nel blocco.</span></li>`).join("")}</ul>
      ${p.how?`<p class="prq-how">${esc(p.how)}</p>`:""}
      ${p.sources?`<p class="small mute">Fonti: ${esc(p.sources)}</p>`:""}
      ${ls.length?`<div class="prq-links">${ls.map(l=>`<a class="btn ghost" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.short)} ↗</a>`).join("")}</div>`:""}
      <p class="small mute">Prima tenta a foglio bianco, poi il richiamo, poi la soluzione. Se non regge, annotalo in Errori: non proseguire alla cieca.</p>`}
  function open(id){if(!doc)return;const b=blocks().find(x=>x.id===id);if(!b||!parse(b.cons))return;
    let d=doc.getElementById("prqDialog");
    if(!d){d=doc.createElement("dialog");d.id="prqDialog";d.className="rel-dialog prq-dialog";d.setAttribute("aria-labelledby","prqTitle");
      d.addEventListener("click",e=>{if(e.target===d||e.target.closest("[data-prq-close]"))close()});doc.body.appendChild(d)}
    d.innerHTML=`<div class="rel-card">${body(b)}<div class="rel-actions"><button class="btn primary" type="button" data-prq-close>Chiudi</button></div></div>`;
    if(typeof d.showModal==="function"&&!d.open)d.showModal();else d.setAttribute("open","")}
  function close(){const d=doc&&doc.getElementById("prqDialog");if(d){if(typeof d.close==="function"&&d.open)d.close();else d.removeAttribute("open")}}

  let limit=4,paintKey="";
  function card(){if(!doc||doc.getElementById("prqCard"))return;const m=doc.getElementById("mList"),host=m&&m.closest("article");if(!host)return;
    const c=doc.createElement("article");c.className="card prq-card";c.id="prqCard";
    c.innerHTML=`<div class="row"><div class="sp"><span class="eyebrow">Prima degli argomenti</span><h2>Prerequisiti e basi usate</h2></div></div><p class="small mute" id="prqInfo"></p><div id="prqList"></div>`;
    host.before(c)}
  function render(){const el=doc&&doc.getElementById("prqList");if(!el)return;const t=today(),all=planned(blocks()),next=all.filter(b=>String(b.date)>=t);
    const key=t+"|"+limit+"|"+all.map(b=>b.id+b.date+b.from+(b.cons||"").length).join(",");if(key===paintKey)return;paintKey=key;
    const info=doc.getElementById("prqInfo");
    if(!all.length){info.textContent="Nessun prerequisito segnato nel piano.";el.innerHTML="";return}
    info.textContent=`${all.length} momenti nel piano, ognuno subito prima dell'argomento che lo usa. Nessun minuto in più: sono dentro i blocchi.`;
    el.innerHTML=next.slice(0,limit).map(b=>{const p=parse(b.cons),codes=p.codes.map(c=>c.code+(c.optional?"*":"")).join(", ");
      return `<div class="prq-row" style="--sc:var(--${esc(b.mat)},var(--acc))"><span class="prq-when"><b>${esc(dm(b.date))}</b><small>${esc(b.from)}</small></span><span class="prq-main"><span class="prq-subj">${esc(b.mat)}</span><b>${esc(p.title)}</b><small>${esc(codes)}${p.minutes?" · "+esc(p.minutes)+"′":""}</small>${servesFor(b)?`<span class="prq-for">Serve per: ${esc(servesFor(b))}</span>`:""}</span><button class="btn ghost" type="button" data-prereq-open="${esc(b.id)}">Dettagli</button></div>`}).join("")
      +(next.length>limit?`<button class="btn ghost" type="button" id="prqMore">Mostra tutti (${next.length})</button>`:"")
      +(!next.length?'<p class="study-empty">Tutti i prerequisiti in calendario sono già passati.</p>':"")
      +(next.some(b=>parse(b.cons).codes.some(c=>c.optional))?'<p class="small mute">* se avanza tempo</p>':"")
      +glossary(all)}
  function servesFor(b){const m=/serve subito dopo in «([^»]+)»/.exec(String(b.cons||""));if(m)return m[1];const o=/\n2\.\s*\d+ min netti — origine [^,]+, unità «([^»]+)»/.exec(String(b.cons||""));return o?o[1]:""}
  // Basi usate dai corsi ma non spiegate nei loro materiali: catalogo verificato (schede R13/R13i), con i blocchi del piano che le allenano.
  function glossary(all){const use={};for(const b of all){const p=parse(b.cons);if(!p)continue;for(const c of p.codes)(use[c.code]=use[c.code]||[]).push(b)}
    const rows=Object.keys(CATALOG).map(code=>{const k=CATALOG[code],s=SRC[k[1]]||{},u=use[code]||[];
      return `<div class="prq-gl-row"><b>${esc(code)}</b><span><b>${esc(k[0])}</b><small>${esc(s.short||s.file||"")} · p. ${esc(k[2])}, soluzioni p. ${esc(k[3])}</small><small>${u.length?"Nel piano: "+u.map(b=>esc(b.mat)+" "+esc(dm(b.date))).join(", "):"Non ancora nel piano: ripassala se un esercizio la usa"}</small></span></div>`}).join("");
    return `<details class="prq-glossary"><summary>Basi usate ma non spiegate nei corsi (${Object.keys(CATALOG).length+Object.values(BASI).reduce((n,a)=>n+a.length,0)})</summary><p class="small mute">Matematica utile a MDP e ai prerequisiti comuni, non sempre approfondita nei materiali del corso. Sotto, per MN, BD, OOP e Reti, le basi usate dai materiali ma non spiegate lì.</p>${rows}${basi()}</details>`}
  function basi(){const plan=blocks().filter(b=>b&&b.stato!=="Rinviato");const t=today();
    return Object.keys(BASI).map(s=>`<h4 class="prq-gl-subj">${esc(s)}</h4>`+BASI[s].map(([name,ev,st,kw])=>{const rx=new RegExp(kw,"i"),u=plan.filter(b=>b.mat===s&&String(b.date)>=t&&rx.test(String(b.arg||""))).slice(0,4);
      return `<div class="prq-gl-row"><b>•</b><span><b>${esc(name)}</b><small>${esc(st)} · ${esc(ev)}</small><small>${u.length?"Serve per: "+u.map(b=>esc(dm(b.date))+" "+esc(String(b.arg||"").slice(0,40))).join(" · "):"Nessun blocco futuro collegato"}</small></span></div>`}).join("")).join("")
      +'<p class="small mute">Elenco ricavato da una ricerca testuale nei materiali dei corsi [Inferenza]: conferma studiando. Nessun minuto in più: i ripassi vanno fatti nei richiami dei blocchi indicati.</p>'}
  function schedule(){clearTimeout(schedule.t);schedule.t=setTimeout(render,60)}
  function start(){card();render();
    doc.addEventListener("click",e=>{const o=e.target.closest("[data-prereq-open]");if(o){e.preventDefault();open(o.getAttribute("data-prereq-open"))}if(e.target.id==="prqMore"){limit=1000;render()}});
    for(const ev of ["studioos:data-refreshed","studioos:study-data","studioos:view"])root.addEventListener(ev,schedule);
    let n=0;const t=setInterval(()=>{render();if(blocks().length||++n>60)clearInterval(t)},500)}
  root.STUDIOOS_PREREQUISITES={parse,forBlock,links,planned,open,close,CATALOG,SRC,render};
  if(doc){if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",start);else start()}
})(typeof window!=="undefined"?window:globalThis);
