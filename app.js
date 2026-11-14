import { getAll, getByKey, put, remove, replaceJournalAtomically, mergeJournalAtomically, deleteMealDataAtomically } from './db.js';
import { CATEGORIES, categoryMap, localDate, localTime, parseLocalDate, addDays, daysBetween, startOfWeek, weekSwipeOffset, suggestedCategory, formatDate, uuid, validateEntry, compareEntries, escapeHtml, isValidRange } from './core.js';
import { buildBackup, suggestedBackupName, validateBackup, createMergePreview, finalizeMergePlan } from './backup.js';
import { createJournalPdf } from './pdf.js';

const DEFAULT_SETTINGS = {
  key:'app', onboardingDone:false, eveningReminderEnabled:false, eveningReminderTime:'20:00',
  lastEveningReminderDate:null, lastFullBackupConfirmedAt:null, backupSnoozedUntil:null
};

const state = {
  view:'journal', selectedDate:localDate(), entries:[], tombstones:[], settings:{...DEFAULT_SETTINGS}, draft:null,
  report:{preset:7,start:addDays(localDate(),-6),end:localDate()}, expanded:new Set(), modal:null, pdfUrl:null,
  editor:null, importData:null, mergePreview:null, onboardingPage:0
};

const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
let suppressCalendarClickUntil = 0;

boot().catch(error => fatal(error));

async function boot() {
  const [entries, tombstones, settings, draft] = await Promise.all([
    getAll('entries'), getAll('tombstones'), getByKey('settings','app'), getByKey('drafts','active')
  ]);
  state.entries = entries.sort(compareEntries);
  state.tombstones = tombstones;
  state.settings = {...DEFAULT_SETTINGS, ...(settings || {})};
  state.draft = draft || null;
  render();
  registerServiceWorker();
  if (!state.settings.onboardingDone) showOnboarding();
  else setTimeout(runOpenReminders, 250);
}

function render() {
  app.innerHTML = `<main class="app-shell">${renderTopbar()}${state.view === 'journal' ? renderJournal() : state.view === 'report' ? renderReport() : renderSettings()}</main>${renderBottomNav()}`;
  bindMainEvents();
}

function renderTopbar() {
  const titles = {journal:['Étkezési Napló',formatDate(state.selectedDate,{year:'numeric',month:'long',day:'numeric'})],report:['Jelentés','PDF készítése kiválasztott időszakról'],settings:['Beállítások','Mentés, visszaállítás és emlékeztetők']};
  return `<header class="topbar"><div><h1>${titles[state.view][0]}</h1><div class="topbar-subtitle">${titles[state.view][1]}</div></div>${state.view==='journal' && state.selectedDate!==localDate()?'<button class="ghost-button" data-action="today">Ma</button>':''}</header>`;
}

function renderBottomNav() {
  const items=[['journal','▤','Napló'],['report','▧','Jelentés'],['settings','⚙','Beállítások']];
  return `<nav class="bottom-nav" aria-label="Fő navigáció">${items.map(([id,icon,label])=>`<button class="nav-button ${state.view===id?'active':''}" data-view="${id}"><span>${icon}</span>${label}</button>`).join('')}</nav>`;
}

function renderJournal() {
  const week = startOfWeek(state.selectedDate);
  const weekDays = daysBetween(week, addDays(week,6));
  const selected = state.entries.filter(item=>item.mealDate===state.selectedDate).sort(compareEntries);
  return `<section>
    <div class="calendar-swipe" data-calendar-swipe role="group" aria-label="Heti naptár. Húzd balra vagy jobbra a hetek váltásához.">
      <div class="date-controls"><button class="icon-button" data-action="prev-week" aria-label="Előző hét">‹</button><strong>${formatDate(week,{month:'long',day:'numeric'})} – ${formatDate(addDays(week,6),{month:'long',day:'numeric'})}</strong><button class="icon-button" data-action="next-week" aria-label="Következő hét">›</button></div>
      <div class="week-strip">${weekDays.map(day=>renderDay(day)).join('')}</div>
    </div>
    <div class="date-controls"><button class="ghost-button" data-action="pick-date">📅 Dátum választása</button></div>
    <div>${selected.length?selected.map(renderEntry).join(''):`<div class="empty-state"><div class="empty-icon">🍽️</div><strong>Még nincs bejegyzés erre a napra</strong><p>Az üres nap nem jelenti azt, hogy nem ettél.</p></div>`}</div>
    <button class="fab" data-action="new-entry" aria-label="Új bejegyzés">+</button>
  </section>`;
}

function renderDay(day) {
  const date=parseLocalDate(day), has=state.entries.some(item=>item.mealDate===day);
  return `<button class="day-button ${day===state.selectedDate?'active':''} ${day===localDate()?'today':''}" data-date="${day}"><span class="weekday">${new Intl.DateTimeFormat('hu-HU',{weekday:'short'}).format(date).replace('.','')}</span><span class="day-number">${date.getDate()}</span>${has?'<i class="entry-dot"></i>':''}</button>`;
}

