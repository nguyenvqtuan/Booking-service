import enAuth from '../locales/en/auth.json';
import enCommon from '../locales/en/common.json';
import enErrors from '../locales/en/errors.json';
import enServices from '../locales/en/services.json';
import enValidation from '../locales/en/validation.json';
import viAuth from '../locales/vi/auth.json';
import viCommon from '../locales/vi/common.json';
import viErrors from '../locales/vi/errors.json';
import viServices from '../locales/vi/services.json';
import viValidation from '../locales/vi/validation.json';

export const resources = {
  vi: {
    common: viCommon,
    auth: viAuth,
    errors: viErrors,
    validation: viValidation,
    services: viServices,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    errors: enErrors,
    validation: enValidation,
    services: enServices,
  },
} as const;

export const NAMESPACES = ['common', 'auth', 'errors', 'validation', 'services'] as const;
