import enAppointmentAction from '../locales/en/appointmentAction.json';
import enAppointments from '../locales/en/appointments.json';
import enAuth from '../locales/en/auth.json';
import enBooking from '../locales/en/booking.json';
import enCommon from '../locales/en/common.json';
import enCustomers from '../locales/en/customers.json';
import enErrors from '../locales/en/errors.json';
import enReports from '../locales/en/reports.json';
import enServices from '../locales/en/services.json';
import enSettings from '../locales/en/settings.json';
import enStaff from '../locales/en/staff.json';
import enValidation from '../locales/en/validation.json';
import viAppointmentAction from '../locales/vi/appointmentAction.json';
import viAppointments from '../locales/vi/appointments.json';
import viAuth from '../locales/vi/auth.json';
import viBooking from '../locales/vi/booking.json';
import viCommon from '../locales/vi/common.json';
import viCustomers from '../locales/vi/customers.json';
import viErrors from '../locales/vi/errors.json';
import viReports from '../locales/vi/reports.json';
import viServices from '../locales/vi/services.json';
import viSettings from '../locales/vi/settings.json';
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
    settings: viSettings,
    booking: viBooking,
    appointmentAction: viAppointmentAction,
    reports: viReports,
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
    settings: enSettings,
    booking: enBooking,
    appointmentAction: enAppointmentAction,
    reports: enReports,
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
  'settings',
  'booking',
  'appointmentAction',
  'reports',
] as const;
