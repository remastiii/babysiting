import { EXPENSE_TYPES, PAYMENT_METHODS, SHIFT_TYPES, localDate, normalizeExpense, normalizeShift,
  cents, expenseTotal, financialTotals, inMonth, filterExpenses, monthlyFinance, parseBackup, csvCell, expensesCsv } from './model.mjs';
// Publishable ključ iz config.js je javan po dizajnu; podatke štiti RLS politika u bazi.
// Sesija u sessionStorage: zatvaranje taba = odjava.
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true}});
const IDLE_MS=15*60*1000;
let shifts=[];
let expenses=[];
let shiftsReady=false, expensesReady=false, loadEpoch=0, mutating=false;
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('sr-RS',{maximumFractionDigits:2}).format(Number(n)||0)+' RSD';
const num=n=>new Intl.NumberFormat('sr-RS',{maximumFractionDigits:2}).format(Number(n)||0);
const dateFmt=s=>{if(!s)return '—';const [y,m,d]=s.split('-');return `${d}.${m}.${y}.`};
const monthName=s=>{const [y,m]=s.split('-');return new Intl.DateTimeFormat('sr-RS',{month:'short'}).format(new Date(Number(y),Number(m)-1,1))};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const profit=s=>(cents(s.charged)-cents(s.paid))/100;
const TYPES=SHIFT_TYPES;
const typeLabel=t=>TYPES[t]||TYPES.povremeno;
async function fetchAll(table){
  const rows=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await sb.from(table).select('*').order('date',{ascending:false})
      .order('created',{ascending:false}).order('id').range(offset,offset+499);
    if(error)throw error;
    rows.push(...(data||[]));
    if(!data||data.length<500)return rows;
  }
}
async function load(){
  const epoch=++loadEpoch;
  shiftsReady=false;expensesReady=false;shifts=[];expenses=[];
  $('dataStatus').hidden=false;$('dataStatusText').textContent='Učitavanje evidencije…';
  $('retryLoad').disabled=true;render();
  const [s,e]=await Promise.allSettled([fetchAll('shifts'),fetchAll('expenses')]);
  if(epoch!==loadEpoch)return false;
  const errors=[];
  if(s.status==='fulfilled'){shifts=s.value;shiftsReady=true}else errors.push('Smene nisu učitane.');
  if(e.status==='fulfilled'){expenses=e.value;expensesReady=true}else errors.push('Troškovi nisu učitani.');
  $('dataStatus').hidden=!errors.length;
  $('dataStatusText').textContent=errors.join(' ')+' Finansijski rezultat nije dostupan dok se obe evidencije ne učitaju.';
  $('retryLoad').disabled=false;render();return !errors.length;
}
const toRow=normalizeShift;
function toast(msg){const t=$('toast');t.textContent=msg;t.style.display='block';clearTimeout(window._toast);window._toast=setTimeout(()=>t.style.display='none',2800)}
function totals(list){return financialTotals(list,[])}
function filteredStats(){const m=$('statsMonth')?.value;return shifts.filter(s=>!m||s.date.startsWith(m))}
function updatePreview(){const p=(Number($('charged').value)||0)-(Number($('paid').value)||0);$('profitPreview').textContent=money(p);$('profitPreview').style.color=p<0?'var(--danger)':'var(--mint)'}
['charged','paid'].forEach(id=>$(id).addEventListener('input',updatePreview));
function setOptions(){const fam=[...new Set(shifts.map(s=>s.family).filter(Boolean))].sort();const sit=[...new Set(shifts.map(s=>s.sitter).filter(Boolean))].sort();$('families').innerHTML=fam.map(x=>`<option value="${esc(x)}">`).join('');$('sitters').innerHTML=sit.map(x=>`<option value="${esc(x)}">`).join('');const prev=$('sitterFilter').value;$('sitterFilter').innerHTML='<option value="">Sve dadilje</option>'+sit.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('sitterFilter').value=sit.includes(prev)?prev:''}
function displayResult(id,value,ready){$(id).textContent=ready?money(value):'—';$(id).classList.toggle('negative',ready&&value<0)}
function renderKpis(){const month=$('homeMonth').value;const t=financialTotals(inMonth(shifts,month),inMonth(expenses,month));displayResult('kRevenue',t.revenue,shiftsReady);displayResult('kPayout',t.paid,shiftsReady);displayResult('kProfit',t.profit,shiftsReady);displayResult('kExpenses',t.expenses,expensesReady);displayResult('kNet',t.net,shiftsReady&&expensesReady);$('kCount').textContent=shiftsReady?t.count:'—';$('kHours').textContent=shiftsReady?num(t.hours)+' sati ukupno':'Podaci nisu dostupni';$('kMargin').textContent=shiftsReady?(t.revenue?num(t.profit/t.revenue*100):'0')+'% marže od naplaćenog':'Podaci nisu dostupni'}
function row(s,all=false){return `<tr><td>${dateFmt(s.date)}</td><td>${esc(s.family)}</td><td>${esc(s.sitter)}</td><td>${esc(typeLabel(s.shift_type))}</td><td class="num">${num(s.hours)}</td><td class="num">${money(s.charged)}</td><td class="num">${money(s.paid)}</td><td class="num profit" style="${profit(s)<0?'color:var(--danger)':''}">${money(profit(s))}</td>${all?`<td title="${esc(s.description)}">${esc((s.description||'').slice(0,38))}${(s.description||'').length>38?'…':''}</td>`:''}<td><button class="text-btn" data-edit="${esc(s.id)}">Izmeni</button> <button class="text-btn" style="color:var(--danger)" data-delete="${esc(s.id)}">Obriši</button></td></tr>`}
function renderRecent(){const list=[...shifts].sort((a,b)=>b.date.localeCompare(a.date)||String(b.created).localeCompare(String(a.created))).slice(0,6);$('recentRows').innerHTML=list.map(s=>row(s)).join('');$('recentEmpty').style.display=list.length?'none':'block'}
function getFiltered(){const q=$('search').value.trim().toLocaleLowerCase('sr');const m=$('monthFilter').value;const sit=$('sitterFilter').value;const tp=$('typeFilter').value;return [...shifts].filter(s=>(!q||(s.family+' '+s.sitter+' '+(s.description||'')).toLocaleLowerCase('sr').includes(q))&&(!m||s.date.startsWith(m))&&(!sit||s.sitter===sit)&&(!tp||(s.shift_type||'povremeno')===tp)).sort((a,b)=>b.date.localeCompare(a.date)||String(b.created).localeCompare(String(a.created)))}
function renderAll(){const list=getFiltered();$('allRows').innerHTML=list.map(s=>row(s,true)).join('');$('allEmpty').style.display=list.length?'none':'block';const t=totals(list);$('filteredTotals').textContent=`Prikazano ${t.count} smena · ${num(t.hours)} sati · Naplaćeno ${money(t.revenue)} · Isplaćeno ${money(t.paid)} · Profit ${money(t.profit)}`}
function renderChart(){
  const chart=$('chart');
  if(!shiftsReady||!expensesReady){chart.innerHTML='<div class="empty">Grafikon čeka učitavanje obe evidencije.</div>';$('chartFoot').textContent='Finansijski podaci nisu dostupni.';return}
  const months=monthlyFinance(shifts,expenses);
  if(!months.length){chart.innerHTML='<div class="empty">Dodaj smenu ili trošak za mesečni pregled.</div>';$('chartFoot').textContent='Iznosi su izraženi u RSD.';return}
  const series=[['revenue','Naplaćeno','var(--mint)'],['paid','Isplaćeno dadiljama','var(--blue)'],['expenses','Troškovi','#bd7854'],['net','Rezultat posle troškova','var(--purple)']];
  const max=Math.max(1,...months.flatMap(m=>series.map(([key])=>Math.max(0,m[key]))));
  const min=Math.min(0,...months.map(m=>m.net));const range=max-min;const baseline=max/range*100;
  chart.innerHTML=months.map(m=>`<div class="month"><span class="chart-baseline" style="top:${baseline}%"></span>${series.map(([key,label,color])=>{const value=m[key];return `<div class="bar-slot" title="${esc(m.month+' · '+label+': '+money(value))}"><div class="bar" style="top:${value>=0?(max-value)/range*100:baseline}%;height:${Math.abs(value)/range*100}%;background:${value<0?'var(--danger)':color}"></div></div>`}).join('')}<span class="bar-label">${esc(monthName(m.month))} '${m.month.slice(2,4)}</span></div>`).join('');
  const description=months.map(m=>`${m.month}: naplaćeno ${money(m.revenue)}, isplaćeno ${money(m.paid)}, troškovi ${money(m.expenses)}, rezultat ${money(m.net)}`).join(' · ');
  chart.setAttribute('aria-label',description);$('chartFoot').textContent=`Nulta linija: 0 RSD. Vrh skale: ${money(max)}.${min<0?' Donja granica: '+money(min)+'. Negativan rezultat je prikazan crveno ispod nule.':''}`;
}
function renderInsights(){const t=totals(shifts);const byFamily={},bySitter={};shifts.forEach(s=>{byFamily[s.family]??={profit:0,count:0};byFamily[s.family].profit+=profit(s);byFamily[s.family].count++;bySitter[s.sitter]??={hours:0,count:0,paid:0};bySitter[s.sitter].hours+=Number(s.hours);bySitter[s.sitter].count++;bySitter[s.sitter].paid+=Number(s.paid)});const topF=Object.entries(byFamily).sort((a,b)=>b[1].profit-a[1].profit)[0];const topS=Object.entries(bySitter).sort((a,b)=>b[1].count-a[1].count)[0];const arr=[`Prosečan profit po smeni: <b>${money(t.count?t.profit/t.count:0)}</b>`,`Ukupno evidentiranih sati: <b>${num(t.hours)}</b>`,topF?`Najveći ukupan profit po porodici: <b>${esc(topF[0])}</b> (${money(topF[1].profit)})`:'Dodaj smene da bi se prikazali uvidi.',topS?`Najviše smena: <b>${esc(topS[0])}</b> (${topS[1].count})`:null].filter(Boolean);$('insights').innerHTML=arr.map(x=>`<div class="insight"><span>↗</span><span>${x}</span></div>`).join('')}
function renderStats(){const list=filteredStats(),t=totals(list);$('sRevenue').textContent=money(t.revenue);$('sPayout').textContent=money(t.paid);$('sProfit').textContent=money(t.profit);$('sCount').textContent=`${t.count} / ${num(t.hours)}`;const ss={},fs={};list.forEach(s=>{ss[s.sitter]??={count:0,hours:0,paid:0};ss[s.sitter].count++;ss[s.sitter].hours+=Number(s.hours);ss[s.sitter].paid+=Number(s.paid);fs[s.family]??={count:0,revenue:0,profit:0};fs[s.family].count++;fs[s.family].revenue+=Number(s.charged);fs[s.family].profit+=profit(s)});const sl=Object.entries(ss).sort((a,b)=>b[1].count-a[1].count);const fl=Object.entries(fs).sort((a,b)=>b[1].profit-a[1].profit);$('sitterStats').innerHTML=sl.map(([n,v])=>`<tr><td>${esc(n)}</td><td class="num">${v.count}</td><td class="num">${num(v.hours)}</td><td class="num">${money(v.paid)}</td></tr>`).join('');$('familyStats').innerHTML=fl.map(([n,v])=>`<tr><td>${esc(n)}</td><td class="num">${v.count}</td><td class="num">${money(v.revenue)}</td><td class="num profit">${money(v.profit)}</td></tr>`).join('');$('sitterStatsEmpty').style.display=sl.length?'none':'block';$('familyStatsEmpty').style.display=fl.length?'none':'block'}
function render(){setOptions();renderKpis();renderRecent();renderAll();renderChart();renderInsights();renderStats();renderExpenses();renderStatsFinance();renderAvailability()}
function renderStatsFinance(){const t=financialTotals(filteredStats(),inMonth(expenses,$('statsMonth').value));displayResult('sRevenue',t.revenue,shiftsReady);displayResult('sPayout',t.paid,shiftsReady);displayResult('sProfit',t.profit,shiftsReady);displayResult('sExpenses',t.expenses,expensesReady);displayResult('sNet',t.net,shiftsReady&&expensesReady);if(!shiftsReady)$('sCount').textContent='—'}
function renderAvailability(){
  $('saveBtn').disabled=mutating||!shiftsReady;$('saveExpenseBtn').disabled=mutating||!expensesReady;
  $('exportCsv').disabled=!shiftsReady;$('exportExpensesCsv').disabled=!expensesReady;
  $('settingsExport').disabled=!shiftsReady||!expensesReady;$('importFile').disabled=mutating||!shiftsReady||!expensesReady;$('deleteAll').disabled=mutating||!shiftsReady;
  if(!shiftsReady){$('recentEmpty').textContent='Smene nisu učitane.';$('allEmpty').textContent='Smene nisu učitane.';$('filteredTotals').textContent='';$('insights').textContent='Smene nisu učitane.'}
  else{$('recentEmpty').textContent='Još nema unetih smena. Dodaj prvu smenu iz forme iznad.';$('allEmpty').textContent='Nema smena koje odgovaraju filterima.'}
}
function resetForm(){ $('shiftForm').reset();$('editId').value='';$('date').value=localDate();$('formTitle').textContent='＋ Dodaj novu smenu';$('saveBtn').textContent='Sačuvaj smenu';$('cancelEdit').hidden=true;updatePreview()}
function editShift(id){const s=shifts.find(x=>x.id===id);if(!s)return;showPage('home');$('editId').value=s.id;['date','family','sitter','hours','description'].forEach(k=>$(k).value=s[k]??'');$('shiftType').value=s.shift_type||'povremeno';$('charged').value=s.charged;$('paid').value=s.paid;$('formTitle').textContent='Izmeni smenu';$('saveBtn').textContent='Sačuvaj izmene';$('cancelEdit').hidden=false;updatePreview();$('formPanel').scrollIntoView({behavior:'smooth',block:'start'})}
async function runMutation(operation,success,after=()=>{}){
  if(mutating)return false;
  const epoch=loadEpoch;mutating=true;renderAvailability();
  try{
    const {error}=await operation();if(error)throw error;
    if(epoch!==loadEpoch)return false;
    after();const refreshed=await load();
    toast(refreshed?success:success+' Osvežavanje nije uspelo; pokušaj ponovo.');return true;
  }catch(error){toast('Radnja nije uspela: '+(error.message||'Proveri vezu i pokušaj ponovo.'));return false}
  finally{mutating=false;renderAvailability()}
}
function saveRecord(table,id,row){return id?sb.from(table).update(row).eq('id',id).select('id').single():sb.from(table).insert(row).select('id').single()}
function deleteShift(id){const s=shifts.find(x=>x.id===id);if(!s||!shiftsReady||mutating)return;if(!confirm(`Obrisati smenu za ${s.family} od ${dateFmt(s.date)}?`))return;runMutation(()=>sb.from('shifts').delete().eq('id',id).select('id').single(),'Smena je obrisana.',()=>{if($('editId').value===id)resetForm()})}

