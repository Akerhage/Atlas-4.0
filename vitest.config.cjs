const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['specs/**/*.test.{js,ts}'],
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});


