import { Modal } from './Modal';

/** Small yes / no confirmation (leave the room, kick a ninja…) */
export function ConfirmDialog({ isOpen, title, children, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={title}
      maxWidth="max-w-sm"
      actions={
        <>
          <button type="button" className="btn btn-ghost min-h-[42px] px-4 py-1.5" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-primary min-h-[42px] px-4 py-1.5" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-ink-soft">{children}</div>
    </Modal>
  );
}
