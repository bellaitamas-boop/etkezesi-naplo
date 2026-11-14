import { categoryMap, daysBetween, formatDate } from './core.js';

// Kis, függőségmentes PDF-író. A standard Helvetica WinAnsi készletet használja;
// a magyar ő/ű kettős ékezetét külön vektorgrafika rajzolja ki.
export function createJournalPdf({ start, end, entries, generatedAt = new Date() }) {
  const byDate = new Map();
  entries.forEach(item => {
    if (!byDate.has(item.mealDate)) byDate.set(item.mealDate, []);
    byDate.get(item.mealDate).push(item);
  });
  byDate.forEach(items => items.sort((a,b) => a.mealTime.localeCompare(b.mealTime)));

  const pages = [];
  let page = newPage();
  const addPage = () => { pages.push(page); page = newPage(); };
  const ensure = height => { if (page.y - height < 54) addPage(); };
  const line = (text, x, size = 10, bold = false, color = [25,32,43]) => {
    page.commands.push(...textCommands(text, x, page.y, size, bold, color));
    page.y -= size * 1.35;
  };

  line('ÉTKEZÉSI NAPLÓ', 48, 20, true, [20,90,160]);
  line(`${formatDate(start,{year:'numeric',month:'long',day:'numeric'})} – ${formatDate(end,{year:'numeric',month:'long',day:'numeric'})}`, 48, 11, false);
  line(`Generálás dátuma: ${new Intl.DateTimeFormat('hu-HU',{year:'numeric',month:'long',day:'numeric'}).format(generatedAt)}`, 48, 9, false, [90,100,112]);
  page.y -= 12;

  for (const date of daysBetween(start, end)) {
    const items = byDate.get(date) || [];
    ensure(58);
    page.commands.push(`0.93 0.96 1 rg 42 ${page.y - 27} 511 32 re f`);
    line(`${formatDate(date,{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · ${items.length} bejegyzés`, 50, 12, true, [18,73,132]);
    page.y -= 12;
    if (!items.length) {
      line('Nincs rögzített étkezés', 52, 10, false, [95,104,116]);
      line('A bejegyzés hiánya nem bizonyítja, hogy aznap nem történt étkezés.', 52, 8, false, [105,113,124]);
      page.y -= 10;
      continue;
    }
    for (const item of items) {
      const descLines = wrapText(item.description, 76);
      const needed = 27 + descLines.length * 13;
      ensure(needed);
      line(`${item.mealTime}  ${categoryMap[item.category]?.label || item.category}`, 52, 10.5, true);
      for (const part of descLines) line(part, 68, 9.5, false);
      page.y -= 8;
    }
  }
  pages.push(page);
  pages.forEach((item, index) => item.commands.push(...textCommands(`${index + 1} / ${pages.length}`, 510, 28, 8, false, [105,113,124])));
  return buildPdf(pages);
}

function newPage() { return { y: 790, commands: [] }; }

function wrapText(text, maxChars) {
  const lines = [];
  for (const paragraph of String(text).replace(/\r/g,'').split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let current = '';
    for (const word of words) {
      if (!current) current = word;
      else if ((current + ' ' + word).length <= maxChars) current += ' ' + word;
      else { lines.push(...splitLong(current, maxChars)); current = word; }
    }
    if (current) lines.push(...splitLong(current, maxChars));
  }
  return lines;
}
function splitLong(text, max) { const out=[]; for(let i=0;i<text.length;i+=max) out.push(text.slice(i,i+max)); return out; }

function textCommands(text, x, y, size, bold, color) {
  const safe = String(text).replace(/[őŐűŰ]/g, c => ({'ő':'o','Ő':'O','ű':'u','Ű':'U'}[c]));
  const font = bold ? 'F2' : 'F1';
  const [r,g,b] = color.map(v => (v/255).toFixed(3));
  const commands = [`BT /${font} ${size} Tf ${r} ${g} ${b} rg 1 0 0 1 ${x} ${y} Tm (${pdfString(safe)}) Tj ET`];
  let cursor = 0;
  for (let i=0;i<text.length;i++) {
    const ch = text[i];
    if ('őŐűŰ'.includes(ch)) {
      const charX = x + approximateWidth(safe.slice(0,i), size, bold);
      const w = approximateWidth(safe[i], size, bold);
      const top = y + size * .82;
      commands.push(`${r} ${g} ${b} RG 0.8 w ${charX + w*.34} ${top} m ${charX + w*.47} ${top + size*.18} l S`);
      commands.push(`${r} ${g} ${b} RG 0.8 w ${charX + w*.58} ${top} m ${charX + w*.71} ${top + size*.18} l S`);
    }
    cursor++;
  }
  return commands;
}

function approximateWidth(text, size, bold) {
  let units = 0;
  for (const c of text) units += /[ilI1.,:;!']/u.test(c) ? .28 : /[MWmw@]/u.test(c) ? .86 : /\s/u.test(c) ? .28 : .54;
  return units * size * (bold ? 1.03 : 1);
}

function pdfString(text) {
  const cp1252 = {'€':128,'‚':130,'„':132,'…':133,'†':134,'‡':135,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
  let out='';
  for (const ch of text) {
    const code = cp1252[ch] == null ? ch.charCodeAt(0) : cp1252[ch];
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (code < 32 || code > 126) out += '\\' + code.toString(8).padStart(3,'0');
    else out += ch;
  }
  return out;
}

function buildPdf(pages) {
  const objects = [];
  const add = content => { objects.push(content); return objects.length; };
  const catalogId = add('');
  const pagesId = add('');
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const boldFontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds = [];
  for (const page of pages) {
    const stream = page.commands.join('\n');
    const contentId = add(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[catalogId-1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId-1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n%âãÏÓ\n';
  const offsets = [0];
  objects.forEach((object,index) => { offsets.push(byteLength(pdf)); pdf += `${index+1} 0 obj\n${object}\nendobj\n`; });
  const xref = byteLength(pdf);
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10,'0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([binaryStringToBytes(pdf)], { type:'application/pdf' });
}

function binaryStringToBytes(value) { const bytes=new Uint8Array(value.length); for(let i=0;i<value.length;i++) bytes[i]=value.charCodeAt(i)&255; return bytes; }
function byteLength(value) { return value.length; }
