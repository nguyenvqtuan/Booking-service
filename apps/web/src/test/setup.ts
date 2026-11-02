import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../i18n';
import { server } from './msw';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('vi');
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
