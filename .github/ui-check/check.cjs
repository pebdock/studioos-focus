/* CI-only rendering of public assets. No account, secrets, or Google requests. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=process.cwd(),out=path.join(root,'artifacts-ui');fs.mkdirSync(out,{recursive:true});
const report={checks:0,cases:[],errors:[]};
const check=(value,label)=>{report.checks++;assert.ok(value,label)};
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,maxBuffer:8*1024*1024});
const base=process.env.UI_BASE||git('rev-parse','HEAD^').toString().trim();
assert.match(base,/^[a-f0-9]{40}$/);
const baseline=fs.mkdtempSync(path.join(os.tmpdir(),'focus-ui-public-'));
const build=JSON.parse(fs.readFileSync('BUILD.json','utf8'));
const beforeBuild=JSON.parse(git('show',base+':BUILD.json').toString());
const names=[...new Set([...Object.keys(build.files),'BUILD.json','appelli.json'])];
for(const name of names){
 const target=path.join(baseline,name);fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,git('show',base+':'+name));
}
for(const [name,digest] of Object.entries(build.files)){
 check(crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')===digest,'manifest hash: '+name);
 if(name.endsWith('.js')&&!['release.js','sw.js'].includes(name))
  check(fs.readFileSync(name).equals(fs.readFileSync(path.join(baseline,name))),'protected runtime: '+name);
}
const sw=fs.readFileSync('sw.js','utf8'),oldSw=fs.readFileSync(path.join(baseline,'sw.js'),'utf8');
check(sw.replace('studioos-focus-'+build.build,'studioos-focus-'+beforeBuild.build)===oldSw,'worker behavior unchanged');
const release=fs.readFileSync('release.js','utf8'),oldRelease=fs.readFileSync(path.join(baseline,'release.js'),'utf8');
check(release.slice(release.indexOf('  const esc='))===oldRelease.slice(oldRelease.indexOf('  const esc=')),'release behavior unchanged');
check(build.version.includes('2.3.1')&&release.includes('const VERSION="2.3.1"'),'release version');
check(build.build!==beforeBuild.build&&sw.includes('studioos-focus-'+build.build),'new cache version');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1'),isBefore=u.pathname.startsWith('/before/');
 const rel=decodeURIComponent(u.pathname.replace(/^\/(before|after)\//,''))||'index.html';
 const folder=isBefore?baseline:root,target=path.resolve(folder,rel);
 if(!target.startsWith(folder+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}
 res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);
});
const step=(state,title,file,task)=>`<li><button class="ckb s0">${state}</button><div><span class="tm">09:00–09:35</span>${title}<span class="st-open"><b>Apri</b>${file}</span><span class="st-do"><b>Cosa fare</b>${task}</span><label class="step-type">Tipo <select aria-label="Tipo del passaggio di prova"><option>Automatico [Stima] · teoria</option><option>Pratica</option></select></label></div></li>`;
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
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 for(const [engine,launcher] of Object.entries({chromium,webkit})){
  const browser=await launcher.launch({headless:true});
  try{for(const width of [320,390,430,768,1280])for(const theme of ['light','dark']){
   const coarse=width<768,context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,hasTouch:coarse,isMobile:coarse,serviceWorkers:'block'});
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   const item={engine,width,theme,variants:[]};
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
    if(engine==='chromium'&&[390,1280].includes(width)&&theme==='dark'){
     for(const id of ['todayCard','scalettaCard'])await page.locator('#'+id).screenshot({path:path.join(out,`${variant}-${width}-${id}.jpg`),type:'jpeg',quality:75,animations:'disabled'});
    }
    await page.evaluate(()=>window.STUDIOOS_RELEASE.open());
    check(await page.locator('#relDialog').isVisible(),'release dialog visible');
    const modal=await page.locator('#relDialog').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,notes:e.querySelectorAll('.rel-list li').length}));
    check(modal.scroll<=modal.width+1,'release dialog horizontal reflow');
    if(variant==='after')check(modal.notes===12,'new and historical release notes retained');
    if(engine==='chromium'&&[390,1280].includes(width)&&theme==='dark')await page.locator('#relDialog').screenshot({path:path.join(out,`${variant}-${width}-notes.jpg`),type:'jpeg',quality:75,animations:'disabled'});
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
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## Focus UI preflight\n\n${report.checks} checks; ${report.cases.length} viewport/theme/browser cases; ${report.errors.length} failures. Synthetic data only; all external browser requests blocked.\n`);
 console.log(JSON.stringify({ok:report.ok,checks:report.checks,cases:report.cases.length,errors:report.errors}));if(!report.ok)process.exitCode=1;
});