function setupExpenses(){
  const options=map=>Object.entries(map).map(([value,label])=>`<option value="${value}">${esc(label)}</option>`).join('');
  $('expenseCategory').innerHTML='<option value="">Izaberi vrstu</option>'+options(EXPENSE_TYPES);
  $('expensePayment').innerHTML='<option value="">Izaberi način plaćanja</option>'+options(PAYMENT_METHODS);
  $('expenseCategoryFilter').innerHTML='<option value="">Sve vrste troškova</option>'+options(EXPENSE_TYPES);
  $('expensePaymentFilter').innerHTML='<option value="">Svi načini plaćanja</option>'+options(PAYMENT_METHODS);
}
function resetExpenseForm(){
  $('expenseForm').reset();$('expenseEditId').value='';$('expenseDate').value=localDate();
  $('expenseFormTitle').textContent='＋ Dodaj trošak';$('saveExpenseBtn').textContent='Sačuvaj trošak';$('cancelExpenseEdit').hidden=true;
}
function getFilteredExpenses(){return filterExpenses(expenses,{query:$('expenseSearch').value,month:$('expenseMonthFilter').value,category:$('expenseCategoryFilter').value,payment:$('expensePaymentFilter').value})}
function renderExpenses(){
  const list=expensesReady?getFilteredExpenses():[];
  $('expenseRows').innerHTML=list.map(e=>`<tr><td>${dateFmt(e.date)}</td><td>${esc(e.title)}</td><td>${esc(EXPENSE_TYPES[e.category]||e.category)}</td><td class="num">${money(e.amount)}</td><td>${esc(PAYMENT_METHODS[e.payment_method]||e.payment_method)}</td><td class="note-cell">${esc(e.description||'—')}</td><td><button class="text-btn" data-expense-edit="${esc(e.id)}">Izmeni</button> <button class="text-btn" style="color:var(--danger)" data-expense-delete="${esc(e.id)}">Obriši</button></td></tr>`).join('');
  $('expensesEmpty').style.display=list.length?'none':'block';
  $('expensesEmpty').textContent=!expensesReady?'Troškovi nisu učitani.':expenses.length?'Nema troškova koji odgovaraju filterima.':'Još nema troškova. Dodaj prvi trošak iz forme iznad.';
  $('expenseTotals').textContent=expensesReady?`Prikazano ${list.length} troškova · Ukupno ${money(expenseTotal(list))}`:'';
}
function editExpense(id){
  const expense=expenses.find(e=>e.id===id);if(!expense||mutating)return;
  showPage('expenses');$('expenseEditId').value=id;$('expenseDate').value=expense.date;$('expenseTitle').value=expense.title;
  $('expenseCategory').value=expense.category;$('expenseAmount').value=expense.amount;$('expensePayment').value=expense.payment_method;
  $('expenseDescription').value=expense.description||'';$('expenseFormTitle').textContent='Izmeni trošak';$('saveExpenseBtn').textContent='Sačuvaj izmene';$('cancelExpenseEdit').hidden=false;
  $('expenseFormPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function deleteExpense(id){
  const expense=expenses.find(e=>e.id===id);if(!expense||!expensesReady||mutating)return;
  if(!confirm(`Obrisati trošak „${expense.title}“ od ${dateFmt(expense.date)} (${money(expense.amount)})?`))return;
  runMutation(()=>sb.from('expenses').delete().eq('id',id).select('id').single(),'Trošak je obrisan.',()=>{if($('expenseEditId').value===id)resetExpenseForm()});
}
function showPage(name){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===name));document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===name));const titles={home:[greeting,'Evidencija smena, troškova i finansijski pregled BabyGuarda.'],shifts:['Sve smene','Pretraži i upravljaj završenim uslugama.'],expenses:['Troškovi','Unesi plaćene poslovne troškove i pregledaj evidenciju.'],stats:['Statistika','Finansijski rezultat i pregled učinka dadilja i porodica.'],settings:['Podešavanja','Rezervne kopije i informacije o čuvanju podataka.']};$('pageTitle').textContent=titles[name][0];$('pageSubtitle').textContent=titles[name][1];if(name==='stats'){renderStats();renderStatsFinance()}if(name==='shifts')renderAll();if(name==='expenses')renderExpenses();window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.goto)));
$('shiftForm').addEventListener('submit',async e=>{e.preventDefault();if(!shiftsReady||mutating)return;try{const id=$('editId').value;const s=toRow({date:$('date').value,family:$('family').value,sitter:$('sitter').value,shift_type:$('shiftType').value,hours:$('hours').value,charged:$('charged').value,paid:$('paid').value,description:$('description').value});await runMutation(()=>saveRecord('shifts',id,s),id?'Izmene su sačuvane.':'Smena je sačuvana.',resetForm)}catch(error){toast(error.message)}});
$('expenseForm').addEventListener('submit',async e=>{e.preventDefault();if(!expensesReady||mutating)return;try{const id=$('expenseEditId').value;const expense=normalizeExpense({date:$('expenseDate').value,title:$('expenseTitle').value,category:$('expenseCategory').value,amount:$('expenseAmount').value,payment_method:$('expensePayment').value,description:$('expenseDescription').value});await runMutation(()=>saveRecord('expenses',id,expense),id?'Trošak je izmenjen.':'Trošak je sačuvan.',resetExpenseForm)}catch(error){toast(error.message)}});
$('clearExpenseForm').addEventListener('click',resetExpenseForm);$('cancelExpenseEdit').addEventListener('click',resetExpenseForm);
$('newExpense').addEventListener('click',()=>{if(mutating)return;resetExpenseForm();$('expenseFormPanel').scrollIntoView({behavior:'smooth',block:'start'});$('expenseTitle').focus()});
['expenseSearch','expenseMonthFilter','expenseCategoryFilter','expensePaymentFilter'].forEach(id=>$(id).addEventListener(id==='expenseSearch'?'input':'change',renderExpenses));
$('clearExpenseFilters').addEventListener('click',()=>{['expenseSearch','expenseMonthFilter','expenseCategoryFilter','expensePaymentFilter'].forEach(id=>$(id).value='');renderExpenses()});
$('exportExpensesCsv').addEventListener('click',()=>{if(expensesReady)download('babyguard-troskovi.csv',expensesCsv(getFilteredExpenses()),'text/csv;charset=utf-8')});
$('retryLoad').addEventListener('click',()=>{if(!mutating)load()});
$('homeMonth').addEventListener('change',renderKpis);$('clearHomeMonth').addEventListener('click',()=>{$('homeMonth').value='';renderKpis()});
$('shiftForm').addEventListener('reset',()=>setTimeout(()=>{if(!$('editId').value)updatePreview()},0));$('cancelEdit').addEventListener('click',resetForm);$('newShift').addEventListener('click',()=>{showPage('home');resetForm();$('formPanel').scrollIntoView({behavior:'smooth'})});
document.addEventListener('click',e=>{if(mutating)return;const edit=e.target.closest('[data-edit]');const del=e.target.closest('[data-delete]');const expenseEdit=e.target.closest('[data-expense-edit]');const expenseDelete=e.target.closest('[data-expense-delete]');if(edit)editShift(edit.dataset.edit);if(del)deleteShift(del.dataset.delete);if(expenseEdit)editExpense(expenseEdit.dataset.expenseEdit);if(expenseDelete)deleteExpense(expenseDelete.dataset.expenseDelete)});
['search','monthFilter','sitterFilter','typeFilter'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',renderAll));$('clearFilters').addEventListener('click',()=>{$('search').value='';$('monthFilter').value='';$('sitterFilter').value='';$('typeFilter').value='';renderAll()});$('statsMonth').addEventListener('change',renderStats);$('clearStats').addEventListener('click',()=>{$('statsMonth').value='';renderStats()});
function download(name,content,type){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportJson(){if(!shiftsReady||!expensesReady)return;download('babyguard-rezervna-kopija.json',JSON.stringify({app:'BabyGuard Interna Evidencija',version:2,exportedAt:new Date().toISOString(),shifts,expenses},null,2),'application/json')}
function exportCsv(){if(!shiftsReady)return;const list=getFiltered();const heads=['Datum','Porodica','Dadilja','Vrsta','Sati','Naplaćeno RSD','Isplaćeno RSD','Profit RSD','Napomena'];const rows=list.map(s=>[s.date,s.family,s.sitter,typeLabel(s.shift_type),s.hours,s.charged,s.paid,profit(s),s.description].map(csvCell).join(';'));download('babyguard-smene.csv','\ufeff'+[heads.map(csvCell).join(';'),...rows].join('\r\n'),'text/csv;charset=utf-8')}
$('exportCsv').addEventListener('click',exportCsv);$('settingsExport').addEventListener('click',exportJson);
$('importFile').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file||mutating||!shiftsReady||!expensesReady)return;
  try{
    const backup=parseBackup(JSON.parse(await file.text()));
    const scope=backup.expenses===null?'Troškovi ostaju sačuvani.':`Postojećih ${expenses.length} troškova biće zamenjeno sa ${backup.expenses.length} iz kopije.`;
    if(!confirm(`Uvesti ${backup.shifts.length} smena umesto postojećih ${shifts.length}? ${scope} Pre uvoza izvezi trenutnu rezervnu kopiju.`))return;
    await runMutation(()=>sb.rpc('restore_babyguard_backup',{backup_shifts:backup.shifts,backup_expenses:backup.expenses}),
      'Rezervna kopija je uvezena.',()=>{resetForm();resetExpenseForm()});
  }catch(error){toast('Uvoz nije uspeo: '+error.message)}finally{e.target.value=''}
});
$('deleteAll').addEventListener('click',()=>{if(mutating||!shiftsReady)return;if(!shifts.length){toast('Nema smena za brisanje.');return}if(confirm('Obrisati SVE smene iz zajedničke baze? Troškovi ostaju sačuvani. Prvo izvezi rezervnu kopiju.')&&confirm('Poslednja potvrda: trajno obrisati sve smene?'))runMutation(()=>sb.rpc('restore_babyguard_backup',{backup_shifts:[],backup_expenses:null}),'Sve smene su obrisane. Troškovi su sačuvani.',resetForm)});
let greeting='Dobro došli!';
function userName(u){const m=u.user_metadata||{};const raw=m.display_name||m.full_name||m.name||u.email.split('@')[0].split(/[._\d-]/)[0];return raw.charAt(0).toLocaleUpperCase('sr')+raw.slice(1)}
function showApp(session){const name=userName(session.user);greeting=`${/a$/i.test(name)?'Dobro došla':'Dobro došao'}, ${name}!`;$('authScreen').classList.add('hidden');$('app').classList.remove('hidden');$('userEmail').textContent=session.user.email;resetForm();resetExpenseForm();showPage('home');load();resetIdle()}
function showLogin(){++loadEpoch;shifts=[];expenses=[];shiftsReady=false;expensesReady=false;resetForm();resetExpenseForm();['homeMonth','statsMonth','search','monthFilter','sitterFilter','typeFilter','expenseSearch','expenseMonthFilter','expenseCategoryFilter','expensePaymentFilter'].forEach(id=>$(id).value='');render();$('dataStatus').hidden=true;$('userEmail').textContent='';$('app').classList.add('hidden');$('authScreen').classList.remove('hidden')}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';$('loginBtn').disabled=true;const{data,error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});$('loginBtn').disabled=false;$('loginPassword').value='';if(error){$('loginError').textContent='Pogrešan email ili lozinka.';return}showApp(data.session)});
$('logoutBtn').addEventListener('click',async()=>{if(!confirm('Odjaviti se sa SVIH uređaja?'))return;await sb.auth.signOut({scope:'global'});showLogin()});
let lastActive=Date.now();
function resetIdle(){lastActive=Date.now()}
// Provera po vremenu, jer telefon u snu pauzira tajmere.
async function checkIdle(){if($('app').classList.contains('hidden')||Date.now()-lastActive<IDLE_MS)return;await sb.auth.signOut({scope:'local'});showLogin();$('loginError').textContent='Odjavljen si zbog neaktivnosti.'}
['click','keydown','touchstart','scroll','mousemove'].forEach(ev=>document.addEventListener(ev,resetIdle,{passive:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkIdle()});
setInterval(checkIdle,30000);
setupExpenses();
$('statsMonth').addEventListener('change',renderStatsFinance);
$('clearStats').addEventListener('click',renderStatsFinance);
sb.auth.getSession().then(({data})=>data.session?showApp(data.session):showLogin());
sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT')showLogin()});
