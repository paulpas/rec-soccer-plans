import fs from 'node:fs';
import path from 'node:path';

// 1. Generate the raw table output by importing and running generate-tables logic inline
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00A0/g, ' ');
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, '');
}

function extractTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'is'));
  return match ? decodeEntities(stripHtml(match[1])) : null;
}

function isProposedDraft(filename) {
  const lower = filename.toLowerCase();
  return lower.includes('proposed') || lower.includes('draft');
}

function getWeekNumber(filename) {
  const match = filename.match(/^week(\d+)/);
  return match ? parseInt(match[1], 10) : 99;
}

function getDayInfo(filename, html, isPD) {
  if (isPD) return { label: 'Proposed', color: '#E1592C', textColor: '#F7F5EC' };

  // Read explicit day from meta tag, fall back to filename pattern
  const metaMatch = html.match(/<meta[^>]+name="practice-day"[^>]+content="([^"]+)"/i);
  if (metaMatch) return { label: metaMatch[1], color: '#E3A72E', textColor: '#152018' };

  const base = filename.replace(/lesson_plan.*\.html$/, '');
  const lowerBase = base.toLowerCase();

  if (lowerBase.includes('_wed_')) return { label: 'Wednesday', color: '#E3A72E', textColor: '#152018' };
  if (lowerBase.includes('_tue_')) return { label: 'Tuesday', color: '#1F4D36', textColor: '#F7F5EC' };
  if (lowerBase.includes('_thurs_') || lowerBase.includes('_thu_')) return { label: 'Thursday', color: '#1F4D36', textColor: '#F7F5EC' };
  if (lowerBase.includes('_fri_')) return { label: 'Friday', color: '#1F4D36', textColor: '#F7F5EC' };
  return { label: 'Monday', color: '#1F4D36', textColor: '#F7F5EC' };
}

const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Proposed': 99 };

function renderDayBadge(label, color, textColor) {
  return `<span style="background-color:${color};color:${textColor};padding:2px 8px;border-radius:3px;font-size:0.85em;">${label}</span>`;
}

const ROOT = new URL('..', import.meta.url).pathname;
const ALL_HTML_FILES = fs.readdirSync(ROOT);
const lessonFiles = ALL_HTML_FILES.filter(f => f.includes('lesson_plan') && f.endsWith('.html'));

if (lessonFiles.length === 0) {
  process.stderr.write('No lesson_plan*.html files found.\n');
  process.exit(1);
}

const activeFiles = [];
const proposedDraftFiles = [];

for (const file of lessonFiles) {
  const fullPath = path.join(ROOT, file);
  let html;
  try {
    html = fs.readFileSync(fullPath, 'utf-8');
  } catch {
    continue;
  }

  const title = extractTag(html, 'h1') || file.replace(/\.html$/, '');
  const weekNum = getWeekNumber(file);
  const isPD = isProposedDraft(file);
  const { label: dayLabel, color, textColor } = getDayInfo(file, html, isPD);

  if (isPD) {
    proposedDraftFiles.push({ file, title, weekNum, dayLabel, color, textColor });
  } else {
    activeFiles.push({ file, title, weekNum, dayLabel, color, textColor });
  }
}

activeFiles.sort((a, b) => a.weekNum !== b.weekNum ? a.weekNum - b.weekNum : dayOrder[a.dayLabel] - dayOrder[b.dayLabel]);
proposedDraftFiles.sort((a, b) => a.weekNum !== b.weekNum ? a.weekNum - b.weekNum : 0);

function generateRows(rows) {
  let lines = ['| Week | Day | Plan |', '|------|-----|------|'];
  for (const row of rows) {
    const weekLabel = `WEEK ${row.weekNum}`;
    const dayBadge = renderDayBadge(row.dayLabel, row.color, row.textColor);
    const url = `https://html-preview.github.io/?url=https://github.com/paulpas/rec-soccer-plans/blob/main/${row.file}`;
    lines.push(`| ${weekLabel} | ${dayBadge} | [${row.title}](${url}) |`);
  }
  return lines.join('\n');
}

const activeTable = generateRows(activeFiles);
const proposedTable = generateRows(proposedDraftFiles);

// 2. Read and update README.md
let readme = fs.readFileSync('README.md', 'utf-8');

const markers = [
  { start: '<!-- GENERATE_ACTIVE_TABLE -->', end: '<!-- END_GENERATE_ACTIVE_TABLE -->', content: activeTable },
  { start: '<!-- GENERATE_PROPOSED_TABLE -->', end: '<!-- END_GENERATE_PROPOSED_TABLE -->', content: proposedTable },
];

for (const m of markers) {
  const startIdx = readme.indexOf(m.start);
  const endIdx = readme.indexOf(m.end);
  if (startIdx !== -1 && endIdx !== -1) {
    readme = readme.slice(0, startIdx + m.start.length) + '\n' + m.content + '\n' + readme.slice(endIdx);
  }
}

fs.writeFileSync('README.md', readme);
process.stderr.write('README.md updated.\n');
