import { mergeTests } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { test as apiRequestFixture } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { test as interceptFixture } from '@seontechnologies/playwright-utils/intercept-network-call/fixtures';
import { test as networkErrorFixture } from '@seontechnologies/playwright-utils/network-error-monitor/fixtures';
import { test as recurseFixture } from '@seontechnologies/playwright-utils/recurse/fixtures';
import { test as authFixture } from './auth-fixture';
import { test as todoAppFixture } from './todo-app-fixture';

export const test = mergeTests(
  apiRequestFixture,
  interceptFixture,
  networkErrorFixture,
  recurseFixture,
  authFixture,
  todoAppFixture,
);

export type { TodoApp, TodoFilter } from './todo-app-fixture';

export { expect } from '@playwright/test';
export { log };