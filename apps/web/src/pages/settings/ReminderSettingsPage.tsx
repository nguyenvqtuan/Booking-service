import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  type ReminderSettingsDto,
  type SalonSettingsDto,
  REMINDER_MAX_OFFSET_MIN,
  REMINDER_MAX_OFFSETS,
  REMINDER_MIN_OFFSET_MIN,
} from '@booking/shared';
import { useReminderSettings, useSaveReminderSettings } from '../../hooks/useReminderSettings';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/api-error';

const PRESETS = [2880, 1440, 240, 120, 60, 30];

export function ReminderSettingsPage() {
  const { t } = useTranslation('common');
  const { data } = useReminderSettings();
  if (!data) return <p role="status">{t('loading')}</p>;
  return (
    <>
      <ReminderSettingsForm initial={data} />
      <OnlineBookingSettings />
    </>
  );
}

function OnlineBookingSettings() {
  const { t } = useTranslation('settings');
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['salon-settings'],
    queryFn: async () => (await api.get<SalonSettingsDto>('/salon-settings')).data,
  });
  const save = useMutation({
    mutationFn: async (input: SalonSettingsDto) =>
      (await api.put<SalonSettingsDto>('/salon-settings', input)).data,
    onSuccess: (saved) => qc.setQueryData(['salon-settings'], saved),
  });
  return (
    <section className="settings-form">
      <h2>{t('onlineBooking.title')}</h2>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={data?.onlineBookingOtp ?? false}
          disabled={!data || save.isPending}
          onChange={(e) => save.mutate({ onlineBookingOtp: e.target.checked })}
        />
        {t('onlineBooking.otp')}
      </label>
    </section>
  );
}

function ReminderSettingsForm({ initial }: { initial: ReminderSettingsDto }) {
  const { t } = useTranslation(['settings', 'common']);
  const save = useSaveReminderSettings();
  const [offsets, setOffsets] = useState<number[]>(initial.offsets);
  const [fallbackEnabled, setFallbackEnabled] = useState(initial.fallbackEnabled);
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();

  const label = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0 && h % 24 === 0) return t('offset.days', { count: h / 24 });
    if (m === 0) return t('offset.hours', { count: h });
    if (h === 0) return t('offset.minutes', { count: m });
    return t('offset.hoursMinutes', { h, m });
  };

  const sorted = (list: number[]) => [...new Set(list)].sort((x, y) => y - x);
  const toggle = (minutes: number) =>
    setOffsets((cur) =>
      cur.includes(minutes) ? cur.filter((x) => x !== minutes) : sorted([...cur, minutes]),
    );

  const custom = Number(customHours || 0) * 60 + Number(customMinutes || 0);
  const customValid =
    Number.isInteger(custom) &&
    custom >= REMINDER_MIN_OFFSET_MIN &&
    custom <= REMINDER_MAX_OFFSET_MIN;
  const full = offsets.length >= REMINDER_MAX_OFFSETS;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(undefined);
    try {
      await save.mutateAsync({ offsets, fallbackEnabled });
      setMessage({ kind: 'ok', text: t('saved') });
    } catch (err) {
      setMessage({ kind: 'error', text: getApiErrorMessage(err) });
    }
  };

  return (
    <form onSubmit={onSubmit} className="settings-form">
      <h1>{t('reminders.title')}</h1>
      <p className="muted">{t('reminders.description')}</p>

      <fieldset className="checkbox-group">
        <legend>{t('reminders.offsets')}</legend>
        {sorted([...PRESETS, ...offsets]).map((minutes) => (
          <label key={minutes} className="checkbox">
            <input
              type="checkbox"
              checked={offsets.includes(minutes)}
              disabled={!offsets.includes(minutes) && full}
              onChange={() => toggle(minutes)}
            />
            {t('reminders.before', { offset: label(minutes) })}
          </label>
        ))}
        <div className="custom-offset">
          <input
            type="number"
            min={0}
            aria-label={t('reminders.customHours')}
            placeholder={t('reminders.customHours')}
            value={customHours}
            onChange={(e) => setCustomHours(e.target.value)}
          />
          <input
            type="number"
            min={0}
            max={59}
            aria-label={t('reminders.customMinutes')}
            placeholder={t('reminders.customMinutes')}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={!customValid || full || offsets.includes(custom)}
            onClick={() => {
              setOffsets((cur) => sorted([...cur, custom]));
              setCustomHours('');
              setCustomMinutes('');
            }}
          >
            {t('reminders.addCustom')}
          </button>
        </div>
        <p className="muted">{t('reminders.limits', { max: REMINDER_MAX_OFFSETS })}</p>
        {offsets.length === 0 && <p className="form-error">{t('reminders.none')}</p>}
      </fieldset>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={fallbackEnabled}
          onChange={(e) => setFallbackEnabled(e.target.checked)}
        />
        {t('reminders.fallback')}
      </label>

      {message && (
        <p className={message.kind === 'ok' ? 'form-success' : 'form-error'} role="status">
          {message.text}
        </p>
      )}
      <button type="submit" className="btn-primary btn-inline" disabled={save.isPending}>
        {t('save')}
      </button>
    </form>
  );
}
