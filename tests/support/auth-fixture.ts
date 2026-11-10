import { test as base } from '@playwright/test';
import {
  createAuthFixtures,
  setAuthProvider,
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

const authFixtureOptions = createAuthFixtures();
authFixtureOptions.authSessionEnabled = [false, { option: true }];
const authFixtures = authFixtureOptions as unknown as Parameters<typeof base.extend>[0];

export const test = base.extend(authFixtures);