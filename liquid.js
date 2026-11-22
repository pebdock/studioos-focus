/* Focus 1.7 · Liquid Glass per il web (approssimazione, non il renderer di Apple).
   - Materiale su ogni controllo cliccabile: tinta, sfocatura, riflesso speculare sul bordo,
     lensing (luce concentrata in alto, rifratta in basso), ombra adattiva, bagliore dal punto di tocco.
   - Rifrazione reale dei bordi con feDisplacementMap solo dove backdrop-filter accetta un filtro SVG
     (Chromium). Su Safari/iPhone resta il materiale senza deformazione: nessuna promessa diversa.
   - Sfondo fluido: macchie e una «marea» che salgono con l'avanzamento del timer e prendono il colore
     della materia; più calmo in pausa, fermo se la sessione è sospesa o se il movimento è ridotto.
   - Organizzazione: stato dei collegamenti in un menu, impostazioni tecniche raccolte e richiuse,
     scelte brevi come controlli segmentati. Nessuna logica dell'app cambia: gli elementi originali
     restano nel documento e i controlli segmentati scrivono nel select esistente. */
(function(root){
  "use strict";
  const doc=root.document;if(!doc)return;
  const html=doc.documentElement;
  const GLASS=".btn,.chipbtn,.ckb,select,summary,.lg-seg button,#lgStatus,[role=button]:not(.tab),.pill[data-pwa],.sess .btn";
  const SUBJ=["MDP","BD","MN","FIS","OOP","RETI"];
  const reduced=()=>doc.body&&doc.body.classList.contains("rm")||root.matchMedia&&root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- rifrazione dei bordi (solo motori che la supportano) ---------- */
  function chromium(){const b=root.navigator&&navigator.userAgentData&&navigator.userAgentData.brands;return !!(b&&b.some(x=>/Chromium/.test(x.brand)))}
  function lensMap(){
    /* Same 128×128 RGBA edge map, encoded offline to avoid blocking canvas readback at startup. */
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAABl0lEQVR4Ae3BuQHcBgADMOhEfVt7c7vIAulJIPz5++HDixcvHjx4cOPGjQsXLgRBcOLEiRM//HDgwOE/h/k/Dhw48MMPJ06cOBEEwYULF27cuPHgwYMXL158+BCfKRafKRavKRavKRavKRaPKRaPKRaPKRa3KRa3KRa3KRaXKRaXKRaXKRYxxSKmWMQUi9MUi9MUi9MUi9MUi58pFj9TLA5TLA5TLA5TLKZaHKZYTLWYajHVYqrFVIupFlMtplpMtZhqMdViqsVUi6kWUy2mWky1mGox1WKqxVSLqRZTLaZaTLWYajHVYqrFVIupFlMtplpMtZhqMdViqsVUi6kWUy2mWky1mGox1WKqxVSLqRZTLaZaTLWYajHVYqrFVIupFlMtplpMtZhqMdViqsVUi6kWUy2mWky1mGox1WKqxVSLqRZTLaZaTLU4TLE4TLE4TLH4mWLxM8XiNMXiNMXiNMXiNMUipljEFIuYYnGZYnGZYnGZYnGbYnGbYnGbYvGYYvGYYvGYYvGaYvGaYvGaYvGZYvGZYv8A/YoFfghioXMAAAAASUVORK5CYII=";
  }
  function installRefraction(){
    if(!chromium()||!root.CSS||!CSS.supports("backdrop-filter","url(#x)"))return false;
    const url=lensMap();if(!url)return false;
    const ns="http://www.w3.org/2000/svg",svg=doc.createElementNS(ns,"svg");svg.setAttribute("width","0");svg.setAttribute("height","0");svg.setAttribute("aria-hidden","true");svg.style.position="absolute";
    svg.innerHTML=`<defs><filter id="lgLens" x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
      <feImage href="${url}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale=".07" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;
    doc.body.appendChild(svg);html.classList.add("lg-refract");return true;
  }

  /* ---------- luce che segue il dito o il puntatore ---------- */
  let hoverEl=null,pending=0,lx=0,ly=0;
  function place(el,x,y){const r=el.getBoundingClientRect();if(!r.width)return;el.style.setProperty("--lg-x",((x-r.left)/r.width*100).toFixed(1)+"%");el.style.setProperty("--lg-y",((y-r.top)/r.height*100).toFixed(1)+"%")}
  function onMove(e){if(e.pointerType==="touch")return;const el=e.target&&e.target.closest&&e.target.closest(GLASS);
    if(hoverEl&&hoverEl!==el)hoverEl.classList.remove("lg-hover");hoverEl=el;if(!el)return;el.classList.add("lg-hover");lx=e.clientX;ly=e.clientY;
    if(!pending)pending=requestAnimationFrame(()=>{pending=0;if(hoverEl)place(hoverEl,lx,ly)})}
  function onDown(e){const el=e.target&&e.target.closest&&e.target.closest(GLASS);if(!el||el.disabled)return;place(el,e.clientX,e.clientY);
    el.classList.remove("lg-touch");void el.offsetWidth;el.classList.add("lg-touch");clearTimeout(el._lgT);el._lgT=setTimeout(()=>el.classList.remove("lg-touch"),reduced()?0:650)}

  /* ---------- sfondo fluido legato a materia e timer ---------- */
  let bg=null,last={subject:null,phase:null,p:-1,at:0};
  function mountBackground(){
    if(doc.getElementById("lgBg"))return doc.getElementById("lgBg");
    bg=doc.createElement("div");bg.id="lgBg";bg.setAttribute("aria-hidden","true");
    bg.innerHTML=`<i class="lg-b1"></i><i class="lg-b2"></i><i class="lg-b3"></i><div class="lg-tide"><svg viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 60 C150 20 300 100 450 60 S750 20 900 60 S1050 100 1200 60 L1200 120 L0 120Z"/><path class="lg-tide2" d="M0 70 C200 40 400 100 600 70 S1000 40 1200 70 L1200 120 L0 120Z"/></svg></div>`;
    doc.body.insertBefore(bg,doc.body.firstChild);return bg;
  }
  function update(st){
    if(!st)return;const now=Date.now(),subject=SUBJ.includes(st.subject)?st.subject:"",phase=st.phase||"idle",p=Math.max(0,Math.min(1,+st.progress||0));
    /* Al massimo un aggiornamento ogni 4 s per l'avanzamento: le variabili animano da sole con transizioni lunghe. */
    if(subject===last.subject&&phase===last.phase&&(Math.abs(p-last.p)<.004||now-last.at<4000))return;
    last={subject,phase,p,at:now};
    const s=html.style;s.setProperty("--lg-c1",subject?`var(--${subject})`:"var(--acc)");s.setProperty("--lg-p",p.toFixed(4));
    html.dataset.lgPhase=st.active?phase:"idle";html.dataset.lgSubject=subject||"none";
  }

  /* ---------- menu di stato nell'intestazione ---------- */
  function statusMenu(){
    const top=doc.querySelector(".top"),chips=top&&top.querySelector(".chips");if(!chips||doc.getElementById("lgStatus"))return;
    const btn=doc.createElement("button");btn.type="button";btn.id="lgStatus";btn.setAttribute("aria-expanded","false");btn.setAttribute("aria-controls","lgStatusPanel");
    btn.innerHTML='<i class="lg-dot"></i><span class="lg-st-txt">Collegamenti</span>';
    chips.id=chips.id||"lgStatusPanel";btn.setAttribute("aria-controls",chips.id);chips.classList.add("lg-popover");top.insertBefore(btn,chips);
    const close=()=>{top.classList.remove("lg-open");btn.setAttribute("aria-expanded","false")};
    btn.addEventListener("click",e=>{e.stopPropagation();const st=doc.getElementById("syncTxt");if(st&&st.classList.contains("relog")&&root.STUDIOOS_ADAPTER){close();root.STUDIOOS_ADAPTER.signIn();return}const open=!top.classList.contains("lg-open");top.classList.toggle("lg-open",open);btn.setAttribute("aria-expanded",String(open))});
    doc.addEventListener("click",e=>{if(!top.contains(e.target))close()});doc.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
    const sum=()=>{const pills=[...chips.querySelectorAll(".pill")].filter(p=>!p.hidden);const bad=pills.some(p=>p.classList.contains("bad")),warn=pills.some(p=>p.classList.contains("warn"));
      const sync=(doc.getElementById("syncTxt")||{}).textContent||"";btn.dataset.level=bad?"bad":warn?"warn":"ok";
      btn.querySelector(".lg-st-txt").textContent=bad?"Da controllare":warn?(sync||"Copia locale"):(/Salvato/.test(sync)?sync.replace(/^Salvato su Google/,"Salvato"):"Collegato")};
    new MutationObserver(sum).observe(chips,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class","hidden"]});sum();
  }

  /* ---------- impostazioni: studio in vista, sistema raccolto ---------- */
  function organizeSettings(){
    const view=doc.getElementById("v-impostazioni");if(!view||doc.getElementById("lgSys"))return !!doc.getElementById("lgSys");
    const pwa=doc.getElementById("pwaCard"),install=doc.getElementById("installTxt")&&doc.getElementById("installTxt").closest(".card");
    if(root.STUDIOOS_PWA&&!pwa)return false; /* l'adattatore crea la sua card poco dopo */
    const box=doc.createElement("details");box.id="lgSys";box.className="lg-group";
    box.innerHTML='<summary><span><b>Collegamenti e sistema</b><span class="small mute" id="lgSysSum">Account Google, fogli, installazione</span></span></summary><div class="lg-group-body"></div>';
    const body=box.querySelector(".lg-group-body"),health=doc.getElementById("systemHealth")&&doc.getElementById("systemHealth").closest(".card");for(const c of [health,pwa,install])if(c)body.appendChild(c);view.appendChild(box);
    const sum=()=>{const t=(doc.getElementById("syncTxt")||{}).textContent||"",ro=pwa&&/Sola lettura|spenta/i.test(pwa.textContent);doc.getElementById("lgSysSum").textContent=[t,ro?"registrazione spenta":""].filter(Boolean).join(" · ")||"Account Google, fogli, installazione"};
    sum();setInterval(sum,15000);return true;
  }
  const SHORT={"Studio accogliente":"Accogliente","Come il sistema":"Sistema","Automatico 22:00–07:00":"Auto","Automatico (vetro adattivo)":"Auto","Vetro (ispirato a Liquid Glass)":"Vetro"};
  function segmented(){
    const view=doc.getElementById("v-impostazioni");if(!view)return;
    for(const sel of view.querySelectorAll("select")){
      if(sel.dataset.lgSeg||sel.options.length<2||sel.options.length>4||sel.closest("#pwaCard,#lgSys"))continue;
      const labels=[...sel.options].map(o=>SHORT[o.textContent.trim()]||o.textContent.replace(/\s*\(.*\)\s*$/,"").trim());if(Math.max(...labels.map(l=>l.length))>(sel.options.length>3?9:sel.options.length>2?12:16))continue;
      sel.dataset.lgSeg="1";const g=doc.createElement("div");g.className="lg-seg";g.setAttribute("role","radiogroup");
      const lab=sel.id&&view.querySelector(`label[for="${sel.id}"]`);if(lab){lab.id=lab.id||sel.id+"Lbl";g.setAttribute("aria-labelledby",lab.id)}
      g.innerHTML=`<i class="lg-seg-ind" aria-hidden="true"></i>`+[...sel.options].map((o,i)=>`<button type="button" role="radio" data-v="${o.value}" title="${o.textContent.trim()}">${labels[i]}</button>`).join("");
      const paint=()=>{let idx=0;[...g.querySelectorAll("button")].forEach((b,i)=>{const on=b.dataset.v===sel.value;b.setAttribute("aria-checked",String(on));b.tabIndex=on?0:-1;if(on)idx=i});g.style.setProperty("--i",idx);g.style.setProperty("--n",sel.options.length)};
      g.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;sel.value=b.dataset.v;sel.dispatchEvent(new Event("change",{bubbles:true}));paint()});
      g.addEventListener("keydown",e=>{const bs=[...g.querySelectorAll("button")],i=bs.findIndex(b=>b.dataset.v===sel.value),d=e.key==="ArrowRight"||e.key==="ArrowDown"?1:e.key==="ArrowLeft"||e.key==="ArrowUp"?-1:0;if(!d)return;e.preventDefault();const n=bs[(i+d+bs.length)%bs.length];n.click();n.focus()});
      sel.addEventListener("change",paint);sel.classList.add("lg-hidden-select");sel.after(g);paint();
    }
  }

  function start(){
    installRefraction();mountBackground();statusMenu();segmented();
    let tries=0;const t=setInterval(()=>{if(organizeSettings()||++tries>40)clearInterval(t)},250);
    doc.addEventListener("pointermove",onMove,{passive:true});doc.addEventListener("pointerdown",onDown,{passive:true});
    html.classList.add("lg");
  }
  const api={update,start,lensMap,GLASS};root.STUDIOOS_LIQUID=api;
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",start);else start();
})(typeof window!=="undefined"?window:globalThis);
