const fs = require('fs');
const vm = require('vm');

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function findMarkerIndex(source, marker, fromIndex = 0) {
  if (!marker) return -1;
  const exact = source.indexOf(marker, fromIndex);
  if (exact !== -1) return exact;
  const windows = source.indexOf(marker.replace(/\n/g, '\r\n'), fromIndex);
  if (windows !== -1) return windows;
  const unix = source.indexOf(marker.replace(/\r\n/g, '\n'), fromIndex);
  return unix;
}

function extractSnippet(source, startMarker, endMarker) {
  const start = findMarkerIndex(source, startMarker);
  if (start === -1) {
    throw new Error(`Start marker not found: ${startMarker}`);
  }

  const end = endMarker ? findMarkerIndex(source, endMarker, start) : source.length;
  if (end === -1) {
    throw new Error(`End marker not found: ${endMarker}`);
  }

  return {
    line: getLineNumber(source, start),
    code: source.slice(start, end).trimEnd(),
  };
}

function buildInstrumentedCode(parts, exportExpression) {
  const sorted = [...parts].sort((a, b) => a.line - b.line);
  let code = '';
  let currentLine = 1;

  for (const part of sorted) {
    const paddingLines = Math.max(0, part.line - currentLine);
    code += '\n'.repeat(paddingLines);
    code += `${part.code}\n`;
    currentLine = part.line + part.code.split('\n').length;
  }

  code += `\n${exportExpression}\n`;
  return code;
}

function loadSourceSnippets({ filePath, snippets, sandbox = {}, exportExpression }) {
  const source = fs.readFileSync(filePath, 'utf8');
  const parts = snippets.map((snippet) => extractSnippet(source, snippet.start, snippet.end));
  const context = {
    module: { exports: {} },
    exports: {},
    require,
    ...sandbox,
  };

  vm.runInNewContext(buildInstrumentedCode(parts, exportExpression), context, { filename: filePath });
  return context.module.exports;
}

module.exports = { loadSourceSnippets };
