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
  const line = (text, x, size = 10, bold = false, color = [25,32,43]) => {
    page.commands.push(...textCommands(text, x, page.y, size, bold, color));
    page.y -= size * 1.35;
  };
  const textAt = (text, x, y, size = 10, bold = false, color = [25,32,43]) => {
    page.commands.push(...textCommands(text, x, y, size, bold, color));
  };

  line('ÉTKEZÉSI NAPLÓ', 48, 20, true, [20,90,160]);
  line(`${formatDate(start,{year:'numeric',month:'long',day:'numeric'})} – ${formatDate(end,{year:'numeric',month:'long',day:'numeric'})}`, 48, 11, false);
  line(`Generálás dátuma: ${new Intl.DateTimeFormat('hu-HU',{year:'numeric',month:'long',day:'numeric'}).format(generatedAt)}`, 48, 9, false, [90,100,112]);
  page.y -= 12;

  for (const date of daysBetween(start, end)) {
    const items = byDate.get(date) || [];
    const title = `${formatDate(date,{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · ${items.length} bejegyzés`;
    if (!items.length) {
      const titleLines = wrapText(title, 491, 12, true);
      const noteLines = wrapText('A bejegyzés hiánya nem bizonyítja, hogy aznap nem történt étkezés.', 471, 8, false);
      const height = emptyCardHeight(titleLines, noteLines);
      if (page.y - height < 54) addPage();
      drawCardBackground(page, page.y, height);
      let cursor = page.y - 12;
      titleLines.forEach(part => {
        textAt(part, 52, cursor - 12, 12, true, [18,73,132]);
        cursor -= 16;
      });
      cursor -= 7;
      textAt('Nincs rögzített étkezés', 62, cursor - 10, 10, false, [82,94,108]);
      cursor -= 16;
      noteLines.forEach(part => {
        textAt(part, 62, cursor - 8, 8, false, [105,113,124]);
        cursor -= 11;
      });
      page.y -= height + 12;
      continue;
    }

    let remaining = items.map(item => makeEntryLayout(item));
    let continuation = false;
    while (remaining.length) {
      const fragmentTitle = continuation ? `${title} (folytatás)` : title;
      const titleLines = wrapText(fragmentTitle, 491, 12, true);
      let available = page.y - 54;
      let count = fittingEntryCount(titleLines, remaining, available);

      if (!count && page.y < 790) {
        addPage();
        available = page.y - 54;
        count = fittingEntryCount(titleLines, remaining, available);
      }

      let fragment;
      if (!count) {
        const first = remaining[0];
        const base = cardHeight(titleLines, []);
        const maxEntryHeight = available - base;
        const fixedEntryHeight = 9 + 13 + 4 + 9;
        const maxLines = Math.max(1, Math.floor((maxEntryHeight - fixedEntryHeight) / 12));
        fragment = [{ ...first, lines: first.lines.slice(0, maxLines), height: entryHeight(first.lines.slice(0, maxLines)) }];
        const rest = first.lines.slice(maxLines);
        if (rest.length) remaining[0] = { ...first, label: `${first.label} (folytatás)`, lines: rest, height: entryHeight(rest) };
        else remaining.shift();
      } else {
        fragment = remaining.splice(0, count);
      }

      const height = cardHeight(titleLines, fragment);
      drawCardBackground(page, page.y, height);
      let cursor = page.y - 12;
      titleLines.forEach(part => {
        textAt(part, 52, cursor - 12, 12, true, [18,73,132]);
        cursor -= 16;
      });
      cursor -= 8;
      fragment.forEach(layout => {
        const bottom = cursor - layout.height;
        page.commands.push(`1 1 1 rg 52 ${bottom} 491 ${layout.height} re f`);
        page.commands.push(`0.78 0.86 0.95 RG 0.7 w 52 ${bottom} 491 ${layout.height} re S`);
        const headerY = cursor - 19;
        textAt(layout.label, 62, headerY, 10.5, true, [25,32,43]);
        let descriptionY = headerY - 17;
        layout.lines.forEach(part => {
          textAt(part, 62, descriptionY, 9.5, false, [45,55,68]);
          descriptionY -= 12;
        });
        cursor = bottom - 8;
      });
      page.y -= height + 12;
      continuation = true;
      if (remaining.length) addPage();
    }
  }
  pages.push(page);
  pages.forEach((item, index) => item.commands.push(...textCommands(`${index + 1} / ${pages.length}`, 510, 28, 8, false, [105,113,124])));
  return buildPdf(pages);
}