function renderEntry(entry) {
  const category=categoryMap[entry.category], expanded=state.expanded.has(entry.id), long=entry.description.length>130 || entry.description.split('\n').length>3;
  return `<article class="card entry-card" style="--entry-color:${category.color}" data-entry-id="${entry.id}"><div class="entry-color"></div><div class="entry-content"><div class="entry-header"><strong>${category.label}</strong><span class="entry-time">${entry.mealTime}</span></div><p class="entry-description ${expanded?'':'collapsed'}">${escapeHtml(entry.description)}</p>${long?`<button class="expand-button" data-expand="${entry.id}">${expanded?'Kevesebb':'Továbbiak'}</button>`:''}</div></article>`;
}

function renderReport() {
  const rangeValid=isValidRange(state.report.start,state.report.end);
  const items=rangeValid?state.entries.filter(x=>x.mealDate>=state.report.start&&x.mealDate<=state.report.end):[];
  const count=rangeValid?daysBetween(state.report.start,state.report.end).length:0;
  return `<section>
    <h2 class="section-title">Időszak</h2><div class="quick-ranges">${[[7,'Utolsó 7 nap'],[14,'Utolsó 14 nap'],[30,'Utolsó 30 nap'],['custom','Egyéni időszak']].map(([id,label])=>`<button class="${state.report.preset===id?'active':''}" data-range="${id}">${label}</button>`).join('')}</div>
    <div class="card"><div class="two-col"><div class="field"><label for="report-start">Kezdőnap</label><input id="report-start" type="date" value="${state.report.start}"></div><div class="field"><label for="report-end">Zárónap</label><input id="report-end" type="date" value="${state.report.end}"></div></div>${rangeValid?'':`<p class="error-text">A kezdőnap nem lehet későbbi a zárónapnál.</p>`}</div>
    <div class="card stats"><div class="stat"><strong>${count}</strong><span>kiválasztott nap</span></div><div class="stat"><strong>${items.length}</strong><span>mentett bejegyzés</span></div></div>
    <div class="card"><h3>PDF tartalma</h3><p class="muted">Minden kiválasztott nap szerepelni fog, az üres napok is. Az aktív piszkozat nem kerül a jelentésbe.</p><button class="primary" data-action="generate-pdf" ${rangeValid?'':'disabled'}>PDF elkészítése és előnézet</button></div>
  </section>`;
}

function renderSettings() {
  const last=state.settings.lastFullBackupConfirmedAt?new Intl.DateTimeFormat('hu-HU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(state.settings.lastFullBackupConfirmedAt)):'Még nincs visszaigazolt teljes mentés';
  return `<section>
    <h2 class="section-title">Emlékeztetők</h2><div class="card"><div class="settings-row"><div><div class="settings-row-title">Esti naplóellenőrzés</div><div class="small muted">Csak az alkalmazás használatakor jelez.</div></div><input class="toggle" id="evening-toggle" type="checkbox" ${state.settings.eveningReminderEnabled?'checked':''} aria-label="Esti emlékeztető"></div><div class="settings-row"><label for="evening-time" class="settings-row-title">Időpont</label><input id="evening-time" type="time" value="${state.settings.eveningReminderTime}" ${state.settings.eveningReminderEnabled?'':'disabled'}></div></div>
    <h2 class="section-title">Biztonsági mentés</h2><div class="card"><p class="small muted">${last}</p><div class="settings-row"><div><div class="settings-row-title">Biztonsági mentés készítése</div><div class="small muted">Az összes adat vagy egy kiválasztott időszak mentése fájlba.</div></div><button class="secondary" data-action="backup">Megnyitás</button></div><div class="settings-row"><div><div class="settings-row-title">Biztonsági mentés visszaállítása</div><div class="small muted">Korábbi mentés betöltése teljes cserével vagy intelligens egyesítéssel.</div></div><button class="secondary" data-action="restore">Fájl választása</button></div></div>
    <h2 class="section-title">Alkalmazás</h2><div class="card"><div class="settings-row"><div><div class="settings-row-title">Bemutató újraindítása</div><div class="small muted">A három első indítási képernyő megnyitása.</div></div><button class="secondary" data-action="onboarding">Indítás</button></div><div class="settings-row"><div><div class="settings-row-title">Összes étkezési adat törlése</div><div class="small muted">A bejegyzések és az aktív piszkozat törlése.</div></div><button class="danger-button" data-action="delete-all">Törlés</button></div></div>
    <div class="warning small">Az adatok ezen az eszközön maradnak. Az alkalmazás eltávolítása vagy a böngészőadatok törlése adatvesztést okozhat, ezért készíts rendszeresen teljes biztonsági mentést.</div>
  </section>`;
}

function bindMainEvents() {
  app.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{state.view=button.dataset.view;render();});
  app.querySelectorAll('[data-date]').forEach(button=>button.onclick=()=>{if(Date.now()<suppressCalendarClickUntil)return;state.selectedDate=button.dataset.date;render();});
  app.querySelectorAll('[data-expand]').forEach(button=>button.onclick=e=>{e.stopPropagation();const id=button.dataset.expand;state.expanded.has(id)?state.expanded.delete(id):state.expanded.add(id);render();});
  app.querySelectorAll('[data-entry-id]').forEach(card=>card.onclick=e=>{if(e.target.closest('[data-expand]'))return;openEditor(state.entries.find(x=>x.id===card.dataset.entryId));});
  app.querySelectorAll('[data-range]').forEach(button=>button.onclick=()=>setReportRange(button.dataset.range));
  const start=app.querySelector('#report-start'),end=app.querySelector('#report-end');
  if(start)start.onchange=()=>{state.report.start=start.value;state.report.preset='custom';render();};
  if(end)end.onchange=()=>{state.report.end=end.value;state.report.preset='custom';render();};
  const toggle=app.querySelector('#evening-toggle'); if(toggle)toggle.onchange=()=>saveSettings({eveningReminderEnabled:toggle.checked});
  const time=app.querySelector('#evening-time'); if(time)time.onchange=()=>saveSettings({eveningReminderTime:time.value});
  app.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>handleAction(button.dataset.action));
  bindCalendarSwipe();
}

