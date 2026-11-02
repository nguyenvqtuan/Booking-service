import 'i18next';
import type { resources } from './resources';

// Type-checked translation keys: t('auth:login.title') fails to compile if the key is missing.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: (typeof resources)['vi'];
  }
}
