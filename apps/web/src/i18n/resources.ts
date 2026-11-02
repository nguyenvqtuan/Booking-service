import enAppointments from '../locales/en/appointments.json';
import enAuth from '../locales/en/auth.json';
import enCommon from '../locales/en/common.json';
import enCustomers from '../locales/en/customers.json';
import enErrors from '../locales/en/errors.json';
import enServices from '../locales/en/services.json';
import enStaff from '../locales/en/staff.json';
import enValidation from '../locales/en/validation.json';
import viAppointments from '../locales/vi/appointments.json';
import viAuth from '../locales/vi/auth.json';
import viCommon from '../locales/vi/common.json';
import viCustomers from '../locales/vi/customers.json';
import viErrors from '../locales/vi/errors.json';
import viServices from '../locales/vi/services.json';
import viStaff from '../locales/vi/staff.json';
import viValidation from '../locales/vi/validation.json';

export const resources = {
  vi: {
    common: viCommon,
    auth: viAuth,
    errors: viErrors,
    validation: viValidation,
    services: viServices,
    staff: viStaff,
    customers: viCustomers,
    appointments: viAppointments,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    errors: enErrors,
    validation: enValidation,
    services: enServices,
    staff: enStaff,
    customers: enCustomers,
    appointments: enAppointments,
  },
} as const;

export const NAMESPACES = [
  'common',
  'auth',
  'errors',
  'validation',
  'services',
  'staff',
  'customers',
  'appointments',
] as const;
