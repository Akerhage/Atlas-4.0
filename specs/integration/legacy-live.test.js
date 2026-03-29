const { liveScripts, runLive } = require('../helpers/legacy-script-manifests');
const { runNodeScript } = require('../helpers/run-node-script');

const maybeTest = runLive ? test : test.skip;

describe('Legacy live/integration scripts under Vitest', () => {
  for (const legacyTest of liveScripts) {
    maybeTest(legacyTest.name, async () => {
      const result = await runNodeScript(legacyTest);

      expect(result.code).toBe(0);
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
    }, legacyTest.timeoutMs);
  }
});