function bindCalendarSwipe() {
  const surface=app.querySelector('[data-calendar-swipe]');
  if(!surface || !window.PointerEvent)return;
  let pointerId=null,startX=0,startY=0,dragging=false;
  const reset=()=>{pointerId=null;dragging=false;surface.classList.remove('is-dragging');surface.style.transform='';surface.style.opacity='';};
  surface.onpointerdown=event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    pointerId=event.pointerId;startX=event.clientX;startY=event.clientY;dragging=false;
  };
  surface.onpointermove=event=>{
    if(event.pointerId!==pointerId)return;
    const deltaX=event.clientX-startX,deltaY=event.clientY-startY;
    if(!dragging&&Math.abs(deltaX)>8&&Math.abs(deltaX)>Math.abs(deltaY)*1.2){
      dragging=true;surface.classList.add('is-dragging');
      try{surface.setPointerCapture(pointerId);}catch(error){}
    }
    if(dragging){
      const offset=Math.max(-28,Math.min(28,deltaX*.24));
      surface.style.transform=`translateX(${offset}px)`;
      surface.style.opacity=String(Math.max(.78,1-Math.abs(deltaX)/700));
    }
  };
  surface.onpointerup=event=>{
    if(event.pointerId!==pointerId)return;
    const offset=weekSwipeOffset(event.clientX-startX,event.clientY-startY);
    reset();
    if(!offset)return;
    suppressCalendarClickUntil=Date.now()+350;
    state.selectedDate=addDays(state.selectedDate,offset);
    render();
  };
  surface.onpointercancel=reset;
}

function handleAction(action) {
  if(action==='today'){state.selectedDate=localDate();render();}
  if(action==='prev-week'){state.selectedDate=addDays(state.selectedDate,-7);render();}
  if(action==='next-week'){state.selectedDate=addDays(state.selectedDate,7);render();}
  if(action==='pick-date')openDatePicker();
  if(action==='new-entry')startNewEntry();
  if(action==='generate-pdf')showPdfPreview();
  if(action==='backup')showBackupDialog();
  if(action==='restore')chooseRestoreFile();
  if(action==='onboarding')showOnboarding(true);
  if(action==='delete-all')startDeleteAll();
}

function setReportRange(value) {
  if(value==='custom'){state.report.preset='custom';render();return;}
  const days=Number(value); state.report={preset:days,start:addDays(localDate(),-(days-1)),end:localDate()}; render();
}

function openDatePicker() {
  showModal(`<h2>Dátum választása</h2><div class="field"><label for="date-picker">Nap</label><input id="date-picker" type="date" value="${state.selectedDate}"></div><div class="modal-actions"><button class="primary" id="date-choose">Megnyitás</button><button class="secondary" data-close>Vissza</button></div>`);
  modalRoot.querySelector('#date-choose').onclick=()=>{state.selectedDate=modalRoot.querySelector('#date-picker').value||state.selectedDate;closeModal();render();};
}

async function startNewEntry() {
  if(state.draft){
    showModal(`<h2>Félbehagyott bejegyzés</h2><p>Folytatod a korábbi piszkozatot, vagy elveted?</p><div class="modal-actions"><button class="primary" id="continue-draft">Folytatás</button><button class="danger-button" id="discard-draft">Elvetés</button><button class="secondary" data-close>Mégse</button></div>`);
    modalRoot.querySelector('#continue-draft').onclick=()=>{closeModal();openEditor(null,state.draft);};
    modalRoot.querySelector('#discard-draft').onclick=async()=>{await remove('drafts','active');state.draft=null;closeModal();openEditor();};
    return;
  }
  openEditor();
}

