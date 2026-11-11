import { test, expect, log } from '../support/merged-fixtures';

test('@p2 [P2] 1.0-API-001 TodoMVC serves its root document', async ({ apiRequest }) => {
  await log.step('Request the configured TodoMVC base URL');
  const { status } = await apiRequest({ method: 'GET', path: './' });

  expect(status).toBe(200);
});