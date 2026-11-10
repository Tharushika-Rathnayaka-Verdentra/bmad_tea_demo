import { test, expect, log } from '../support/merged-fixtures';

test('TodoMVC serves its root document', async ({ apiRequest }) => {
  await log.step('Request the configured TodoMVC base URL');
  const { status } = await apiRequest({ method: 'GET', path: './' });

  expect(status).toBe(200);
});