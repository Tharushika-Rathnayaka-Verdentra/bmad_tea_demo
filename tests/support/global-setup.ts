import {
  authStorageInit,
  configureAuthSession,
  setAuthProvider,
} from '@seontechnologies/playwright-utils/auth-session';
import path from 'node:path';
import { todoMvcAuthProvider } from './auth-fixture';

async function globalSetup(): Promise<void> {
  authStorageInit();
  configureAuthSession({
    storageDir: path.join(process.cwd(), 'test-results', 'auth-sessions'),
    debug: false,
  });
  setAuthProvider(todoMvcAuthProvider);
}

export default globalSetup;