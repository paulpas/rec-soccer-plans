import fs from 'node:fs';
import path from 'node:path';

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

function extractMeta(html, name) {
  const match = html.match(new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]+)"`, 'i'));
  return match ? match[1] : null;
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
  if (isPD) return { label: 'Draft', color: '#E1592C', textColor: '#F7F5EC' };

  const metaMatch = html.match(/<meta[^>]+name="practice-day"[^>]+content="([^"]+)"/i);
  if (metaMatch) {
    const day = metaMatch[1];
    const isWeekday = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day);
    return { label: day, color: isWeekday ? '#E3A72E' : '#1F4D36', textColor: isWeekday ? '#152018' : '#F7F5EC' };
  }

  const base = filename.replace(/lesson_plan.*\.html$/, '');
  const lowerBase = base.toLowerCase();
  if (lowerBase.includes('_wed_')) return { label: 'Wednesday', color: '#E3A72E', textColor: '#152018' };
  if (lowerBase.includes('_tue_')) return { label: 'Tuesday', color: '#1F4D36', textColor: '#F7F5EC' };
  if (lowerBase.includes('_thurs_') || lowerBase.includes('_thu_')) return { label: 'Thursday', color: '#1F4D36', textColor: '#F7F5EC' };
  if (lowerBase.includes('_fri_')) return { label: 'Friday', color: '#1F4D36', textColor: '#F7F5EC' };
  return { label: 'Monday', color: '#1F4D36', textColor: '#F7F5EC' };
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function renderDayBadge(label, color, textColor) {
  return `<span style="background-color:${color};color:${textColor};padding:2px 8px;border-radius:3px;font-size:0.85em;">${label}</span>`;
}

const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Draft': 99 };

const today = new Date();
today.setHours(0, 0, 0, 0);

const ROOT = new URL('..', import.meta.url).pathname;
const ALL_HTML_FILES = fs.readdirSync(ROOT);
const lessonFiles = ALL_HTML_FILES.filter(f => f.includes('lesson_plan') && f.endsWith('.html'));

if (lessonFiles.length === 0) {
  process.stderr.write('No lesson_plan*.html files found.\n');
  process.exit(1);
}

const pastFiles = [];
const todayFiles = [];
const developmentFiles = [];

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
  const dateStr = extractMeta(html, 'practice-date');
  const dateObj = dateStr ? new Date(dateStr + 'T00:00:00') : null;

  const entry = { file, title, weekNum, dayLabel, color, textColor, dateStr, dateObj };

  if (isPD) {
    developmentFiles.push(entry);
  } else if (dateObj && dateObj.getTime() === today.getTime()) {
    todayFiles.push(entry);
  } else if (dateObj && dateObj < today) {
    pastFiles.push(entry);
  }
}

pastFiles.sort((a, b) => {
  if (a.dateStr && b.dateStr) return a.dateStr.localeCompare(b.dateStr);
  if (a.dateStr) return -1;
  if (b.dateStr) return 1;
  return a.weekNum - b.weekNum || dayOrder[a.dayLabel] - dayOrder[b.dayLabel];
});

todayFiles.sort((a, b) => {
  if (a.dateStr && b.dateStr) return a.dateStr.localeCompare(b.dateStr);
  return dayOrder[a.dayLabel] - dayOrder[b.dayLabel];
});

developmentFiles.sort((a, b) => a.weekNum - b.weekNum);

function generateRows(rows) {
  let lines = ['| Week | Date | Day | Plan |', '|------|------|-----|------|'];
  for (const row of rows) {
    const weekLabel = `WEEK ${row.weekNum}`;
    const dateCol = row.dateStr ? formatDate(row.dateStr) : '';
    const dayBadge = renderDayBadge(row.dayLabel, row.color, row.textColor);
    const url = `https://html-preview.github.io/?url=https://github.com/paulpas/rec-soccer-plans/blob/main/${row.file}`;
    lines.push(`| ${weekLabel} | ${dateCol} | ${dayBadge} | [${row.title}](${url}) |`);
  }
  return lines.join('\n');
}

const pastTable = generateRows(pastFiles);
const todayTable = generateRows(todayFiles);
const developmentTable = generateRows(developmentFiles);

let readme = fs.readFileSync('README.md', 'utf-8');

const markers = [
  { start: '<!-- GENERATE_PAST_TABLE -->', end: '<!-- END_GENERATE_PAST_TABLE -->', content: pastTable },
  { start: '<!-- GENERATE_TODAY_TABLE -->', end: '<!-- END_GENERATE_TODAY_TABLE -->', content: todayTable },
  { start: '<!-- GENERATE_DEVELOPMENT_TABLE -->', end: '<!-- END_GENERATE_DEVELOPMENT_TABLE -->', content: developmentTable },
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
