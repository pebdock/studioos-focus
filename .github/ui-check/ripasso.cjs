'use strict';
/* Ripasso: prova d'uso completa su Chromium e WebKit (motore di Safari), telefono e desktop, chiaro e scuro.
   Serve la cartella del repository in locale, simula il piano scaricato da Focus e percorre tutte le modalità. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const ROOT=process.cwd(),OUT=path.join(ROOT,'artifacts-ui','ripasso');fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}
  r.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
const fails=[];let checks=0;
const check=(c,m)=>{checks++;if(!c){fails.push(m);console.log('FAIL',m)}};
const PLAN={
  'R20-9001':{id:'R20-9001',row:6,date:'2026-11-22',from:'09:00',to:'11:00',mat:'MDP',arg:'Probabilità condizionata e Bayes',cons:'esercizi bayes, indipendenza',min:120,stato:'Completato',fatti:120},
  'R20-9002':{id:'R20-9002',row:7,date:'2026-11-23',from:'14:00',to:'15:30',mat:'BD',arg:'SQL: GROUP BY, HAVING e divisione con NOT EXISTS',cons:'Fai: query con having, null e count',min:90,stato:'Da iniziare',fatti:0},
  'R20-9003':{id:'R20-9003',row:8,date:'2027-01-20',from:'09:00',to:'11:00',mat:'RETI',arg:'TCP congestione',cons:'',min:120,stato:'Da iniziare',fatti:0}};
async function answerAll(page,limit){
  for(let n=0;n<limit;n++){
    if(!(await page.locator('#rpRun').isVisible()))return;
    const t=await page.evaluate(()=>{const R=window.STUDIOOS_RIPASSO._R();return R.cards[R.i].x.t});
    if(t==='flash'){await page.click('[data-act="reveal"]');await page.click('[data-act="rate"][data-q="5"]');continue}
    if(t==='mcq')await page.click('.rp-opt >> nth=0');
    else if(t==='multi'){await page.click('.rp-opt >> nth=0');await page.click('[data-act="check-multi"]')}
    else if(t==='open'){await page.fill('#rpAns','WHERE filtra le righe prima del raggruppamento, HAVING filtra i gruppi dopo il group by con count e avg');await page.click('form[data-form="open"] [type="submit"]')}
    else if(t==='gen'){await page.fill('#rpNum','1');await page.click('form[data-form="num"] [type="submit"]')}
    await page.click('[data-act="next"]');
  }
}
async function home(page){if(await page.locator('#rpRun').isVisible())await page.click('[data-act="quit"]');if(!(await page.locator('#rpHome').isVisible()))await page.click('#rpEnd [data-act="home"],#rpStats [data-act="home"]')}
async function run(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  for(const [engine,launcher] of Object.entries({chromium,webkit}).filter(([n])=>!process.env.RP_ONLY||process.env.RP_ONLY===n)){
    const executablePath=process.env[engine==='chromium'?'UI_CHROMIUM_EXECUTABLE':'UI_WEBKIT_EXECUTABLE'];
    const browser=await launcher.launch({headless:true,...(executablePath?{executablePath}:{})});
    for(const [width,height,theme] of [[390,844,'light'],[390,844,'dark'],[1280,900,'dark']]){
      const tag=`${engine}/${width}/${theme}`,coarse=width<768;
      const context=await browser.newContext({viewport:{width,height},colorScheme:theme,hasTouch:coarse,isMobile:coarse&&engine!=='firefox',serviceWorkers:'block'});
      await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
      await page.clock.setFixedTime(new Date('2026-11-23T15:40:00'));
      await page.addInitScript(p=>{if(!localStorage.getItem('sfocus.unlinked.index'))localStorage.setItem('sfocus.unlinked.index',JSON.stringify({at:Date.now(),idx:p}))},PLAN);
      await page.goto(origin+'/ripasso/',{waitUntil:'load'});
      await page.waitForSelector('#rpModes .rp-mode');
      check(await page.locator('#rpModes .rp-mode').count()===7,`${tag}: 7 modalità`);
      check(await page.locator('#rpSuggest .rp-big').getAttribute('data-mode')==='fine',`${tag}: suggerisce fine blocco dopo il blocco BD`);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${tag}: nessuno scorrimento orizzontale`);
      if(coarse)check((await page.$$eval('.rp-mode,.rp-big,.rp-btn',els=>els.filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect().height))).every(h=>h>=44),`${tag}: pulsanti almeno 44 px`);
      await page.screenshot({path:path.join(OUT,`${engine}-${width}-${theme}-home.png`),fullPage:true});
      await page.selectOption('#rpBlock','R20-9002');await page.click('#rpModes [data-mode="fine"]');
      check((await page.evaluate(()=>window.STUDIOOS_RIPASSO._R().cards.map(c=>c.x.s))).every(s=>s==='BD'),`${tag}: fine blocco solo BD`);
      await answerAll(page,40);
      check(await page.locator('#rpEnd').isVisible(),`${tag}: riepilogo di fine sessione`);
      await home(page);await page.click('#rpModes [data-mode="pasto"]');
      check((await page.evaluate(()=>window.STUDIOOS_RIPASSO._R().cards.map(c=>c.x.t))).every(t=>['flash','mcq','multi'].includes(t)),`${tag}: pasto senza scrittura`);
      await home(page);
      await page.click('#rpModes [data-mode="simreti"]');
      const n=await page.evaluate(()=>window.STUDIOOS_RIPASSO._R().cards.length);
      for(let k=0;k<n;k++){const it=await page.evaluate(()=>{const R=window.STUDIOOS_RIPASSO._R();const x=R.cards[R.i].x.it;return {t:x.t,ok:x.ok}});
        for(const o of it.ok)await page.click(`.rp-opt[data-k="${o}"]`);if(it.t==='multi')await page.click('[data-act="check-multi"]');await page.click('[data-act="next"]')}
      check(/Fase 1 stimata: 30\/30/.test(await page.locator('#rpEnd').innerText()),`${tag}: punteggio ufficiale RETI 30/30 con tutte giuste`);
      await home(page);await page.click('#rpModes [data-mode="simmn"]');
      check((await page.evaluate(()=>window.STUDIOOS_RIPASSO._R().cards.map(c=>c.x.t).join(',')))==='mcq,mcq,mcq,mcq,mcq,open,open',`${tag}: teoria MN 5 multiple + 2 aperte`);
      for(let k=0;k<5;k++){await page.click('.rp-opt >> nth=0');await page.click('[data-act="next"]')}
      await page.fill('#rpAns','Il learning rate è il passo: se troppo grande la loss oscilla o diverge, se troppo piccolo la convergenza è lentissima');
      await page.press('#rpAns','Control+Enter');
      if(!(await page.locator('.rp-verdict').count()))await page.click('form[data-form="open"] [type="submit"]');
      check(await page.locator('.rp-verdict').count()===1,`${tag}: correzione della risposta aperta`);
      await page.screenshot({path:path.join(OUT,`${engine}-${width}-${theme}-aperta.png`),fullPage:true});
      await home(page);
      await page.click('#rpModes [data-mode="esercizi"]');
      const d=await page.evaluate(()=>window.STUDIOOS_RIPASSO._R().cards[0].d);
      await page.fill('#rpNum',Array.isArray(d.ans)?d.ans.join(''):typeof d.ans==='number'?String(d.ans).replace('.',','):String(d.ans));
      await page.click('form[data-form="num"] [type="submit"]');
      check((await page.locator('.rp-verdict').innerText()).startsWith('Giusta'),`${tag}: esercizio generato corretto riconosciuto`);
      await home(page);
      await page.click('.rp-top [data-act="stats"]');
      check(await page.locator('.rp-table tbody tr').count()===5,`${tag}: progressi per 5 materie`);
      const saved=await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('sfocus_rp_state')).cards).length);
      check(saved>10,`${tag}: progressi salvati`);
      check((await page.evaluate(()=>Object.keys(localStorage).filter(k=>k!=='sfocus_rp_state'&&k!=='sfocus.unlinked.index'))).length===0,`${tag}: nessuna altra chiave scritta`);
      await page.reload();await page.waitForSelector('#rpModes .rp-mode');
      check(await page.evaluate(()=>Object.keys(window.STUDIOOS_RIPASSO.state().cards).length)===saved,`${tag}: progressi dopo ricarica`);
      check(errors.length===0,`${tag}: nessun errore in pagina ${errors.join(' | ')}`);
      await page.goto(origin+'/?norel',{waitUntil:'load'});
      check(await page.locator('a[href="ripasso/"]').count()===2,`${tag}: due collegamenti al Ripasso in Focus`);
      await context.close();
    }
    await browser.close();
  }
  server.close();
  const res={ok:!fails.length,checks,fails};fs.writeFileSync(path.join(OUT,'ripasso.json'),JSON.stringify(res,null,1));console.log(JSON.stringify(res));
  if(fails.length)process.exit(1);
}
run().catch(e=>{console.error(e);process.exit(1)});
