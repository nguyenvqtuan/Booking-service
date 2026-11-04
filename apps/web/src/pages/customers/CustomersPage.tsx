import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type CustomerDto, formatPhone } from '@booking/shared';
import { Modal } from '../../components/Modal';
import { CUSTOMERS_PAGE_SIZE, useCustomers, useDeleteCustomer } from '../../hooks/useCustomers';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { getApiErrorMessage } from '../../lib/api-error';
import { CustomerDetail } from './CustomerDetail';
import { CustomerForm } from './CustomerForm';
import { NoShowBadge } from './NoShowBadge';

type Dialog =
  | { mode: 'create' }
  | { mode: 'edit'; customer: CustomerDto }
  | { mode: 'detail'; customer: CustomerDto }
  | null;

export function CustomersPage() {
  const { t } = useTranslation(['customers', 'common', 'errors']);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebouncedValue(search.trim());
  const { data, isPending, isError } = useCustomers(q, page);
  const remove = useDeleteCustomer();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string>();

  const pages = data ? Math.max(1, Math.ceil(data.total / CUSTOMERS_PAGE_SIZE)) : 1;

  const deleteCustomer = async (c: CustomerDto) => {
    if (!window.confirm(t('confirmDelete', { name: c.name }))) return;
    setActionError(undefined);
    try {
      await remove.mutateAsync(c.id);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>{t('title')}</h1>
        <button
          type="button"
          className="btn-primary btn-inline"
          onClick={() => setDialog({ mode: 'create' })}
        >
          {t('add')}
        </button>
      </div>

      <input
        type="search"
        className="search-input"
        aria-label={t('search')}
        placeholder={t('searchPlaceholder')}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {isPending && <p role="status">{t('common:loading')}</p>}
      {isError && <p className="form-error">{t('errors:fallback')}</p>}
      {data?.total === 0 && <p className="empty">{q ? t('noResults') : t('empty')}</p>}

      {!!data?.items.length && (
        <>
          <div className="table-wrap">
            <table className="data-table data-table-cards">
              <thead>
                <tr>
                  <th>{t('fields.name')}</th>
                  <th>{t('fields.phone')}</th>
                  <th aria-label={t('actions')} />
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td data-label={t('fields.name')}>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setDialog({ mode: 'detail', customer: c })}
                      >
                        {c.name}
                      </button>
                      <NoShowBadge count={c.noShowCount} />
                    </td>
                    <td data-label={t('fields.phone')}>{formatPhone(c.phone)}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setDialog({ mode: 'edit', customer: c })}
                      >
                        {t('edit')}
                      </button>
                      <button
                        type="button"
                        className="btn-link danger"
                        onClick={() => void deleteCustomer(c)}
                      >
                        {t('delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="btn-secondary"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                {t('prev')}
              </button>
              <span>{t('pageOf', { page: page + 1, pages })}</span>
              <button
                type="button"
                className="btn-secondary"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
              </button>
            </div>
          )}
        </>
      )}

      {dialog?.mode === 'detail' && (
        <Modal title={t('detailTitle')} onClose={() => setDialog(null)}>
          <CustomerDetail id={dialog.customer.id} />
        </Modal>
      )}
      {(dialog?.mode === 'create' || dialog?.mode === 'edit') && (
        <Modal
          title={dialog.mode === 'create' ? t('add') : t('editTitle')}
          onClose={() => setDialog(null)}
        >
          <CustomerForm
            customer={dialog.mode === 'edit' ? dialog.customer : undefined}
            onDone={() => setDialog(null)}
          />
        </Modal>
      )}
    </>
  );
}
