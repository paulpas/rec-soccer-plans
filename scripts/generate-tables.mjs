import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ALL_HTML_FILES = fs.readdirSync(ROOT);

// Filter to lesson plan files only
const lessonFiles = ALL_HTML_FILES.filter(f => f.includes('lesson_plan') && f.endsWith('.html'));

if (lessonFiles.length === 0) {
  process.stderr.write('No lesson_plan*.html files found in repo root.\n');
  process.exit(1);
}

// Helper: decode HTML entities commonly found in these files
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00A0/g, ' ');
}

// Helper: extract content between HTML tags (simple regex)
function extractTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'is'));
  return match ? decodeEntities(stripHtml(match[1])) : null;
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, '');
}

// Classify file as active or proposed/draft based on filename only
function isProposedDraft(filename) {
  const lower = filename.toLowerCase();
  return lower.includes('proposed') || lower.includes('draft');
}

// Extract week number from filename like "week1_..." or "week2_wed_..."
function getWeekNumber(filename) {
  const match = filename.match(/^week(\d+)/);
  return match ? parseInt(match[1], 10) : 99;
}

// Determine day label and badge from filename
function getDayInfo(filename, isPD) {
  const base = filename.replace(/lesson_plan.*\.html$/, '');
  const lowerBase = base.toLowerCase();

  if (isPD) return { label: 'Proposed', color: '#E1592C', textColor: '#F7F5EC' };

  if (lowerBase.includes('_wed_')) return { label: 'Wednesday', color: '#E3A72E', textColor: '#152018' };
  if (lowerBase.includes('_tue_')) return { label: 'Tuesday', color: '#1F4D36', textColor: '#F7F5EC' };
  if (lowerBase.includes('_thurs_') || lowerBase.includes('_thu_')) return { label: 'Thursday', color: '#1F4D36', textColor: '#F7F5EC' };
  if (lowerBase.includes('_fri_')) return { label: 'Friday', color: '#1F4D36', textColor: '#F7F5EC' };
  // Default to Monday
  return { label: 'Monday', color: '#1F4D36', textColor: '#F7F5EC' };
}

const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Proposed': 99 };

function renderDayBadge(label, color, textColor) {
  return `<span style="background-color:${color};color:${textColor};padding:2px 8px;border-radius:3px;font-size:0.85em;">${label}</span>`;
}

// Categorize files
const activeFiles = [];
const proposedDraftFiles = [];

for (const file of lessonFiles) {
  const fullPath = path.join(ROOT, file);
  let html = '';
  try {
    html = fs.readFileSync(fullPath, 'utf-8');
  } catch {
    continue; // skip unreadable files
  }

  const title = extractTag(html, 'h1') || file.replace(/\.html$/, '');
  const weekNum = getWeekNumber(file);
  const isPD = isProposedDraft(file);
  const { label: dayLabel, color, textColor } = getDayInfo(file, isPD);

  const row = { file, title, weekNum, dayLabel, color, textColor };

  if (isPD) {
    proposedDraftFiles.push(row);
  } else {
    activeFiles.push(row);
  }
}

// Sort: week ASC, then day order
activeFiles.sort((a, b) => a.weekNum !== b.weekNum ? a.weekNum - b.weekNum : dayOrder[a.dayLabel] - dayOrder[b.dayLabel]);
proposedDraftFiles.sort((a, b) => a.weekNum !== b.weekNum ? a.weekNum - b.weekNum : 0);

// Generate table rows
function generateRows(rows, includeHeader = true) {
  if (rows.length === 0) return includeHeader ? '| Week | Day | Plan |\n|------|-----|------|' : '';
  
  let lines = [];
  if (includeHeader) {
    lines.push('| Week | Day | Plan |');
    lines.push('|------|-----|------|');
  }

  for (const row of rows) {
    const weekLabel = `WEEK ${row.weekNum}`;
    const dayBadge = renderDayBadge(row.dayLabel, row.color, row.textColor);
    const url = `https://html-preview.github.io/?url=https://github.com/paulpas/rec-soccer-plans/blob/main/${row.file}`;
    lines.push(`| ${weekLabel} | ${dayBadge} | [${row.title}](${url}) |`);
  }

  return lines.join('\n');
}

// Output
console.log('=== ACTIVE TABLE ===');
console.log(generateRows(activeFiles, true));
console.log();
console.log('=== PROPOSED/DRAFT TABLE ===');
console.log(generateRows(proposedDraftFiles, true));