function openEditor(existing=null,draft=null,originalOverride=null) {
  const now=new Date();
  const initial=existing?{...existing}:draft?{...draft}:{mealDate:state.selectedDate,mealTime:localTime(now),category:suggestedCategory(localTime(now)),description:''};
  const isNew=!existing;
  state.editor={isNew,original:originalOverride || JSON.stringify(initial),entry:initial,categoryTouched:Boolean(draft),timer:null};
  modalRoot.innerHTML=`<div class="sheet-backdrop"><section class="bottom-sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><div class="sheet-header"><button class="ghost-button" id="editor-close">Mégse</button><h2>${isNew?'Új bejegyzés':'Bejegyzés szerkesztése'}</h2><button class="ghost-button" id="editor-save">Mentés</button></div>
    <div class="field"><span class="field-label">Kategória</span><div class="category-grid">${CATEGORIES.map(([id,label,color])=>`<button class="category-choice ${initial.category===id?'selected':''}" style="--cat-color:${color}" data-category="${id}"><i class="category-dot"></i>${label}</button>`).join('')}</div><div class="error-text" id="category-error"></div></div>
    <div class="two-col"><div class="field"><label for="meal-date">Dátum</label><input id="meal-date" type="date" value="${initial.mealDate}"><div class="error-text" id="mealDate-error"></div></div><div class="field"><label for="meal-time">Időpont</label><input id="meal-time" type="time" value="${initial.mealTime}"><div class="error-text" id="mealTime-error"></div></div></div>
    <div class="field"><label for="meal-description">Leírás</label><textarea id="meal-description" placeholder="Mit ettél vagy ittál? Lehetőleg az összetevőket is írd le.">${escapeHtml(initial.description)}</textarea><div class="error-text" id="description-error"></div></div>
    ${!isNew?'<button class="danger-button" id="entry-delete">Bejegyzés törlése</button>':''}</section></div>`;
  const sync=()=>{
    state.editor.entry.mealDate=modalRoot.querySelector('#meal-date').value;
    state.editor.entry.mealTime=modalRoot.querySelector('#meal-time').value;
    state.editor.entry.description=modalRoot.querySelector('#meal-description').value;
    if(isNew)scheduleDraftSave();
  };
  modalRoot.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>{state.editor.entry.category=button.dataset.category;state.editor.categoryTouched=true;modalRoot.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('selected',b===button));if(isNew)scheduleDraftSave();});
  modalRoot.querySelector('#meal-date').oninput=sync;
  modalRoot.querySelector('#meal-time').oninput=()=>{sync();if(isNew&&!state.editor.categoryTouched){state.editor.entry.category=suggestedCategory(state.editor.entry.mealTime);modalRoot.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('selected',b.dataset.category===state.editor.entry.category));}};
  const textarea=modalRoot.querySelector('#meal-description'); textarea.oninput=()=>{sync();textarea.style.height='auto';textarea.style.height=Math.min(textarea.scrollHeight,260)+'px';};
  modalRoot.querySelector('#editor-save').onclick=saveEditor;
  modalRoot.querySelector('#editor-close').onclick=closeEditor;
  if(!isNew)modalRoot.querySelector('#entry-delete').onclick=()=>confirmDeleteEntry(existing);
  setTimeout(()=>textarea.focus(),100);
}

function scheduleDraftSave() {
  clearTimeout(state.editor.timer);
  state.editor.timer=setTimeout(async()=>{
    const draft={...state.editor.entry,key:'active',updatedAt:new Date().toISOString()};
    await put('drafts',draft);state.draft=draft;
  },300);
}

async function saveEditor() {
  const item=state.editor.entry,errors=validateEntry(item);
  modalRoot.querySelectorAll('.error-text').forEach(node=>node.textContent='');
  Object.entries(errors).forEach(([key,msg])=>{const node=modalRoot.querySelector(`#${key}-error`);if(node)node.textContent=msg;});
  if(Object.keys(errors).length)return;
  const now=new Date().toISOString();
  const saved=state.editor.isNew?{...item,id:uuid(),createdAt:now,updatedAt:now,revision:1}:{...item,updatedAt:now,revision:(item.revision||1)+1};
  try{
    await put('entries',saved);
    if(state.editor.isNew){clearTimeout(state.editor.timer);await remove('drafts','active');state.draft=null;}
    const index=state.entries.findIndex(x=>x.id===saved.id); if(index>=0)state.entries[index]=saved;else state.entries.push(saved);state.entries.sort(compareEntries);
    state.selectedDate=saved.mealDate;modalRoot.innerHTML='';state.editor=null;render();toast('A bejegyzés mentve.');
  }catch(error){toast('A mentés nem sikerült. Az adatok nem vesztek el.','error');}
}

function closeEditor() {
  const changed=JSON.stringify(state.editor.entry)!==state.editor.original;
  if(!changed){modalRoot.innerHTML='';state.editor=null;return;}
  if(state.editor.isNew){
    clearTimeout(state.editor.timer);
    const draft={...state.editor.entry,key:'active',updatedAt:new Date().toISOString()};
    put('drafts',draft).then(()=>{state.draft=draft;toast('A piszkozatot megőriztük.');}).catch(()=>toast('A piszkozat mentése nem sikerült.','error'));
    modalRoot.innerHTML='';state.editor=null;return;
  }
  const editor=state.editor;
  showModal(`<h2>Mentetlen módosítások</h2><p>Mit szeretnél tenni?</p><div class="modal-actions"><button class="primary" id="save-changes">Módosítások mentése</button><button class="danger-button" id="discard-changes">Módosítások elvetése</button><button class="secondary" id="continue-edit">Szerkesztés folytatása</button></div>`);
  modalRoot.querySelector('#save-changes').onclick=()=>{state.editor=editor;openEditorFromStateAndSave(editor);};
  modalRoot.querySelector('#discard-changes').onclick=()=>{modalRoot.innerHTML='';state.editor=null;};
  modalRoot.querySelector('#continue-edit').onclick=()=>openEditor(editor.entry,null,editor.original);
}

