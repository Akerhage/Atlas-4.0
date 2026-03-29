const { qaScripts, runQa } = require('../helpers/legacy-script-manifests');
const { runNodeScript } = require('../helpers/run-node-script');

const maybeTest = runQa ? test : test.skip;

describe('Legacy QA runners under Vitest', () => {
  for (const qaTest of qaScripts) {
    maybeTest(qaTest.name, async () => {
      const result = await runNodeScript(qaTest);

      expect(result.code).toBe(0);
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
    }, qaTest.timeoutMs);
  }
});