function newPage() { return { y: 790, commands: [] }; }

function makeEntryLayout(item) {
  const category = categoryMap[item.category];
  const label = `${item.mealTime}  ${(category && category.label) || item.category}`;
  const lines = wrapText(item.description, 471, 9.5, false);
  return { label, lines, height: entryHeight(lines) };
}

function entryHeight(lines) {
  return 9 + 13 + 4 + Math.max(1, lines.length) * 12 + 9;
}

function cardHeight(titleLines, entries) {
  const entriesHeight = entries.reduce((sum, item) => sum + item.height, 0);
  const gaps = Math.max(0, entries.length - 1) * 8;
  return 12 + titleLines.length * 16 + 8 + entriesHeight + gaps + 12;
}

function emptyCardHeight(titleLines, noteLines) {
  return 12 + titleLines.length * 16 + 7 + 16 + Math.max(1, noteLines.length) * 11 + 12;
}

function fittingEntryCount(titleLines, entries, available) {
  let count = 0;
  for (let index = 0; index < entries.length; index++) {
    const height = cardHeight(titleLines, entries.slice(0, index + 1));
    if (height > available) break;
    count = index + 1;
  }
  return count;
}

function drawCardBackground(page, top, height) {
  page.commands.push(`0.93 0.96 1 rg 42 ${top - height} 511 ${height} re f`);
  page.commands.push(`0.83 0.89 0.96 RG 0.7 w 42 ${top - height} 511 ${height} re S`);
}

function wrapText(text, maxWidth, size, bold) {
  const lines = [];
  for (const paragraph of String(text).replace(/\r/g,'').split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (approximateWidth(candidate, size, bold) <= maxWidth) current = candidate;
      else {
        if (current) lines.push(current);
        const pieces = splitLong(word, maxWidth, size, bold);
        lines.push(...pieces.slice(0, -1));
        current = pieces[pieces.length - 1] || '';
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [''];
}
function splitLong(text, maxWidth, size, bold) {
  const out=[];
  let current='';
  for (const char of text) {
    const candidate=current+char;
    if (current && approximateWidth(candidate,size,bold)>maxWidth) { out.push(current); current=char; }
    else current=candidate;
  }
  if (current) out.push(current);
  return out.length ? out : [''];
}

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
  const widths = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  let units = 0;
  for (const char of String(text)) {
    const base = char.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    units += widths[base] || widths[char] || 556;
  }
  return units * size / 1000;
}

const HELVETICA_WIDTHS = {
  ' ':278,'!':278,'"':355,"'":191,'(':333,')':333,',':278,'-':333,'.':278,'/':278,
  ':':278,';':278,'?':556,'@':1015,'–':556,'—':1000,'·':278,
  '0':556,'1':556,'2':556,'3':556,'4':556,'5':556,'6':556,'7':556,'8':556,'9':556,
  A:667,B:667,C:722,D:722,E:667,F:611,G:778,H:722,I:278,J:500,K:667,L:556,M:833,N:722,O:778,P:667,Q:778,R:722,S:667,T:611,U:722,V:667,W:944,X:667,Y:667,Z:611,
  a:556,b:556,c:500,d:556,e:556,f:278,g:556,h:556,i:222,j:222,k:500,l:222,m:833,n:556,o:556,p:556,q:556,r:333,s:500,t:278,u:556,v:500,w:722,x:500,y:500,z:500,
};

const HELVETICA_BOLD_WIDTHS = {
  ' ':278,'!':333,'"':474,"'":238,'(':333,')':333,',':278,'-':333,'.':278,'/':278,
  ':':333,';':333,'?':611,'@':975,'–':556,'—':1000,'·':278,
  '0':556,'1':556,'2':556,'3':556,'4':556,'5':556,'6':556,'7':556,'8':556,'9':556,
  A:722,B:722,C:722,D:722,E:667,F:611,G:778,H:722,I:278,J:556,K:722,L:611,M:833,N:722,O:778,P:667,Q:778,R:722,S:667,T:611,U:722,V:722,W:944,X:722,Y:722,Z:667,
  a:556,b:611,c:556,d:611,e:556,f:333,g:611,h:611,i:278,j:278,k:556,l:278,m:889,n:611,o:611,p:611,q:611,r:389,s:556,t:333,u:611,v:556,w:778,x:556,y:556,z:500,
};

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

