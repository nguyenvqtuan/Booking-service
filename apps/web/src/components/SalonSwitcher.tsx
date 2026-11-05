import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthResponse, SalonSummary } from '@booking/shared';
import { useAuth } from '../auth/auth-context';
import { api } from '../lib/api';
import { getApiErrorMessage } from '../lib/api-error';
import { setSession } from '../lib/session';
import { FormField } from './FormField';
import { Modal } from './Modal';

const ADD_BRANCH = '__add__';

/** Header control to change the current salon/branch or add a new one (BS-42). */
export function SalonSwitcher() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const switchTo = async (salonId: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const { data } = await api.post<AuthResponse>('/auth/switch-salon', { salonId });
      setSession(data); // AuthProvider drops the cached data of the previous salon.
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const createBranch = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { data } = await api.post<SalonSummary>('/salons', { name });
      setAdding(false);
      setName('');
      await switchTo(data.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <select
        className="salon-switcher"
        aria-label={t('branch.label')}
        value={user?.salonId ?? ''}
        disabled={busy}
        onChange={(e) => {
          if (e.target.value === ADD_BRANCH) setAdding(true);
          else void switchTo(e.target.value);
        }}
      >
        {user?.salons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
        <option value={ADD_BRANCH}>{t('branch.add')}</option>
      </select>
      {error && !adding && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
      {adding && (
        <Modal title={t('branch.add')} onClose={() => setAdding(false)}>
          <form onSubmit={(e) => void createBranch(e)} noValidate>
            <FormField
              label={t('branch.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={busy || name.trim().length < 2}>
              {t('branch.create')}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
