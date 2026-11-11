import { test as base } from '@playwright/test';
import {
  createAuthFixtures,
  getStorageStatePath,
  setAuthProvider,
  type AuthFixtures,
  type AuthProvider,
} from '@seontechnologies/playwright-utils/auth-session';

const todoMvcBaseUrl = process.env.BASE_URL ?? 'https://todomvc.com/examples/react/dist/';

export const todoMvcAuthProvider: AuthProvider = {
  getEnvironment: (options) => options?.environment || 'local',
  getUserIdentifier: (options) => options?.userIdentifier || 'anonymous',
  getBaseUrl: () => todoMvcBaseUrl,
  extractToken: () => null,
  extractCookies: () => [],
  isTokenExpired: () => true,
  clearToken: () => undefined,
  manageAuthToken: async () => {
    throw new Error('TodoMVC has no authentication flow configured.');
  },
};

setAuthProvider(todoMvcAuthProvider);

// Keep the library's authOptions / authSessionEnabled / authToken fixtures but drop its `context` and
// `page` overrides: they call browser.newContext() directly, which bypasses Playwright's own context
// fixture and silently loses `recordVideo`, device emulation and every other `use` option.
const { context: _context, page: _page, ...libraryFixtures } = createAuthFixtures();
libraryFixtures.authSessionEnabled = [false, { option: true }];

export const test = base.extend<AuthFixtures>({
  ...(libraryFixtures as unknown as Parameters<typeof base.extend<AuthFixtures>>[0]),
  // Auth storage rides on Playwright's native storageState option, so the built-in context keeps all
  // configured artifacts. `authToken` is requested first so the provider has written the file.
  storageState: async ({ storageState, authSessionEnabled, authOptions, authToken: _authToken }, use) => {
    await use(authSessionEnabled ? getStorageStatePath(authOptions) : storageState);
  },
});