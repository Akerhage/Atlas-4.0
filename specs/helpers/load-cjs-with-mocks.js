function loadCjsWithMocks(targetModuleId, mockModuleMap = {}) {
  const originalTarget = require.cache[targetModuleId];
  const originalMocks = new Map();

  for (const [moduleId, mockedExports] of Object.entries(mockModuleMap)) {
    originalMocks.set(moduleId, require.cache[moduleId]);
    require.cache[moduleId] = {
      id: moduleId,
      filename: moduleId,
      loaded: true,
      exports: mockedExports,
    };
  }

  delete require.cache[targetModuleId];
  const loadedModule = require(targetModuleId);

  return {
    module: loadedModule,
    restore() {
      delete require.cache[targetModuleId];

      if (originalTarget) {
        require.cache[targetModuleId] = originalTarget;
      } else {
        delete require.cache[targetModuleId];
      }

      for (const [moduleId, originalCacheEntry] of originalMocks.entries()) {
        if (originalCacheEntry) {
          require.cache[moduleId] = originalCacheEntry;
        } else {
          delete require.cache[moduleId];
        }
      }
    },
  };
}

module.exports = { loadCjsWithMocks };
