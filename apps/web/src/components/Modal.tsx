import { type ReactNode, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  title: string;
  onClose(): void;
  children: ReactNode;
}

/** Accessible modal dialog: labelled by its title, closes on Escape or backdrop click. */
export function Modal({ title, onClose, children }: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn-icon" aria-label={t('close')} onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
