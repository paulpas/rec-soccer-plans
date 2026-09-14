#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────────────────

function exitError(msg) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const monthName = months[d.getMonth()];
  return {
    full: `${monthName} ${d.getDate()}`,
    upper: `${monthName.toUpperCase()} ${d.getDate()}`,
    short: `${monthName.slice(0, 3)} ${d.getDate()}`
  };
}

function extractWeekNumber(filename) {
  const match = filename.match(/^week(\d+)/i);
  return match ? match[1] : null;
}

function extractDayFromFilename(filename) {
  const lower = filename.toLowerCase();
  const dayMatch = lower.match(/_(mon|tue|wed|thu|fri|sat)_/);
  if (dayMatch) {
    const map = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
    return map[dayMatch[1]];
  }
  return null;
}

function buildStorageKey(filename) {
  const base = filename.replace(/_lesson_plan_enhanced\.html$/, '');
  return base.replace(/_/g, '-') + '-lesson-plan';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Validation ───────────────────────────────────────────────────────

function validateSpec(spec) {
  const errors = [];

  const requiredFields = ['filename', 'practiceDate', 'practiceDay', 'startTime', 'endTime', 'playerCount', 'h1Title', 'segments'];
  for (const field of requiredFields) {
    if (spec[field] === undefined || spec[field] === null) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  if (errors.length > 0) {
    exitError(errors.join('. '));
  }

  // Validate filename
  if (typeof spec.filename !== 'string' || spec.filename.trim() === '') {
    exitError('Field "filename" must be a non-empty string.');
  }

  // Validate date
  const dateFormatted = formatDate(spec.practiceDate);
  if (!dateFormatted) {
    exitError(`Invalid practiceDate "${spec.practiceDate}". Must be YYYY-MM-DD format.`);
  }

  // Validate times
  if (typeof spec.startTime !== 'string' || spec.startTime.trim() === '') {
    exitError('Field "startTime" must be a non-empty string.');
  }
  if (typeof spec.endTime !== 'string' || spec.endTime.trim() === '') {
    exitError('Field "endTime" must be a non-empty string.');
  }

  // Validate playerCount
  if (typeof spec.playerCount !== 'number' || spec.playerCount < 1) {
    exitError('Field "playerCount" must be a positive number.');
  }

  // Validate h1Title
  if (typeof spec.h1Title !== 'string' || spec.h1Title.trim() === '') {
    exitError('Field "h1Title" must be a non-empty string.');
  }

  // Validate segments
  if (!Array.isArray(spec.segments) || spec.segments.length === 0) {
    exitError('Field "segments" must be a non-empty array.');
  }

  const segmentIds = new Set();
  for (let i = 0; i < spec.segments.length; i++) {
    const seg = spec.segments[i];
    const prefix = `segments[${i}]`;

    if (typeof seg.id !== 'string' || seg.id.trim() === '') {
      exitError(`${prefix}: "id" must be a non-empty string.`);
    }
    if (segmentIds.has(seg.id)) {
      exitError(`${prefix}: duplicate segment id "${seg.id}".`);
    }
    segmentIds.add(seg.id);

    if (typeof seg.title !== 'string' || seg.title.trim() === '') {
      exitError(`${prefix}: "title" must be a non-empty string.`);
    }
    if (typeof seg.time !== 'string' || seg.time.trim() === '') {
      exitError(`${prefix}: "time" must be a non-empty string.`);
    }
    if (!Array.isArray(seg.checklist) || seg.checklist.length === 0) {
      exitError(`${prefix}: "checklist" must be a non-empty array.`);
    }
    for (let j = 0; j < seg.checklist.length; j++) {
      if (typeof seg.checklist[j] !== 'string' || seg.checklist[j].trim() === '') {
        exitError(`${prefix}.checklist[${j}]: must be a non-empty string.`);
      }
    }
  }

  // Validate optional playerTracker
  if (spec.playerTracker !== undefined && typeof spec.playerTracker !== 'boolean') {
    exitError('Field "playerTracker" must be a boolean.');
  }
}

// ── Player tracker HTML ──────────────────────────────────────────────

function buildPlayerTracker() {
  const players = [
    { id: 'emilia', name: 'Emilia' },
    { id: 'maverick', name: 'Maverick' },
    { id: 'ellie', name: 'Ellie' },
    { id: 'amelia', name: 'Amelia' },
    { id: 'zenobia', name: 'Zenobia' },
    { id: 'hannah', name: 'Hannah' },
    { id: 'cate', name: 'Cate' }
  ];

  const playerRows = players.map(p =>
    `        <tr><td>${p.name}</td><td><input type="checkbox" id="pt-${p.id}-att"></td><td><input type="checkbox" id="pt-${p.id}-hw"></td><td><input type="checkbox" id="pt-${p.id}-effort"></td><td class="notes-cell"><textarea class="player-notes" id="pt-${p.id}-notes" placeholder="Notes..." rows="2"></textarea></td></tr>`
  ).join('\n');

  return `
<!-- PLAYER TRACKER -->
<div class="segment" data-seg="player-tracker">
  <div class="seg-head">
    <div><div class="seg-time">AT A GLANCE</div><div class="seg-title">Player Tracker</div></div>
    <div class="seg-count" data-count-for="player-tracker">0/21</div>
  </div>
  <div class="checklist">
    <table class="pt-table">
      <thead>
        <tr><th>Player Name</th><th>Attended</th><th>Homework</th><th>Strong Effort</th><th>Notes</th></tr>
      </thead>
      <tbody>
${playerRows}
      </tbody>
    </table>
  </div>
  <div class="notes-block">
    <label class="notes-label" for="player-tracker-notes">Coach notes — player observations</label>
    <textarea id="player-tracker-notes" placeholder="e.g. who stood out today, who struggled, rotation notes..."></textarea>
  </div>
</div>`;
}

// ── Segment HTML ─────────────────────────────────────────────────────

function buildSegment(seg, index) {
  const checklistItems = seg.checklist.map((item, i) => {
    const itemId = `${seg.id}-${i + 1}`;
    return `    <div class="item"><input type="checkbox" id="${itemId}"><label for="${itemId}">${escapeHtml(item)}</label></div>`;
  }).join('\n');

  const diagramBlock = seg.diagramNote && seg.diagramNote.trim()
    ? `  <div class="diagram-block">\n    <p class="diagram-note">${escapeHtml(seg.diagramNote.trim())}</p>\n  </div>`
    : '';

  const notesPlaceholder = seg.notesPlaceholder || 'e.g. what worked, what needs adjustment...';

  return `
<!-- SEGMENT ${index + 1} -->
<div class="segment" data-seg="${seg.id}">
  <div class="seg-head">
    <div><div class="seg-time">${escapeHtml(seg.time)}</div><div class="seg-title">${escapeHtml(seg.title)}</div></div>
    <div class="seg-count" data-count-for="${seg.id}">0/${seg.checklist.length}</div>
  </div>
${diagramBlock}
  <div class="checklist">
${checklistItems}
  </div>
  <div class="notes-block">
    <label class="notes-label" for="${seg.id}-notes">Coach notes</label>
    <textarea id="${seg.id}-notes" placeholder="${escapeHtml(notesPlaceholder)}"></textarea>
  </div>
</div>`;
}

// ── JavaScript generation ────────────────────────────────────────────

function buildJavaScript(spec) {
  const storageKey = buildStorageKey(spec.filename);
  const weekNum = extractWeekNumber(spec.filename) || '?';
  const dayUpper = spec.practiceDay.toUpperCase();
  const copyHeader = spec.copyHeader || `WEEK ${weekNum} ${dayUpper} NOTES\n\n`;

  // Build segment IDs list (include player-tracker if needed)
  let allSegIds = [...spec.segments.map(s => s.id)];
  const hasPlayerTracker = spec.playerTracker === true;
  if (hasPlayerTracker) {
    allSegIds.unshift('player-tracker');
  }

  // Build titles map (no HTML escaping needed — these are JS string literals for clipboard output)
  const titlesEntries = spec.segments.map(s => `    '${s.id}':'${s.title}'`);
  if (hasPlayerTracker) {
    titlesEntries.unshift("    'player-tracker':'Player Tracker'");
  }

  // Build player tracker JS for collectState/applyState/copy
  let playerTrackerJS = '';
  if (hasPlayerTracker) {
    playerTrackerJS = `
  ['emilia','maverick','ellie','amelia','zenobia','hannah','cate'].forEach(name=>{
    const el = document.getElementById('pt-'+name+'-notes');
    if(el) state.playerNotes[name] = el.value;
  });`;

    // In applyState
    let playerApplyJS = `  if(state.playerNotes){
    ['emilia','maverick','ellie','amelia','zenobia','hannah','cate'].forEach(name=>{
      const el = document.getElementById('pt-'+name+'-notes');
      if(el && state.playerNotes[name]) el.value = state.playerNotes[name];
    });
  }`;

    // In copyBtn
    let playerCopyJS = `  const players = [
    {id:'emilia',name:'Emilia'},{id:'maverick',name:'Maverick'},
    {id:'ellie',name:'Ellie'},{id:'amelia',name:'Amelia'},
    {id:'zenobia',name:'Zenobia'},{id:'hannah',name:'Hannah'},
    {id:'cate',name:'Cate'}
  ];
  const effort = players.filter(p=>document.getElementById('pt-'+p.id+'-effort').checked).map(p=>p.name);
  const attended = players.filter(p=>document.getElementById('pt-'+p.id+'-att').checked).map(p=>p.name);
  if(attended.length || effort.length){
    out += '\\nPLAYER TRACKER\\n';
    if(attended.length) out += 'Attended: '+attended.join(', ')+'\\n';
    if(effort.length) out += 'Strong Effort: '+effort.join(', ')+'\\n';
  }`;

    // Build carry into header
    const carryLabel = spec.carryInto ? `WEEK ${spec.carryInto}` : 'NEXT WEEK';

    return `const STORAGE_KEY = '${storageKey}';
const segmentIds = [${allSegIds.map(id => `'${id}'`).join(',')}];

function collectState(){
  const state = { segments:{}, carryForward: document.getElementById('carry-forward').value, playerNotes:{} };
  segmentIds.forEach(seg=>{
    const items = {};
    document.querySelectorAll(\`[data-seg="\${seg}"] input[type=checkbox]\`).forEach(cb=>{
      items[cb.id] = cb.checked;
    });
    const notesEl = document.getElementById(seg+'-notes');
    state.segments[seg] = { items, notes: notesEl ? notesEl.value : '' };
  });${playerTrackerJS}
  return state;
}

function applyState(state){
  if(!state) return;
  segmentIds.forEach(seg=>{
    const segState = state.segments && state.segments[seg];
    if(!segState) return;
    Object.entries(segState.items || {}).forEach(([id, checked])=>{
      const el = document.getElementById(id);
      if(el){ el.checked = checked; const item = el.closest('.item'); if(item) item.classList.toggle('checked', checked); }
    });
    const notesEl = document.getElementById(seg+'-notes');
    if(notesEl && segState.notes) notesEl.value = segState.notes;
  });${playerApplyJS}
  if(state.carryForward){
    document.getElementById('carry-forward').value = state.carryForward;
  }
  updateCounts();
}

let saveTimer = null;
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    try{
      const state = collectState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      showSavedPill();
    }catch(err){
      console.error('Storage save failed:', err);
    }
  }, 350);
}

function showSavedPill(){
  const pill = document.getElementById('savePill');
  pill.textContent = 'saved';
  pill.classList.add('show');
  clearTimeout(showSavedPill._t);
  showSavedPill._t = setTimeout(()=> pill.classList.remove('show'), 1200);
}

function updateCounts(){
  let totalDone = 0, totalAll = 0;
  segmentIds.forEach(seg=>{
    const boxes = document.querySelectorAll(\`[data-seg="\${seg}"] input[type=checkbox]\`);
    const done = Array.from(boxes).filter(b=>b.checked).length;
    totalDone += done; totalAll += boxes.length;
    const countEl = document.querySelector(\`[data-count-for="\${seg}"]\`);
    if(countEl) countEl.textContent = \`\${done}/\${boxes.length}\`;
  });
  document.getElementById('progressLabel').textContent = \`\${totalDone} / \${totalAll} done\`;
  document.getElementById('progressFill').style.width = totalAll ? \`\${(totalDone/totalAll)*100}%\` : '0%';
}

document.querySelectorAll('input[type=checkbox]').forEach(cb=>{
  cb.addEventListener('change', ()=>{
    const item = cb.closest('.item');
    if(item) item.classList.toggle('checked', cb.checked);
    updateCounts();
    scheduleSave();
  });
});
document.querySelectorAll('textarea').forEach(t=>{
  t.addEventListener('input', scheduleSave);
});

document.getElementById('resetBtn').addEventListener('click', ()=>{
  if(!confirm('Reset all checkboxes for this session? Notes will stay.')) return;
  document.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.checked = false; cb.closest('.item').classList.remove('checked');
  });
  updateCounts();
  scheduleSave();
});

document.getElementById('copyBtn').addEventListener('click', async ()=>{
  const state = collectState();
  let out = ${JSON.stringify(copyHeader)};
  const titles = {
${titlesEntries.join(',\n')}
  };
  segmentIds.forEach(seg=>{
    const notes = state.segments[seg].notes;
    if(notes && notes.trim()){
      out += \`\${titles[seg]}:\\n\${notes.trim()}\\n\\n\`;
    }
  });
  if(state.carryForward && state.carryForward.trim()){${playerCopyJS}
    out += \`CARRY INTO \${carryLabel}:\\n\${state.carryForward.trim()}\\n\`;
  }
  try{
    await navigator.clipboard.writeText(out);
    const btn = document.getElementById('copyBtn');
    const old = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(()=> btn.textContent = old, 1400);
  }catch(err){
    alert(out);
  }
});

(function init(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    applyState(JSON.parse(raw));
  }
  updateCounts();
})();`;
  }

  // Without player tracker
  return `const STORAGE_KEY = '${storageKey}';
const segmentIds = [${allSegIds.map(id => `'${id}'`).join(',')}];

function collectState(){
  const state = { segments:{}, carryForward: document.getElementById('carry-forward').value };
  segmentIds.forEach(seg=>{
    const items = {};
    document.querySelectorAll(\`[data-seg="\${seg}"] input[type=checkbox]\`).forEach(cb=>{
      items[cb.id] = cb.checked;
    });
    const notesEl = document.getElementById(seg+'-notes');
    state.segments[seg] = { items, notes: notesEl ? notesEl.value : '' };
  });
  return state;
}

function applyState(state){
  if(!state) return;
  segmentIds.forEach(seg=>{
    const segState = state.segments && state.segments[seg];
    if(!segState) return;
    Object.entries(segState.items || {}).forEach(([id, checked])=>{
      const el = document.getElementById(id);
      if(el){ el.checked = checked; const item = el.closest('.item'); if(item) item.classList.toggle('checked', checked); }
    });
    const notesEl = document.getElementById(seg+'-notes');
    if(notesEl && segState.notes) notesEl.value = segState.notes;
  });
  if(state.carryForward){
    document.getElementById('carry-forward').value = state.carryForward;
  }
  updateCounts();
}

let saveTimer = null;
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    try{
      const state = collectState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      showSavedPill();
    }catch(err){
      console.error('Storage save failed:', err);
    }
  }, 350);
}

function showSavedPill(){
  const pill = document.getElementById('savePill');
  pill.textContent = 'saved';
  pill.classList.add('show');
  clearTimeout(showSavedPill._t);
  showSavedPill._t = setTimeout(()=> pill.classList.remove('show'), 1200);
}

function updateCounts(){
  let totalDone = 0, totalAll = 0;
  segmentIds.forEach(seg=>{
    const boxes = document.querySelectorAll(\`[data-seg="\${seg}"] input[type=checkbox]\`);
    const done = Array.from(boxes).filter(b=>b.checked).length;
    totalDone += done; totalAll += boxes.length;
    const countEl = document.querySelector(\`[data-count-for="\${seg}"]\`);
    if(countEl) countEl.textContent = \`\${done}/\${boxes.length}\`;
  });
  document.getElementById('progressLabel').textContent = \`\${totalDone} / \${totalAll} done\`;
  document.getElementById('progressFill').style.width = totalAll ? \`\${(totalDone/totalAll)*100}%\` : '0%';
}

document.querySelectorAll('input[type=checkbox]').forEach(cb=>{
  cb.addEventListener('change', ()=>{
    const item = cb.closest('.item');
    if(item) item.classList.toggle('checked', cb.checked);
    updateCounts();
    scheduleSave();
  });
});
document.querySelectorAll('textarea').forEach(t=>{
  t.addEventListener('input', scheduleSave);
});

document.getElementById('resetBtn').addEventListener('click', ()=>{
  if(!confirm('Reset all checkboxes for this session? Notes will stay.')) return;
  document.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.checked = false; cb.closest('.item').classList.remove('checked');
  });
  updateCounts();
  scheduleSave();
});

document.getElementById('copyBtn').addEventListener('click', async ()=>{
  const state = collectState();
  let out = ${JSON.stringify(copyHeader)};
  const titles = {
${titlesEntries.join(',\n')}
  };
  segmentIds.forEach(seg=>{
    const notes = state.segments[seg].notes;
    if(notes && notes.trim()){
      out += \`\${titles[seg]}:\\n\${notes.trim()}\\n\\n\`;
    }
  });
  if(state.carryForward && state.carryForward.trim()){
    out += \`CARRY INTO ${spec.carryInto || 'NEXT WEEK'}:\\n\${state.carryForward.trim()}\\n\`;
  }
  try{
    await navigator.clipboard.writeText(out);
    const btn = document.getElementById('copyBtn');
    const old = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(()=> btn.textContent = old, 1400);
  }catch(err){
    alert(out);
  }
});

(function init(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    applyState(JSON.parse(raw));
  }
  updateCounts();
})();`;
}

// ── HTML Generation ──────────────────────────────────────────────────

function generateHTML(spec, css) {
  const weekNum = extractWeekNumber(spec.filename) || '?';
  const dayUpper = spec.practiceDay.toUpperCase();
  const dateFormatted = formatDate(spec.practiceDate);
  const carryLabel = spec.carryInto ? `WEEK ${spec.carryInto}` : 'NEXT WEEK';

  // Build segments HTML
  let segmentsHTML = '';
  for (let i = 0; i < spec.segments.length; i++) {
    segmentsHTML += buildSegment(spec.segments[i], i);
  }

  // Player tracker segment
  const playerTrackerHTML = spec.playerTracker === true ? buildPlayerTracker() : '';

  // Build the full HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="practice-date" content="${spec.practiceDate}">
<meta name="practice-day" content="${spec.practiceDay}">
<title>${spec.h1Title}</title>
<style>
${css.trim()}
</style>
</head>
<body>

<div class="save-pill" id="savePill">saved</div>

<div class="hero">
  <div class="hero-inner">
    <div class="eyebrow">WEEK ${weekNum} · ${dayUpper}</div>
    <h1>${spec.h1Title}</h1>
    <p>${dateFormatted.full} · ${spec.startTime} · ${spec.playerCount} players</p>
    <div class="progress-wrap">
      <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
      <div class="progress-label" id="progressLabel">0 / 0 done</div>
    </div>
  </div>
</div>

<div class="wrap">
${playerTrackerHTML}
${segmentsHTML}

<div class="carry-box">
  <h3>Carry Into ${spec.carryInto || 'Next Week'}</h3>
  <p>Anything from today that should shape next week's plan — what to repeat, what to drop, what to build on.</p>
  <textarea id="carry-forward" placeholder="e.g. ..."></textarea>
</div>

<div class="actions">
  <button class="btn primary" id="copyBtn">Copy notes for next week</button>
  <button class="btn" id="resetBtn">Reset checklist</button>
</div>

</div>

<footer>WEEK ${weekNum} ${dayUpper} · ${dateFormatted.upper} · NOTES AUTO-SAVE AS YOU TYPE</footer>

<script>
${buildJavaScript(spec)}
</script>

</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    exitError('Usage: node scripts/generate-plan.mjs <path-to-spec.json>');
  }

  const specPath = path.resolve(args[0]);

  // Read spec file
  let specRaw;
  try {
    specRaw = fs.readFileSync(specPath, 'utf-8');
  } catch (err) {
    exitError(`Cannot read spec file: ${specPath} (${err.message})`);
  }

  // Parse JSON
  let spec;
  try {
    spec = JSON.parse(specRaw);
  } catch (err) {
    exitError(`Invalid JSON in spec file: ${err.message}`);
  }

  // Validate
  validateSpec(spec);

  // Read template CSS
  const cssPath = path.join(__dirname, 'template.css');
  let css;
  try {
    css = fs.readFileSync(cssPath, 'utf-8');
  } catch (err) {
    exitError(`Cannot read template CSS: ${cssPath} (${err.message})`);
  }

  // Generate HTML
  const html = generateHTML(spec, css);

  // Write output file
  const outputPath = path.join(ROOT, spec.filename);
  try {
    fs.writeFileSync(outputPath, html, 'utf-8');
  } catch (err) {
    exitError(`Cannot write output file: ${outputPath} (${err.message})`);
  }

  // Summary
  const totalChecklistItems = spec.segments.reduce((sum, seg) => sum + seg.checklist.length, 0);
  const dateFormatted = formatDate(spec.practiceDate);

  console.log('');
  console.log(`✓ Generated: ${spec.filename}`);
  console.log(`  Date:       ${dateFormatted.full} (${spec.practiceDate})`);
  console.log(`  Day:        ${spec.practiceDay}`);
  console.log(`  Time:       ${spec.startTime} – ${spec.endTime}`);
  console.log(`  Players:    ${spec.playerCount}`);
  console.log(`  Title:      ${spec.h1Title.replace(/&amp;/g, '&')}`);
  console.log(`  Segments:   ${spec.segments.length}`);
  console.log(`  Checklist items: ${totalChecklistItems}`);
  if (spec.playerTracker) {
    console.log(`  Player Tracker: included`);
  }
  console.log('');
  console.log(`Run \`node scripts/update-readme.mjs\` to update README tables.`);
  console.log('');
}

main();
