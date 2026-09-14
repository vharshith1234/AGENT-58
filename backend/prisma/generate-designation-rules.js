/**
 * Regenerate designation-workload-rules.json from the CSE Odd Excel Faculty WL sheet.
 * Does not mutate the DB. Run: node prisma/generate-designation-rules.js
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const EXCEL = path.join(
  __dirname,
  'data/cse-odd-2026/Workload-AY-2026-27-I-Sem.xlsx',
);
const OUT_JSON = path.join(__dirname, 'data/designation-workload-rules.json');

function parsePrescribed(prescribed) {
  if (prescribed == null || prescribed === '') return null;
  const raw = String(prescribed).trim();
  const range = raw.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min || max > 80) {
      return null;
    }
    return {
      prescribed: `${min}-${max}`,
      min,
      expected: Math.round(((min + max) / 2) * 10) / 10,
      max,
    };
  }
  const single = raw.match(/^(\d+(?:\.\d+)?)$/);
  if (single) {
    const n = Number(single[1]);
    if (!Number.isFinite(n) || n <= 0 || n > 80) return null;
    return { prescribed: String(n), min: n, expected: n, max: n };
  }
  return null;
}

function cadreOf(designation) {
  const s = String(designation || '').toLowerCase();
  if (/teaching\s*associate/.test(s)) return 'Teaching Associate';
  if (/teaching\s*assistant/.test(s)) return 'Teaching Assistant';
  if (/\bcap\b|contractual\s*assistant/.test(s)) return 'CAP';
  if (/sr\.?\s*asst|senior/.test(s) && /asst|assist/.test(s)) {
    return 'Senior Assistant Professor';
  }
  if (/assoc/.test(s)) return 'Associate Professor';
  if (/asst|assist/.test(s)) return 'Assistant Professor';
  if (/prof/.test(s)) return 'Professor';
  return null;
}

function main() {
  const wb = XLSX.readFile(EXCEL);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Faculty WL'], {
    header: 1,
    defval: null,
  });
  const tallies = new Map();
  for (const r of rows) {
    const cadre = cadreOf(r[3]);
    const band = parsePrescribed(r[5]);
    if (!cadre || !band) continue;
    if (!tallies.has(cadre)) tallies.set(cadre, new Map());
    const key = band.prescribed;
    const bucket = tallies.get(cadre);
    const prev = bucket.get(key) || { count: 0, band };
    prev.count += 1;
    bucket.set(key, prev);
  }

  const matchByCadre = {
    Professor: ['\\bprofessor\\b', '\\bprof\\.?\\b'],
    'Associate Professor': ['assoc(?:iate)?\\.?\\s*prof'],
    'Senior Assistant Professor': [
      'sr\\.?\\s*asst',
      'senior\\s*(?:level\\s*)?(?:asst|assistant)',
    ],
    'Assistant Professor': ['asst\\.?\\s*prof', 'assistant\\s*professor'],
    CAP: ['\\bcap\\b', 'contractual\\s*assistant'],
    'Teaching Associate': ['teaching\\s*associate'],
    'Teaching Assistant': ['teaching\\s*assistant'],
  };

  const rules = [];
  for (const [cadre, bucket] of tallies.entries()) {
    const best = [...bucket.values()].sort((a, b) => b.count - a.count)[0];
    rules.push({
      cadre,
      prescribed: best.band.prescribed,
      min: best.band.min,
      expected: best.band.expected,
      max: best.band.max,
      match: matchByCadre[cadre] || [],
      sampleCount: best.count,
    });
  }

  const payload = {
    sourceFile: 'prisma/data/cse-odd-2026/Workload-AY-2026-27-I-Sem.xlsx',
    sourceSheet: 'Faculty WL',
    sourceColumn: 'Prescribed workload (h/week)',
    notes:
      'Cadre norms derived from Excel Faculty WL sheet (modal prescribed band per cadre).',
    rules,
    default: {
      cadre: 'Default',
      prescribed: '16-18',
      min: 16,
      expected: 17,
      max: 18,
    },
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUT_JSON}`);
  console.log(rules.map((r) => `${r.cadre}: ${r.prescribed} (n=${r.sampleCount})`).join('\n'));
}

main();