function openEditorFromStateAndSave(editor){openEditor(editor.entry,null,editor.original);saveEditor();}

function confirmDeleteEntry(entry) {
  showModal(`<h2>Bejegyzés törlése?</h2><p>${escapeHtml(entry.mealTime)} – ${escapeHtml(categoryMap[entry.category].label)}</p><p class="muted">A törlés visszavonásához egy korábbi mentés és kézi konfliktusfeloldás szükséges.</p><div class="modal-actions"><button class="danger-button" id="confirm-delete">Törlés</button><button class="secondary" data-close>Mégse</button></div>`);
  modalRoot.querySelector('#confirm-delete').onclick=async()=>{
    const tomb={key:entry.id,id:entry.id,mealDate:entry.mealDate,deletedAt:new Date().toISOString(),revision:(entry.revision||1)+1};
    await Promise.all([remove('entries',entry.id),put('tombstones',tomb)]);state.entries=state.entries.filter(x=>x.id!==entry.id);state.tombstones.push(tomb);closeModal();state.editor=null;render();toast('A bejegyzés törölve.');
  };
}

function showPdfPreview() {
  try{
    const entries=state.entries.filter(x=>x.mealDate>=state.report.start&&x.mealDate<=state.report.end);
    const blob=createJournalPdf({start:state.report.start,end:state.report.end,entries});
    if(state.pdfUrl)URL.revokeObjectURL(state.pdfUrl);state.pdfUrl=URL.createObjectURL(blob);
    const fileName=`etkezesi_naplo_${state.report.start}_${state.report.end}.pdf`;
    modalRoot.innerHTML=`<section class="full-screen"><header class="preview-bar"><button class="ghost-button" id="preview-back">Vissza</button><strong>PDF-előnézet</strong><div class="preview-actions"><button class="secondary" id="pdf-share">Megosztás</button><button class="primary" id="pdf-download">Letöltés</button></div></header><iframe class="preview-frame" title="Étkezési napló PDF-előnézete" src="${state.pdfUrl}"></iframe></section>`;
    modalRoot.querySelector('#preview-back').onclick=()=>{modalRoot.innerHTML='';};
    modalRoot.querySelector('#pdf-download').onclick=()=>downloadBlob(blob,fileName);
    modalRoot.querySelector('#pdf-share').onclick=()=>shareFile(blob,fileName,'application/pdf');
  }catch(error){toast('A PDF elkészítése nem sikerült. Próbáld újra.','error');}
}

function showBackupDialog() {
  showModal(`<h2>Biztonsági mentés készítése</h2><div class="segmented"><button class="active" data-backup-type="full">Teljes mentés</button><button data-backup-type="partial">Részleges mentés</button></div><div id="partial-range" hidden><div class="two-col"><div class="field"><label>Kezdőnap<input id="backup-start" type="date" value="${addDays(localDate(),-6)}"></label></div><div class="field"><label>Zárónap<input id="backup-end" type="date" value="${localDate()}"></label></div></div></div><div class="card"><label class="settings-row">Alkalmazásbeállítások mentése <input class="toggle" id="backup-settings" type="checkbox" checked></label><label class="settings-row">Aktív piszkozat mentése <input class="toggle" id="backup-draft" type="checkbox" checked></label></div><div id="backup-summary" class="warning small"></div><div class="modal-actions"><button class="primary" id="create-backup">Mentési fájl letöltése</button><button class="secondary" id="share-backup">Megosztás</button><button class="secondary" data-close>Vissza</button></div>`);
  let type='full';
  const update=()=>{const start=modalRoot.querySelector('#backup-start').value,end=modalRoot.querySelector('#backup-end').value;const count=type==='full'?state.entries.length:state.entries.filter(x=>x.mealDate>=start&&x.mealDate<=end).length;modalRoot.querySelector('#backup-summary').textContent=type==='full'?`Teljes, katasztrófa utáni helyreállításra alkalmas mentés · ${count} bejegyzés`:`Részleges mentés · ${count} bejegyzés. Ez nem helyettesíti a teljes biztonsági mentést.`;};
  modalRoot.querySelectorAll('[data-backup-type]').forEach(button=>button.onclick=()=>{type=button.dataset.backupType;modalRoot.querySelectorAll('[data-backup-type]').forEach(x=>x.classList.toggle('active',x===button));modalRoot.querySelector('#partial-range').hidden=type==='full';update();});
  modalRoot.querySelectorAll('#backup-start,#backup-end').forEach(input=>input.onchange=update);update();
  const makeBackupFile=()=>{
    const start=modalRoot.querySelector('#backup-start').value,end=modalRoot.querySelector('#backup-end').value;
    const data=buildBackup({entries:state.entries,tombstones:state.tombstones,settings:state.settings,draft:state.draft,type,start,end,includeSettings:modalRoot.querySelector('#backup-settings').checked,includeDraft:modalRoot.querySelector('#backup-draft').checked});
    return {blob:new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),fileName:suggestedBackupName(type)};
  };
  const finishBackup=()=>{if(type==='full')askBackupConfirmation();else{closeModal();toast('A részleges mentés elkészült.');}};
  modalRoot.querySelector('#create-backup').onclick=()=>{
    try{const file=makeBackupFile();downloadBlob(file.blob,file.fileName);finishBackup();}catch(error){toast(error.message||'A mentés nem sikerült.','error');}
  };
  modalRoot.querySelector('#share-backup').onclick=async()=>{
    try{const file=makeBackupFile();if(await shareFile(file.blob,file.fileName,'application/json'))finishBackup();}catch(error){toast(error.message||'A megosztás nem sikerült.','error');}
  };
}

