/* CI-only rendering of public assets. No account, secrets, or Google requests. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=process.cwd(),out=path.join(root,'artifacts-ui');fs.mkdirSync(out,{recursive:true});
const report={checks:0,cases:[],functional:[],errors:[]};
const check=(value,label)=>{report.checks++;assert.ok(value,label)};
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,maxBuffer:8*1024*1024});
const base=git('rev-parse',process.env.UI_BASE||'origin/main').toString().trim();
assert.match(base,/^[a-f0-9]{40}$/);
const baseline=fs.mkdtempSync(path.join(os.tmpdir(),'focus-ui-public-'));
const build=JSON.parse(fs.readFileSync('BUILD.json','utf8'));
const beforeBuild=JSON.parse(git('show',base+':BUILD.json').toString());
const names=[...new Set([...Object.keys(beforeBuild.files),'BUILD.json','appelli.json'])];
for(const name of names){
 const target=path.join(baseline,name);fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,git('show',base+':'+name));
}
for(const [name,digest] of Object.entries(build.files)){
 check(crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')===digest,'manifest hash: '+name);
}
for(const name of Object.keys(beforeBuild.files).filter(name=>name.endsWith('.js')))
 check(fs.readFileSync(name).equals(fs.readFileSync(path.join(baseline,name))),'protected runtime: '+name);
const sw=fs.readFileSync('sw.js','utf8'),oldSw=fs.readFileSync(path.join(baseline,'sw.js'),'utf8');
check(sw===oldSw,'worker source and cache version unchanged for presentation-only PR');
const release=fs.readFileSync('release.js','utf8'),oldRelease=fs.readFileSync(path.join(baseline,'release.js'),'utf8');
check(release===oldRelease,'release source unchanged');
const releaseVersion=/const VERSION="([^"]+)"/.exec(release)?.[1];
check(!!releaseVersion&&build.version.includes(releaseVersion),'BUILD version matches release version');
check(build.build===beforeBuild.build&&sw.includes('studioos-focus-'+build.build),'presentation-only PR preserves existing cache metadata');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1'),isBefore=u.pathname.startsWith('/before/');
 const rel=decodeURIComponent(u.pathname.replace(/^\/(before|after)\//,''))||'index.html';
 const folder=isBefore?baseline:root,target=path.resolve(folder,rel);
 if(!target.startsWith(folder+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}
 res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);
});
// Selects are intentionally disclosed only in an expanded checklist row.
// Measure that visible state; a closed select correctly has no target box.
const step=(state,title,file,task)=>`<li class="open"><button class="ckb s0" aria-label="${state}">○</button><div class="st-body"><div class="st-head"><span class="tm">09:00–09:35</span></div><span class="st-title">${title}</span><span class="st-open"><b>Apri</b>${file}</span><span class="st-do"><b>Cosa fare</b>${task}</span><label class="step-type">Tipo <select aria-label="Tipo del passaggio di prova"><option>Automatico [Stima] · teoria</option><option>Pratica</option></select></label></div></li>`;
const fixture={steps:step('Da iniziare','Fondamenti e prerequisiti','Materiale_dimostrativo_con_un_nome_molto_lungo.pdf · pp. 12–21','Leggi le definizioni, poi risolvi i due esercizi indicati e annota il passaggio da chiarire.')+step('In corso','Esercizi e correzione','Esercizi_dimostrativi.pdf · esercizi 2–4','Svolgi un esercizio senza appunti, confronta il risultato e annota la correzione.'),
 mats:'<div class="matl"><div class="matl-main"><b>Materiale dimostrativo · file con nome lungo</b><div class="small mute">Cartella_di_esempio/Materiale_dimostrativo.pdf</div></div><label class="matl-pos">Sono a<input aria-label="Pagina di prova" value="12"></label></div>'};
async function seed(page,theme){
 await page.evaluate(({fixture,theme})=>{
  const d=document,r=d.documentElement;r.classList.remove('dark','light');r.classList.add(theme);r.dataset.theme=theme;
  d.getElementById('tdHead').textContent='3 blocchi · 4 h 30 min';
  d.getElementById('tdKpi').innerHTML='<div><b>270′</b><span>previsti</span></div><div><b>0′</b><span>confermati</span></div><div><b>270′</b><span>rimanenti</span></div>';
  d.getElementById('tdNext').textContent='09:00–10:30 · Materiali ed esercizi dimostrativi per il collaudo';
  d.getElementById('fTitle').textContent='Sessione dimostrativa · nessun dato personale';
  d.getElementById('scalettaCard').hidden=false;d.getElementById('steps').innerHTML=fixture.steps;
  d.getElementById('detail').hidden=false;d.getElementById('dCrit').textContent='Distingui i concetti e risolvi due esercizi senza consultare la soluzione.';
  d.getElementById('dMatList').innerHTML=fixture.mats;
 },{fixture,theme});
}
async function timerSmoke(browser,origin){
 const summaries=[];
 for(const variant of ['before','after']){
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'light',serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await context.addInitScript(()=>{
   if(localStorage.getItem('focus-ui-test-seeded'))return;
   const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const block={id:'R20-9001',row:2,mat:'MDP',date:day,from:'00:00',to:'23:59',min:90,arg:'Sessione sintetica per test',stato:'Da iniziare',fatti:0,mats:'demo.pdf · pp. 1–4',cons:'SCALETTA: 09:00–09:35 Teoria — Apri: demo.pdf — Fai: Leggi le definizioni; pausa 09:35–09:40; 09:40–10:30 Esercizi — Apri: demo.pdf — Fai: Risolvi due esercizi\nVerifica finale: spiega il risultato senza consultare la soluzione.'};
   localStorage.setItem('sfocus.unlinked.index',JSON.stringify({at:Date.now(),idx:{[block.id]:block}}));
   localStorage.setItem('sfocus.device',JSON.stringify('ui-test-device'));
   localStorage.setItem('sfocus.settings',JSON.stringify({theme:'light',look:'std',rm:true,smart:false,auto:false,work:50,brk:10,wake:false,haptic:false,sound:'none',amb:'none'}));
   localStorage.setItem('focus-ui-test-seeded','1');
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const item={variant,viewport:'1440x900',theme:'light'};
  try{
   await page.goto(origin+'/'+variant+'/?norel#focus',{waitUntil:'load'});
   await page.waitForFunction(()=>window.STUDIOOS_STUDY?.snapshot().blocks.some(b=>b.id==='R20-9001')&&!document.getElementById('bStudy').disabled);
   await page.locator('#bStudy').click();
   await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.phase==='work');
   const first=await page.evaluate(()=>({run:window.STUDIOOS_STUDY.current().run,timer:document.getElementById('timer').textContent}));
   check(first.run.blockId==='R20-9001'&&first.run.plannedMin===90,'functional '+variant+': starts cached plan block');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'functional '+variant+': running timer fits viewport');
   if(variant==='after')check(await page.locator('#fTitle').evaluate(title=>{
    const rect=title.getBoundingClientRect();
    const at=document.elementFromPoint(rect.left+Math.min(10,rect.width/2),rect.top+Math.min(10,rect.height/2));
    return rect.top>=0&&rect.bottom<=innerHeight&&!!at&&(at===title||title.contains(at));
   }),'functional after: active timer heading remains visible and unobscured');
   await page.waitForFunction(old=>document.getElementById('timer').textContent!==old,first.timer,{timeout:4000});
   check(true,'functional '+variant+': timer advances');
   if(variant==='after'){
    const guide=page.locator('button[popovertarget="ui-glass-guide"]').first();
    await guide.click();await page.locator('#ui-glass-guide .ui-glass-help-body p').first().click();
    for(const key of ['o','2','c','Space'])await page.keyboard.press(key);
    check(await page.evaluate(()=>document.querySelector('#ui-glass-guide:popover-open')&&!document.body.classList.contains('oled')&&location.hash==='#focus'&&!document.getElementById('mDone').classList.contains('on')&&window.STUDIOOS_STUDY.current().run.phase==='work'),'functional after: prose focus isolates timer and navigation shortcuts');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#ui-glass-guide:popover-open')&&document.activeElement?.getAttribute('popovertarget')==='ui-glass-guide');
    check(true,'functional after: Escape restores guide opener after prose click');
   }
   await page.locator('#bPause').click();await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.phase==='paused');
   check(await page.evaluate(()=>!!window.STUDIOOS_STUDY.current().run.segments[0][1]),'functional '+variant+': pause closes elapsed segment');
   await page.locator('#bPause').click();await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.phase==='work');
   await page.locator('#notes').fill('Punto sintetico: pagina 4, esercizio 2.');await page.locator('#notes').press('Tab');
   await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.notes==='Punto sintetico: pagina 4, esercizio 2.');
   await page.locator('#steps [data-ck="0"]').click();
   await page.waitForFunction(()=>window.STUDIOOS_STUDY.snapshot().state['chk_R20-9001']?.items[0]===1);
   await page.reload({waitUntil:'load'});
   await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.phase==='work');
   const restored=await page.evaluate(()=>({run:window.STUDIOOS_STUDY.current().run,note:document.getElementById('notes').value,step:window.STUDIOOS_STUDY.snapshot().state['chk_R20-9001']?.items[0]}));
   check(restored.run.runId===first.run.runId&&restored.note==='Punto sintetico: pagina 4, esercizio 2.'&&restored.step===1,'functional '+variant+': same run, notes and checklist survive reload');
   await page.locator('#bInt').click();check(await page.locator('#mInt').evaluate(e=>e.classList.contains('on')),'functional '+variant+': interruption opens');
   await page.locator('#miNo').click();check(await page.locator('#mInt').evaluate(e=>!e.classList.contains('on')),'functional '+variant+': interruption cancels');
   check(await page.evaluate(()=>window.STUDIOOS_STUDY.current().run.phase==='work'),'functional '+variant+': cancelled interruption preserves running phase');
   await page.locator('#bInt').click();await page.locator('#miR').selectOption({label:'Altro'});await page.locator('#miOk').click();
   await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.phase==='paused'&&window.STUDIOOS_STUDY.current().run.interruptions.length===1);
   await page.locator('#bPause').click();await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.phase==='work');
   await page.locator('#bDone').click();await page.locator('#mdKeep').click();
   check(await page.evaluate(()=>window.STUDIOOS_STUDY.current().run?.status==='active'&&window.STUDIOOS_STUDY.current().run.phase==='paused'),'functional '+variant+': completion cancel keeps existing paused run');
   await page.locator('#bPause').click();await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.phase==='work');
   await page.locator('#bDone').click();await page.locator('#mdOut').selectOption({label:'Affrontato'});await page.locator('#mdEv').fill('Due esercizi sintetici completati.');await page.locator('#mdOk').click();
   await page.waitForFunction(()=>!window.STUDIOOS_STUDY.current().run&&window.STUDIOOS_STUDY.snapshot().runs.some(r=>r.status==='confirmed'));
   check(await page.evaluate(()=>JSON.parse(localStorage.getItem('sfocus.unlinked.active'))===null),'functional '+variant+': confirmed run clears active storage');
   await page.locator('#bStart').click();await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.phase==='work');
   await page.locator('#bDone').click();await page.locator('#mdDrop').click();
   await page.waitForFunction(()=>!window.STUDIOOS_STUDY.current().run&&window.STUDIOOS_STUDY.snapshot().runs.some(r=>r.status==='discarded'));
   await page.locator('#t-registro').click();await page.locator('#v-registro-registro').click();await page.locator('#bExport').click();
   const exported=JSON.parse(await page.locator('#expTxt').inputValue());
   check(exported.runs.length===2&&exported.runs.some(r=>r.status==='confirmed')&&exported.runs.some(r=>r.status==='discarded'),'functional '+variant+': export retains both terminal outcomes');
   const summary=await page.evaluate(()=>{
    const state=window.STUDIOOS_STUDY.snapshot();
    const pick=r=>({blockId:r.blockId,materia:r.materia,plannedMin:r.plannedMin,status:r.status,phase:r.phase,outcome:r.outcome||null,evidence:r.evidence||null,notes:r.notes,interruptions:r.interruptions.map(x=>x.reason),segments:r.segments.length});
    return {confirmed:pick(state.runs.find(r=>r.status==='confirmed')),discarded:pick(state.runs.find(r=>r.status==='discarded')),checklist:state.state['chk_R20-9001'].items[0],active:JSON.parse(localStorage.getItem('sfocus.unlinked.active')),hash:location.hash};
   });
   if(variant==='after'){
    await page.locator('#t-impostazioni').click();
    await page.locator('button[popovertarget="ui-glass-guide"]').first().click();
    await page.locator('#sWork').click();
    await page.waitForFunction(()=>!document.querySelector('#ui-glass-guide:popover-open')&&document.activeElement===document.getElementById('sWork'));
    check(true,'functional after: outside input dismisses guide and keeps its own focus');
    const closed=page.locator('details:not([open]):has(button[popovertarget="ui-glass-install"]) > summary');
    while(await closed.count())await closed.first().click();
    await page.locator('button[popovertarget="ui-glass-install"]').first().click();
    // Exercise queued native toggle ordering directly: the open installation
    // surface intentionally covers the header's guide pointer target.
    await page.evaluate(()=>document.getElementById('ui-glass-guide').showPopover());
    await page.waitForFunction(()=>!!document.querySelector('#ui-glass-guide:popover-open')&&!document.querySelector('#ui-glass-install:popover-open')&&!!document.activeElement.closest('#ui-glass-guide'));
    check(true,'functional after: opening guide from installation keeps focus in newest popover');
    await page.locator('#ui-glass-guide .ui-glass-close').click();
    await page.waitForFunction(()=>!document.querySelector('#ui-glass-guide:popover-open'));
    check(true,'functional after: explicit guide close works');
    await page.locator('#t-focus').click();
   }
   check(errors.length===0,'functional '+variant+': no page exceptions: '+errors.join('; '));
   item.ok=true;item.summary=summary;summaries.push(summary);
  }catch(error){item.ok=false;item.error=String(error);report.errors.push({functional:variant,error:String(error)});await page.screenshot({path:path.join(out,'failure-functional-'+variant+'.png'),fullPage:true}).catch(()=>{});}
  finally{report.functional.push(item);await context.close();}
 }
 if(summaries.length===2)check(JSON.stringify(summaries[0])===JSON.stringify(summaries[1]),'functional: before/after timer, notes, checklist, interruption, confirmation, discard and routing parity');
}
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 for(const [engine,launcher] of Object.entries({chromium,webkit})){
  const executablePath=process.env[engine==='chromium'?'UI_CHROMIUM_EXECUTABLE':'UI_WEBKIT_EXECUTABLE'];
  const browser=await launcher.launch({headless:true,...(executablePath?{executablePath}:{})});
  if(engine==='chromium')await timerSmoke(browser,origin);
  try{for(const width of [320,375,390,430,768,1280,1440])for(const theme of ['light','dark']){
   const coarse=width<768,height=width===390?844:900,context=await browser.newContext({viewport:{width,height},colorScheme:theme,hasTouch:coarse,isMobile:coarse,serviceWorkers:'block'});
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   const item={engine,width,height,theme,variants:[]};
   try{for(const variant of ['before','after']){
    await page.goto(origin+'/'+variant+'/?norel#focus',{waitUntil:'load'});
    await page.waitForFunction(()=>window.STUDIOOS_SECTIONS?.views?.['v-registro']);
    await seed(page,theme);
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('#steps .ckb,#steps select')].map(e=>({height:e.getBoundingClientRect().height,text:e.textContent})),text:document.getElementById('steps').textContent}));
    check(layout.scroll<=layout.width+1,`${engine}/${width}/${theme}/${variant}: no page overflow`);
    check(layout.text.includes('Materiale_dimostrativo_con_un_nome_molto_lungo.pdf'),'full filename in DOM');
    if(variant==='after'&&coarse)check(layout.targets.every(t=>t.height>=44),`${engine}/${width}: touch target 44px`);
    for(const id of ['piano','registro','settimana','impostazioni','focus']){
     await page.locator('#t-'+id).click();
     check(await page.locator('#t-'+id).getAttribute('aria-selected')==='true','navigation: '+id);
     check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'view overflow: '+id);
    }
    await seed(page,theme);
    if(engine==='chromium'&&[390,1440].includes(width)){
     // The original navigation lens uses requestAnimationFrame springs,
     // which screenshot({animations:'disabled'}) does not pause or settle.
     await page.waitForFunction(()=>!document.getElementById('tabbar').classList.contains('nav-moving'));
     await page.screenshot({path:path.join(out,`${variant}-${width}-${theme}-focus.png`),animations:'disabled'});
     for(const id of ['todayCard','scalettaCard'])await page.locator('#'+id).screenshot({path:path.join(out,`${variant}-${width}-${id}.jpg`),type:'jpeg',quality:75,animations:'disabled'});
    }
    await page.evaluate(()=>window.STUDIOOS_RELEASE.open());
    check(await page.locator('#relDialog').isVisible(),'release dialog visible');
    const modal=await page.locator('#relDialog').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,notes:e.querySelectorAll('.rel-list li').length}));
    check(modal.scroll<=modal.width+1,'release dialog horizontal reflow');
    item.releaseNotes??=modal.notes;
    check(modal.notes===item.releaseNotes,'original release notes retained');
    if(engine==='chromium'&&[390,1440].includes(width))await page.locator('#relDialog').screenshot({path:path.join(out,`${variant}-${width}-${theme}-notes.jpg`),type:'jpeg',quality:75,animations:'disabled'});
    await page.locator('#relDialog').getByRole('button',{name:'Inizia',exact:true}).click();
    await page.locator('#t-focus').focus();await page.keyboard.press('ArrowRight');
    check(await page.locator('#t-giorno').getAttribute('aria-selected')==='true','keyboard navigation');
    await page.locator('#t-focus').click();
    const zoom=await page.evaluate(()=>{document.documentElement.style.fontSize='200%';return {width:innerWidth,scroll:document.documentElement.scrollWidth}});
    if(variant==='after')check(zoom.scroll<=Math.max(zoom.width,item.variants[0].zoomScroll)+1,'200% text enlargement: no added horizontal overflow');
    await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
    item.variants.push({variant,scrollWidth:layout.scroll,zoomScroll:zoom.scroll,touchHeights:layout.targets.map(t=>t.height)});
   }
   await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#t-focus').click();
   const motion=await page.locator('#lgBg i').evaluateAll(es=>es.map(e=>getComputedStyle(e).animationName));
   check(motion.every(x=>x==='none'),'reduced motion');check(errors.length===0,'no page exceptions: '+errors.join('; '));
   item.ok=true;
   }catch(error){item.ok=false;item.error=String(error);report.errors.push({engine,width,theme,error:String(error)});await page.screenshot({path:path.join(out,`failure-${engine}-${width}-${theme}.png`),fullPage:true}).catch(()=>{});}
   finally{report.cases.push(item);await context.close();}
  }}finally{await browser.close();}
 }
}
run().catch(error=>report.errors.push({fatal:String(error)})).finally(()=>{
 server.close();report.ok=report.errors.length===0;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## Focus UI preflight\n\n${report.checks} checks; ${report.cases.length} viewport/theme/browser cases; ${report.functional.length} functional baseline/candidate variants; ${report.errors.length} failures. Synthetic data only; all external browser requests blocked.\n`);
 console.log(JSON.stringify({ok:report.ok,checks:report.checks,cases:report.cases.length,functional:report.functional.length,errors:report.errors}));if(!report.ok)process.exitCode=1;
});
