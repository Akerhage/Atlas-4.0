const { getSuiteSelectionInput } = require('./run-node-script');

const runLive = process.env.RUN_ATLAS_LIVE === '1';
const runQa = process.env.RUN_ATLAS_QA === '1';

const auditScripts = [
  { name: 'audit:1', scriptPath: 'tests/scripts/audit_1_server_db_renderer.js', timeoutMs: 30000, expectedExitCodes: [0] },
  { name: 'audit:2', scriptPath: 'tests/scripts/audit_2_server_engines.js', timeoutMs: 30000, expectedExitCodes: [0] },
  { name: 'audit:3', scriptPath: 'tests/scripts/audit_3_server_package_db_main.js', timeoutMs: 30000, expectedExitCodes: [0] },
  { name: 'audit:4', scriptPath: 'tests/scripts/audit_4_renderer_html_css.js', timeoutMs: 30000, expectedExitCodes: [0] },
  { name: 'audit:backend', scriptPath: 'tests/scripts/audit_backend.js', timeoutMs: 15000, expectedExitCodes: [0] },
  { name: 'audit:db', scriptPath: 'tests/scripts/audit_db.js', timeoutMs: 15000, expectedExitCodes: [0] },
  { name: 'audit:server', scriptPath: 'tests/scripts/audit_server.js', timeoutMs: 15000, expectedExitCodes: [0] },
  { name: 'audit:balance', scriptPath: 'tests/scripts/audit_check_balance.js', timeoutMs: 15000, expectedExitCodes: [0] },
  { name: 'audit:diagnose', scriptPath: 'tests/scripts/audit_diagnose.js', timeoutMs: 20000, expectedExitCodes: [0] },
  { name: 'audit:roles', scriptPath: 'tests/scripts/audit-roles.js', timeoutMs: 15000, expectedExitCodes: [0] },
  { name: 'basfakta export', scriptPath: 'tests/scripts/audit_basfakta.js', timeoutMs: 15000, expectedExitCodes: [0] },
  { name: 'tree export', scriptPath: 'tests/scripts/audit_tree.js', timeoutMs: 15000, expectedExitCodes: [0] },
  {
    name: 'syntax audit',
    scriptPath: 'tests/scripts/audit_syntax_check.js',
    timeoutMs: 20000,
    expectedExitCodes: [0, 1],
    requiredText: 'SUMMARY',
  },
  { name: 'audit collection report', scriptPath: 'tests/scripts/audit_collect_results.js', timeoutMs: 45000, expectedExitCodes: [0] },
];

const liveScripts = [
  {
    name: 'legacy test_runner session suite',
    scriptPath: 'tests/scripts/test_runner.js',
    input: getSuiteSelectionInput('Suite_Session-Test.json'),
    timeoutMs: 120000,
    expectedExitCodes: [0],
  },
  {
    name: 'legacy session-debug walkthrough',
    scriptPath: 'tests/scripts/session-debug.js',
    input: 'Vad kostar Risk 1 i Goteborg?\nOch vad kostar Risk 2 da?\n\n',
    timeoutMs: 120000,
    expectedExitCodes: [0],
  },
  {
    name: 'legacy agent flow',
    scriptPath: 'tests/scripts/test_agent.js',
    timeoutMs: 90000,
    expectedExitCodes: [0],
  },
  {
    name: 'legacy rag validator',
    scriptPath: 'tests/scripts/atlas-master-test.js',
    timeoutMs: 180000,
    expectedExitCodes: [0],
  },
  {
    name: 'legacy arende stress suite',
    scriptPath: 'tests/scripts/test-stress-arende.js',
    timeoutMs: 180000,
    expectedExitCodes: [0],
  },
  {
    name: 'legacy simulator smoke run',
    scriptPath: 'tests/scripts/test-simulator.js',
    env: {
      INTERVAL_MS: '999999',
      BATCH_MIN: '1',
      BATCH_MAX: '1',
    },
    signalAfterMs: 12000,
    timeoutMs: 30000,
    expectedExitCodes: [0],
  },
  {
    name: 'legacy rag-debug tool',
    scriptPath: 'tests/scripts/rag-debug.js',
    args: ['Vad kostar Risk 1 i Goteborg?'],
    timeoutMs: 30000,
    expectedExitCodes: [0],
  },
];

const qaScripts = [
  { name: 'legacy qa v0', scriptPath: 'tests/scripts/qa-test-runner.js', timeoutMs: 1800000, expectedExitCodes: [0] },
  { name: 'legacy qa v2', scriptPath: 'tests/scripts/qa-test-runner-v2.js', timeoutMs: 1800000, expectedExitCodes: [0] },
  { name: 'legacy qa v3', scriptPath: 'tests/scripts/qa-test-runner-v3.js', timeoutMs: 1800000, expectedExitCodes: [0] },
  { name: 'legacy qa v4', scriptPath: 'tests/scripts/qa-test-runner-v4.js', timeoutMs: 1800000, expectedExitCodes: [0] },
];

module.exports = {
  runLive,
  runQa,
  auditScripts,
  liveScripts,
  qaScripts,
};