function askBackupConfirmation() {
  showModal(`<h2>Sikerült elmenteni a fájlt?</h2><p>A böngésző nem tudja biztosan ellenőrizni, hogy a fájlt valóban megőrizted-e.</p><div class="modal-actions"><button class="primary" id="backup-confirmed">Igen, elmentettem</button><button class="secondary" data-close>Még nem</button></div>`);
  modalRoot.querySelector('#backup-confirmed').onclick=async()=>{await saveSettings({lastFullBackupConfirmedAt:new Date().toISOString(),backupSnoozedUntil:null},false);closeModal();toast('A teljes mentés időpontját rögzítettük.');};
}

function chooseRestoreFile() {
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{
    const file=input.files?.[0];if(!file)return;
    try{const data=JSON.parse(await file.text());const validation=validateBackup(data);if(!validation.valid){showModal(`<h2>A fájl nem importálható</h2><div class="warning">${validation.errors.map(escapeHtml).join('<br>')}</div><div class="modal-actions"><button class="secondary" data-close>Bezárás</button></div>`);return;}state.importData=data;showRestoreMode();}catch(error){toast('A fájl nem olvasható vagy nem érvényes biztonsági mentés. Semmi sem változott.','error');}
  };input.click();
}

function showRestoreMode() {
  const partial=state.importData.backupType==='partial';
  showModal(`<h2>Visszaállítási mód</h2>${partial?'<div class="warning">Ez részleges mentés. A teljes csere minden jelenlegi étkezési adatot eltávolítana, majd csak ezt a részletet töltené vissza.</div>':''}<div class="card"><h3>Intelligens egyesítés</h3><p class="muted small">Azonosítók alapján összeveti az adatokat, és minden konfliktusról döntést kér.</p><button class="primary" id="restore-merge">Változások áttekintése</button></div><div class="card"><h3>Teljes csere</h3><p class="muted small">A jelenlegi étkezési adatok helyére a mentés tartalma kerül.</p><button class="danger-button" id="restore-replace">Teljes csere</button></div><button class="secondary" data-close>Vissza</button>`);
  modalRoot.querySelector('#restore-merge').onclick=()=>showMergePreview();modalRoot.querySelector('#restore-replace').onclick=()=>confirmFullReplace();
}

function showMergePreview() {
  state.mergePreview=createMergePreview(state.entries,state.tombstones,state.importData);const p=state.mergePreview;
  showModal(`<h2>Egyesítési előnézet</h2><div class="stats"><div class="stat"><strong>${p.add.length}</strong><span>új</span></div><div class="stat"><strong>${p.update.length}</strong><span>módosul</span></div><div class="stat"><strong>${p.unchanged.length}</strong><span>változatlan</span></div><div class="stat"><strong>${p.conflicts.length}</strong><span>ütközés</span></div></div>${p.conflicts.length?`<h3>Feloldandó ütközések</h3><div class="import-list">${p.conflicts.map(renderConflict).join('')}</div>`:'<p class="success">Nincs feloldandó ütközés.</p>'}<div class="modal-actions"><button class="primary" id="apply-merge">Egyesítés végrehajtása</button><button class="secondary" data-close>Mégse</button></div>`);
  modalRoot.querySelector('#apply-merge').onclick=applyMerge;
}

function renderConflict(conflict,index) {
  const label=conflict.incoming?`${conflict.incoming.mealDate} ${conflict.incoming.mealTime} – ${escapeHtml(conflict.incoming.description.slice(0,55))}`:`${conflict.current.mealDate} ${conflict.current.mealTime} – ${escapeHtml(conflict.current.description.slice(0,55))}`;
  if(conflict.kind==='deleted-locally')return `<div class="conflict"><strong>${label}</strong><div class="radio-stack"><label><input type="radio" name="conflict-${index}" value="keep-deleted" checked> Maradjon törölve</label><label><input type="radio" name="conflict-${index}" value="incoming"> Állítsa vissza a mentésből</label></div></div>`;
  if(conflict.kind==='deleted-in-backup')return `<div class="conflict"><strong>${label}</strong><div class="radio-stack"><label><input type="radio" name="conflict-${index}" value="current" checked> Helyi bejegyzés megtartása</label><label><input type="radio" name="conflict-${index}" value="delete"> Törlés átvétele</label></div></div>`;
  return `<div class="conflict"><strong>${label}</strong><div class="radio-stack"><label><input type="radio" name="conflict-${index}" value="current" checked> Helyi változat</label><label><input type="radio" name="conflict-${index}" value="incoming"> Mentésbeli változat</label></div></div>`;
}

