import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceDto } from '@booking/shared';
import { Modal } from '../../components/Modal';
import { useDeleteService, useSaveService, useServices } from '../../hooks/useServices';
import { currentLocale } from '../../i18n';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatCurrency } from '../../lib/format';
import { ServiceForm } from './ServiceForm';

type Editing = { mode: 'create' } | { mode: 'edit'; service: ServiceDto } | null;

export function ServicesPage() {
  const { t } = useTranslation(['services', 'common', 'errors']);
  const { data: services, isPending, isError } = useServices();
  const save = useSaveService();
  const remove = useDeleteService();
  const [editing, setEditing] = useState<Editing>(null);
  const [actionError, setActionError] = useState<string>();

  const run = async (action: () => Promise<unknown>) => {
    setActionError(undefined);
    try {
      await action();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  };

  const toggleActive = (s: ServiceDto) =>
    run(() => save.mutateAsync({ id: s.id, input: { isActive: !s.isActive } }));

  const deleteService = (s: ServiceDto) => {
    if (window.confirm(t('confirmDelete', { name: s.name })))
      void run(() => remove.mutateAsync(s.id));
  };

  return (
    <>
      <div className="page-header">
        <h1>{t('title')}</h1>
        <button
          type="button"
          className="btn-primary btn-inline"
          onClick={() => setEditing({ mode: 'create' })}
        >
          {t('add')}
        </button>
      </div>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {isPending && <p role="status">{t('common:loading')}</p>}
      {isError && <p className="form-error">{t('errors:fallback')}</p>}
      {services?.length === 0 && <p className="empty">{t('empty')}</p>}

      {!!services?.length && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('fields.name')}</th>
                <th>{t('fields.durationMin')}</th>
                <th>{t('fields.price')}</th>
                <th>{t('status')}</th>
                <th aria-label={t('actions')} />
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className={s.isActive ? undefined : 'row-muted'}>
                  <td>{s.name}</td>
                  <td>{t('minutes', { count: s.durationMin })}</td>
                  <td>{formatCurrency(s.price, currentLocale())}</td>
                  <td>{s.isActive ? t('active') : t('hidden')}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setEditing({ mode: 'edit', service: s })}
                    >
                      {t('edit')}
                    </button>
                    <button type="button" className="btn-link" onClick={() => void toggleActive(s)}>
                      {s.isActive ? t('hide') : t('show')}
                    </button>
                    <button
                      type="button"
                      className="btn-link danger"
                      onClick={() => deleteService(s)}
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          title={editing.mode === 'create' ? t('add') : t('editTitle')}
          onClose={() => setEditing(null)}
        >
          <ServiceForm
            service={editing.mode === 'edit' ? editing.service : undefined}
            onDone={() => setEditing(null)}
          />
        </Modal>
      )}
    </>
  );
}
