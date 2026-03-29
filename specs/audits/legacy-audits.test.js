const fs = require('fs');
const { auditScripts } = require('../helpers/legacy-script-manifests');
const { resolveFromRepo, runNodeScript } = require('../helpers/run-node-script');

describe('Legacy audit scripts under Vitest', () => {
  for (const audit of auditScripts) {
    test(audit.name, async () => {
      const result = await runNodeScript(audit);
      const expectedExitCodes = audit.expectedExitCodes || [0];

      expect(expectedExitCodes).toContain(result.code);
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);

      if (audit.requiredText) {
        expect(`${result.stdout}\n${result.stderr}`).toContain(audit.requiredText);
      }
    }, audit.timeoutMs);
  }

  test('browser-side audit helper file is present', () => {
    const auditRendererPath = resolveFromRepo('tests/scripts/audit_renderer.js');
    const content = fs.readFileSync(auditRendererPath, 'utf8');

    expect(fs.existsSync(auditRendererPath)).toBe(true);
    expect(content.length).toBeGreaterThan(100);
  });
});
