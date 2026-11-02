import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type StaffDto, WEEKDAYS } from '@booking/shared';
import { Modal } from '../../components/Modal';
import { useServices } from '../../hooks/useServices';
import { useDeleteStaff, useSaveStaff, useStaffList } from '../../hooks/useStaff';
import { getApiErrorMessage } from '../../lib/api-error';
import { StaffForm } from './StaffForm';

type Editing = { mode: 'create' } | { mode: 'edit'; staff: StaffDto } | null;

export function StaffPage() {
  const { t } = useTranslation(['staff', 'common', 'errors']);
  const { data: staff, isPending, isError } = useStaffList();
  const { data: services = [] } = useServices();
  const save = useSaveStaff();
  const remove = useDeleteStaff();
  const [editing, setEditing] = useState<Editing>(null);
  const [actionError, setActionError] = useState<string>();

  const serviceName = (id: string) => services.find((s) => s.id === id)?.name;

  const run = async (action: () => Promise<unknown>) => {
    setActionError(undefined);
    try {
      await action();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  };

  const workDays = (s: StaffDto) =>
    WEEKDAYS.filter((d) => s.workingHours[d].length > 0)
      .map((d) => t(`weekdays.${d}`))
      .join(', ') || t('noWorkDays');

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
      {staff?.length === 0 && <p className="empty">{t('empty')}</p>}

      {!!staff?.length && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('fields.name')}</th>
                <th>{t('fields.phone')}</th>
                <th>{t('workDays')}</th>
                <th>{t('fields.services')}</th>
                <th aria-label={t('actions')} />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className={s.isActive ? undefined : 'row-muted'}>
                  <td>
                    {s.name}
                    {!s.isActive && <span className="badge">{t('inactive')}</span>}
                  </td>
                  <td>{s.phone}</td>
                  <td>{workDays(s)}</td>
                  <td>{s.serviceIds.map(serviceName).filter(Boolean).join(', ')}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setEditing({ mode: 'edit', staff: s })}
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() =>
                        void run(() =>
                          save.mutateAsync({ id: s.id, input: { isActive: !s.isActive } }),
                        )
                      }
                    >
                      {s.isActive ? t('deactivate') : t('activate')}
                    </button>
                    <button
                      type="button"
                      className="btn-link danger"
                      onClick={() => {
                        if (window.confirm(t('confirmDelete', { name: s.name }))) {
                          void run(() => remove.mutateAsync(s.id));
                        }
                      }}
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
          <StaffForm
            staff={editing.mode === 'edit' ? editing.staff : undefined}
            onDone={() => setEditing(null)}
          />
        </Modal>
      )}
    </>
  );
}
