// ============================================
// audit-roles.js
// KÖR: node audit-roles.js (från Atlas-roten)
// VAD DEN GÖR: Söker igenom ALLA .js-filer efter
//   - support-roll-referenser
//   - felaktiga rollkontroller
//   - ställen som fortfarande tror det finns 3 roller
// ============================================

const fs = require('fs');
const path = require('path');

// ===== KONFIGURATION =====
const ROOT = __dirname; // Kör från Atlas-roten
const IGNORE_DIRS = ['node_modules', '.git', 'kundchatt', 'patch', 'exports', 'backups'];
const IGNORE_FILES = ['audit-roles.js']; // Ignorera detta script självt

// Mönster att leta efter
const PATTERNS = [
  { label: '🔴 SUPPORT-ROLL (direkt jämförelse)',     regex: /role\s*[=!]=+\s*['"]support['"]/g },
  { label: '🔴 SUPPORT-ROLL (inkluderar)',             regex: /includes\(['"]support['"]\)/g },
  { label: '🔴 SUPPORT-ROLL (sträng i kod)',           regex: /['"]support['"]/g },
  { label: '🟡 ADMIN-CHECK (nekad för agenter)',       regex: /role\s*!==?\s*['"]admin['"]/g },
  { label: '🟡 AGENT-CHECK (nekad)',                   regex: /role\s*===?\s*['"]agent['"]/g },
  { label: '🟡 isSupportAgent() anrop',                regex: /isSupportAgent\(\)/g },
  { label: '🔵 ADMIN-CHECK (tillåten)',                regex: /role\s*===?\s*['"]admin['"]/g },
  { label: '🔵 403 Forbidden response',                regex: /status\(403\)/g },
];

// ===== HJÄLPFUNKTIONER =====
function getAllJsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllJsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.js') && !IGNORE_FILES.includes(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function getLineContent(content, lineNum) {
  return content.split('\n')[lineNum - 1]?.trim() || '';
}

// ===== KÖR AUDIT =====
console.log('\n' + '='.repeat(70));
console.log('  🔍 ATLAS ROLLAUDIT — Söker efter support-roll och 403-kontroller');
console.log('='.repeat(70) + '\n');

const allFiles = getAllJsFiles(ROOT);
console.log(`📂 Hittade ${allFiles.length} JS-filer att granska\n`);

const results = {};
let totalIssues = 0;

for (const file of allFiles) {
  const relPath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');
  const fileResults = [];

  for (const pattern of PATTERNS) {
    const regex = new RegExp(pattern.regex.source, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = getLineNumber(content, match.index);
      const lineContent = getLineContent(content, lineNum);
      fileResults.push({
        label: pattern.label,
        line: lineNum,
        match: match[0],
        context: lineContent
      });
    }
  }

  if (fileResults.length > 0) {
    results[relPath] = fileResults;
    totalIssues += fileResults.length;
  }
}

// ===== SKRIV UT RESULTAT =====
if (Object.keys(results).length === 0) {
  console.log('✅ Inga träffar hittades!\n');
} else {
  for (const [file, hits] of Object.entries(results)) {
    console.log(`\n📄 ${file}`);
    console.log('─'.repeat(60));
    for (const hit of hits) {
      console.log(`  ${hit.label}`);
      console.log(`  Rad ${hit.line}: ${hit.context}`);
      console.log();
    }
  }
}

// ===== SAMMANFATTNING =====
console.log('='.repeat(70));
console.log('  📊 SAMMANFATTNING');
console.log('='.repeat(70));

const supportHits = Object.entries(results).flatMap(([f, hits]) =>
  hits.filter(h => h.label.includes('SUPPORT')).map(h => ({ file: f, ...h }))
);

const adminOnlyHits = Object.entries(results).flatMap(([f, hits]) =>
  hits.filter(h => h.label.includes('nekad för agenter')).map(h => ({ file: f, ...h }))
);

const forbidden403 = Object.entries(results).flatMap(([f, hits]) =>
  hits.filter(h => h.label.includes('403')).map(h => ({ file: f, ...h }))
);

console.log(`\n🔴 Support-roll-referenser kvar:  ${supportHits.length}`);
if (supportHits.length > 0) {
  supportHits.forEach(h => console.log(`   → ${h.file}:${h.line}  "${h.context}"`));
}

console.log(`\n🟡 Admin-only checks (agenter nekas): ${adminOnlyHits.length}`);
if (adminOnlyHits.length > 0) {
  adminOnlyHits.forEach(h => console.log(`   → ${h.file}:${h.line}  "${h.context}"`));
}

console.log(`\n🔵 Totalt antal 403-responses: ${forbidden403.length}`);
if (forbidden403.length > 0) {
  forbidden403.forEach(h => console.log(`   → ${h.file}:${h.line}  "${h.context}"`));
}

console.log(`\n📁 Filer med träffar: ${Object.keys(results).length} av ${allFiles.length}`);
console.log(`📌 Totalt antal träffar: ${totalIssues}`);
console.log('\n' + '='.repeat(70));
console.log('  ✅ Audit klar');
console.log('='.repeat(70) + '\n');
