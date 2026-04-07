/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './scenarios',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1920, height: 1080 },
  },
  reporter: [
    ['list'],
    ['json', { outputFile: './results/test-results.json' }],
  ],
  outputDir: './results/artifacts',
};
