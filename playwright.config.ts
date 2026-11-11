import { existsSync } from 'node:fs';
import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // A failed test is retried 3 times (4 runs in total). The TestRail/Jira reporter only raises a
  // defect when every attempt failed; a pass on any retry is reported as flaky instead.
  retries: Number(process.env.PW_RETRIES ?? 3),
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    // Syncs cases + results to TestRail and raises Jira defects when credentials are present;
    // always writes test-results/testrail-jira-sync.json for MCP-driven sync by the TEA agent.
    ['./tests/support/reporters/testrail-jira-reporter.ts', { manifestPath: 'test-results/testrail-jira-sync.json' }],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: './tests/support/global-setup.ts',
  use: {
    baseURL: process.env.BASE_URL ?? 'https://todomvc.com/examples/react/dist/',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure-and-retries',
    screenshot: 'only-on-failure',
    // Recording only from the first retry keeps green runs cheap; failures still ship a video to the bug report.
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});