async function applyMerge() {
  const choices={};state.mergePreview.conflicts.forEach((c,i)=>{choices[c.id]=modalRoot.querySelector(`input[name="conflict-${i}"]:checked`)?.value||c.choice;});
  const plan=finalizeMergePlan(state.mergePreview,choices);plan.importSettings=state.importData.settings?{...state.settings,...state.importData.settings}:null;plan.importDraft=state.importData.draft||null;
  try{await mergeJournalAtomically(plan);await reloadState();closeModal();render();showResult('Egyesítés kész',plan.add.length,plan.update.length,plan.deleteIds.length,state.mergePreview.unchanged.length+state.mergePreview.ignored.length);}catch(error){toast('Az import nem sikerült; a korábbi állapot megmaradt.','error');}
}

function confirmFullReplace() {
  const partial=state.importData.backupType==='partial';
  showModal(`<h2>Biztosan lecseréled az adatokat?</h2>${partial?'<div class="warning"><strong>Részleges mentésből végzett teljes csere:</strong> a mentésen kívüli összes jelenlegi étkezés elvész.</div>':'<p>A jelenlegi étkezési bejegyzések és piszkozat helyére a mentés tartalma kerül.</p>'}<label class="field"><span class="field-label">Megerősítésként írd be: CSERE</span><input id="replace-word" autocomplete="off"></label><div class="modal-actions"><button class="danger-button" id="replace-confirm" disabled>Adatok teljes cseréje</button><button class="secondary" data-close>Mégse</button></div>`);
  const input=modalRoot.querySelector('#replace-word'),button=modalRoot.querySelector('#replace-confirm');input.oninput=()=>button.disabled=input.value!=='CSERE';button.onclick=async()=>{try{await replaceJournalAtomically(state.importData);await reloadState();closeModal();render();showResult('Teljes csere kész',state.entries.length,0,0,0);}catch(error){toast('A csere nem sikerült; a korábbi állapot megmaradt.','error');}};
}

function showResult(title,added,updated,deleted,skipped){showModal(`<h2>${title}</h2><div class="stats"><div class="stat"><strong>${added}</strong><span>hozzáadott</span></div><div class="stat"><strong>${updated}</strong><span>módosított</span></div><div class="stat"><strong>${deleted}</strong><span>törölt</span></div><div class="stat"><strong>${skipped}</strong><span>kihagyott</span></div></div><div class="modal-actions"><button class="primary" data-close>Kész</button></div>`);}

function startDeleteAll() {
  showModal(`<h2>Összes étkezési adat törlése</h2><p>A törlés előtt ajánlott teljes biztonsági mentést készíteni.</p><div class="modal-actions"><button class="primary" id="backup-before-delete">Teljes mentés készítése</button><button class="danger-button" id="skip-to-delete">Tovább mentés nélkül</button><button class="secondary" data-close>Mégse</button></div>`);
  modalRoot.querySelector('#backup-before-delete').onclick=()=>showBackupDialog();modalRoot.querySelector('#skip-to-delete').onclick=confirmDeleteAll;
}

function confirmDeleteAll() {
  showModal(`<h2>Végleges törlés</h2><p>Minden étkezési bejegyzés és az aktív piszkozat törlődik. A beállítások megmaradnak.</p><label class="field"><span class="field-label">Megerősítésként írd be: TÖRLÉS</span><input id="delete-word" autocomplete="off"></label><div class="modal-actions"><button class="danger-button" id="delete-confirm" disabled>Végleges törlés</button><button class="secondary" data-close>Mégse</button></div>`);
  const input=modalRoot.querySelector('#delete-word'),button=modalRoot.querySelector('#delete-confirm');input.oninput=()=>button.disabled=input.value!=='TÖRLÉS';button.onclick=async()=>{await deleteMealDataAtomically();state.entries=[];state.tombstones=[];state.draft=null;closeModal();render();toast('Minden étkezési adat törölve.');};
}

