const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '../..');

function resolveFromRepo(relativePath) {
  return path.join(repoRoot, relativePath);
}

function getSuiteSelectionInput(fileName) {
  const suitesDir = resolveFromRepo(path.join('tests', 'suites'));
  const files = fs.readdirSync(suitesDir).filter((file) => file.endsWith('.json'));
  const index = files.indexOf(fileName);

  if (index === -1) {
    throw new Error(`Suite not found in tests/suites: ${fileName}`);
  }

  return `${index + 1}\n`;
}

function runNodeScript({
  scriptPath,
  args = [],
  cwd = repoRoot,
  env = {},
  input = '',
  timeoutMs = 30000,
  signalAfterMs = null,
  signal = 'SIGINT',
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [resolveFromRepo(scriptPath), ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeoutId = null;
    let signalTimerId = null;

    function cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
      if (signalTimerId) clearTimeout(signalTimerId);
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });

    child.on('close', (code, receivedSignal) => {
      finish({ code, signal: receivedSignal, stdout, stderr });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();

    if (signalAfterMs !== null) {
      signalTimerId = setTimeout(() => {
        if (!settled) {
          child.kill(signal);
        }
      }, signalAfterMs);
    }

    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      child.kill('SIGKILL');
      reject(new Error(`Timed out after ${timeoutMs}ms while running ${scriptPath}`));
    }, timeoutMs);
  });
}

module.exports = {
  repoRoot,
  resolveFromRepo,
  getSuiteSelectionInput,
  runNodeScript,
};
