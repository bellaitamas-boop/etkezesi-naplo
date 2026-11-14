import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { suggestedCategory, addDays, daysBetween, startOfWeek, weekSwipeOffset, validateEntry, isValidRange } from '../core.js';
import { buildBackup, validateBackup, createMergePreview, finalizeMergePlan } from '../backup.js';
import { createJournalPdf } from '../pdf.js';

if (typeof Blob === 'undefined') {
  global.Blob=class TestBlob {
    constructor(parts,options={}) {
      this.bytes=Buffer.concat(parts.map(part=>Buffer.from(part)));
      this.size=this.bytes.length;
      this.type=options.type || '';
    }
    text() { return Promise.resolve(this.bytes.toString('latin1')); }
  };
}

let passed=0;
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`);}catch(error){console.error(`✗ ${name}`);throw error;}}
async function testAsync(name,fn){try{await fn();passed++;console.log(`✓ ${name}`);}catch(error){console.error(`✗ ${name}`);throw error;}}

test('időpont alapján helyes kategóriát javasol',()=>{
  assert.strictEqual(suggestedCategory('05:00'),'breakfast');
  assert.strictEqual(suggestedCategory('10:30'),'tens');
  assert.strictEqual(suggestedCategory('12:00'),'lunch');
  assert.strictEqual(suggestedCategory('16:00'),'snack');
  assert.strictEqual(suggestedCategory('20:00'),'dinner');
  assert.strictEqual(suggestedCategory('03:00'),'treat');
});

test('dátumműveletek hónaphatáron is helyesek',()=>{
  assert.strictEqual(addDays('2026-11-01',-1),'2026-10-31');
  assert.deepStrictEqual(daysBetween('2026-11-01','2026-11-03'),['2026-11-01','2026-11-02','2026-11-03']);
  assert.strictEqual(startOfWeek('2026-11-14'),'2026-11-09');
});

test('a heti naptár vízszintes húzása hetet vált, a függőleges görgetés nem',()=>{
  assert.strictEqual(weekSwipeOffset(-80,10),7);
  assert.strictEqual(weekSwipeOffset(80,10),-7);
  assert.strictEqual(weekSwipeOffset(30,4),0);
  assert.strictEqual(weekSwipeOffset(70,90),0);
});

test('hibás tartományt és üres leírást elutasít',()=>{
  assert.strictEqual(isValidRange('2026-11-14','2026-11-13'),false);
  assert.ok(validateEntry({category:'lunch',mealDate:'2026-11-14',mealTime:'12:00',description:'  '}).description);
});

const entry={id:'a',mealDate:'2026-11-14',mealTime:'12:00',category:'lunch',description:'Leves',createdAt:'2026-11-14T11:00:00.000Z',updatedAt:'2026-11-14T11:00:00.000Z',revision:1};
test('teljes és részleges mentés tartalma helyes',()=>{
  const full=buildBackup({entries:[entry],tombstones:[],settings:{key:'app'},draft:null,type:'full'});
  assert.strictEqual(full.entryCount,1);assert.strictEqual(validateBackup(full).valid,true);
  const partial=buildBackup({entries:[entry],tombstones:[],settings:{},draft:null,type:'partial',start:'2026-11-01',end:'2026-11-10'});
  assert.strictEqual(partial.entryCount,0);
});

test('érvénytelen mentés nem fogadható el',()=>{
  const result=validateBackup({schema:'más',schemaVersion:99,backupType:'full',entries:[]});
  assert.strictEqual(result.valid,false);assert.ok(result.errors.length>=2);
});

test('egyesítés nem duplikál és jelzi a konfliktust',()=>{
  const same={...entry};
  const newer={...entry,id:'b',revision:2,description:'Új'};
  const conflict={...entry,id:'c',description:'Mentés'};
  const currentConflict={...conflict,description:'Helyi'};
  const backup={entries:[same,newer,conflict],tombstones:[]};
  const preview=createMergePreview([entry,{...newer,revision:1},currentConflict],[],backup);
  assert.strictEqual(preview.unchanged.length,1);assert.strictEqual(preview.update.length,1);assert.strictEqual(preview.conflicts.length,1);
  const plan=finalizeMergePlan(preview,{c:'incoming'});assert.ok(plan.update.some(x=>x.id==='c'));
});

test('a PWA-manifest érvényes és minden ikon létezik',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(projectRoot,'manifest.webmanifest'),'utf8'));
  assert.strictEqual(manifest.display,'standalone');
  for(const icon of manifest.icons) assert.ok(fs.existsSync(path.join(projectRoot,icon.src)));
});

test('az offline alkalmazáshéj minden hivatkozott fájlja létezik',()=>{
  const sw=fs.readFileSync(path.join(projectRoot,'sw.js'),'utf8');
  const match=sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);
  assert.ok(match);
  const files=[...match[1].matchAll(/'\.\/([^']*)'/g)].map(item=>item[1]||'index.html');
  for(const file of files) assert.ok(fs.existsSync(path.join(projectRoot,file || 'index.html')),`Hiányzó fájl: ${file}`);
});

async function runPdfTest() {
  await testAsync('a PDF hosszú ételleírásokat több oldalra tördel',async()=>{
    const entries=Array.from({length:20},(_,index)=>({
      id:`pdf-${index}`,
      mealDate:'2026-11-14',
      mealTime:`${String(8 + Math.floor(index / 4)).padStart(2,'0')}:${String((index % 4) * 15).padStart(2,'0')}`,
      category:'lunch',
      description:'Hosszú ételleírás zöldségekkel, körettel és egy második sorba tördelendő megjegyzéssel.',
    }));
    const blob=createJournalPdf({start:'2026-11-14',end:'2026-11-14',entries});
    const raw=await blob.text();
    const pageMatch=raw.match(/\/Count (\d+)/);
    const pageCount=Number((pageMatch && pageMatch[1]) || 0);
    assert.strictEqual(blob.type,'application/pdf');
    assert.ok(pageCount>=2,'A hosszú naplónak több oldalra kell törnie.');
  });
  console.log(`\n${passed} teszt sikeres.`);
}

runPdfTest().catch(error => { console.error(error); process.exitCode=1; });