function showOnboarding(replay=false) {
  state.onboardingPage=0;
  const pages=[['📝','Étkezések rögzítése','Írd le, mit ettél vagy ittál, lehetőleg az összetevőkkel és mennyiségekkel. A kategória és az időpont módosítható.'],['📄','Orvosi PDF','Válassz dátumtartományt, majd készíts áttekinthető, megosztható jelentést.'],['🔒','Helyi adatok és mentés','A napló az eszközödön marad. Készíts rendszeresen teljes biztonsági mentést, mert az alkalmazás eltávolításakor az adatok elveszhetnek.']];
  const draw=()=>{const [icon,title,text]=pages[state.onboardingPage];modalRoot.innerHTML=`<section class="onboarding"><div class="onboarding-card"><div class="onboarding-visual">${icon}</div><h1>${title}</h1><p>${text}</p><div class="dots">${pages.map((_,i)=>`<i class="${i===state.onboardingPage?'active':''}"></i>`).join('')}</div><div class="onboarding-actions"><button class="secondary" id="onboarding-skip">Kihagyás</button><button class="primary" id="onboarding-next">${state.onboardingPage===pages.length-1?'Kezdés':'Tovább'}</button></div></div></section>`;modalRoot.querySelector('#onboarding-skip').onclick=finish;modalRoot.querySelector('#onboarding-next').onclick=()=>{if(state.onboardingPage<pages.length-1){state.onboardingPage++;draw();}else finish();};};
  const finish=async()=>{if(!replay)await saveSettings({onboardingDone:true},false);modalRoot.innerHTML='';if(!replay)setTimeout(runOpenReminders,150);};draw();
}

async function runOpenReminders() {
  const now=new Date(),today=localDate(now),time=localTime(now);
  if(state.draft){
    showModal(`<h2>Félbehagyott bejegyzés</h2><p>Van egy automatikusan mentett piszkozatod.</p><div class="modal-actions"><button class="primary" id="open-draft">Folytatás</button><button class="danger-button" id="drop-draft">Elvetés</button><button class="secondary" data-close>Később</button></div>`);
    modalRoot.querySelector('#open-draft').onclick=()=>{closeModal();openEditor(null,state.draft);};modalRoot.querySelector('#drop-draft').onclick=async()=>{await remove('drafts','active');state.draft=null;closeModal();};return;
  }
  const last=state.settings.lastFullBackupConfirmedAt?new Date(state.settings.lastFullBackupConfirmedAt):null;
  const due=!last||Date.now()-last.getTime()>=7*86400000;
  const snoozed=state.settings.backupSnoozedUntil&&new Date(state.settings.backupSnoozedUntil)>now;
  if(due&&!snoozed){showModal(`<h2>Ideje biztonsági mentést készíteni</h2><p>Legalább 7 nap telt el az utolsó visszaigazolt teljes mentés óta.</p><div class="modal-actions"><button class="primary" id="reminder-backup">Biztonsági mentés készítése</button><button class="secondary" id="reminder-tomorrow">Emlékeztess holnap</button></div>`);modalRoot.querySelector('#reminder-backup').onclick=showBackupDialog;modalRoot.querySelector('#reminder-tomorrow').onclick=async()=>{await saveSettings({backupSnoozedUntil:new Date(Date.now()+86400000).toISOString()},false);closeModal();};return;}
  if(state.settings.eveningReminderEnabled&&time>=state.settings.eveningReminderTime&&state.settings.lastEveningReminderDate!==today){await saveSettings({lastEveningReminderDate:today},false);showModal(`<h2>Esti naplóellenőrzés</h2><p>Nézd át, hogy minden mai étkezést rögzítettél-e.</p><div class="modal-actions"><button class="primary" id="open-today">Mai nap megnyitása</button><button class="secondary" data-close>Rendben</button></div>`);modalRoot.querySelector('#open-today').onclick=()=>{state.view='journal';state.selectedDate=today;closeModal();render();};}
}

async function saveSettings(changes,rerender=true){state.settings={...state.settings,...changes,key:'app'};await put('settings',state.settings);if(rerender)render();}
async function reloadState(){const [entries,tombstones,settings,draft]=await Promise.all([getAll('entries'),getAll('tombstones'),getByKey('settings','app'),getByKey('drafts','active')]);state.entries=entries.sort(compareEntries);state.tombstones=tombstones;state.settings={...DEFAULT_SETTINGS,...(settings||{})};state.draft=draft||null;}

function showModal(content){modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">${content}</section></div>`;modalRoot.querySelectorAll('[data-close]').forEach(button=>button.onclick=closeModal);}
function closeModal(){modalRoot.innerHTML='';}
function toast(message,type=''){const root=document.querySelector('#toast-root');root.innerHTML=`<div class="toast ${type}">${escapeHtml(message)}</div>`;setTimeout(()=>{root.innerHTML='';},3600);}

function downloadBlob(blob,fileName) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=fileName;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function shareFile(blob,fileName,mime) {
  const file=new File([blob],fileName,{type:mime});
  if(!navigator.share||!navigator.canShare?.({files:[file]})){toast('A megosztás ezen a böngészőn nem érhető el. Használd a Letöltés gombot.','error');return false;}
  try{await navigator.share({files:[file],title:fileName});return true;}catch(error){if(error.name==='AbortError')return false;throw error;}
}

function registerServiceWorker(){if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>toast('Az offline mód előkészítése nem sikerült.','error')));}
function fatal(error){app.innerHTML=`<main class="app-shell"><div class="card"><h1>Az alkalmazás nem indítható</h1><p>${escapeHtml(error.message||String(error))}</p><p class="muted">Próbáld újratölteni az oldalt. Ha a hiba megmarad, ne töröld a böngésző adatait, mert azok tartalmazhatják a naplót.</p></div></main>`;}

