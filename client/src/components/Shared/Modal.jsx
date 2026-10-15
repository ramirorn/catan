import { useEffect } from 'react';
import { CloseIcon, ShurikenIcon } from './Icons';
import { ScrollPanel } from './ScrollPanel';

export function Modal({ isOpen, onClose, title, children, actions, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-wrap fixed inset-0 z-50 flex items-end sm:items-center phland:items-center justify-center bg-[#070a12]/75 animate-fade-in"
      onClick={onClose}
    >
      <ScrollPanel
        as="div"
        className={`animate-modal-pop w-full ${maxWidth}`}
        bodyClassName="modal-sheet flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-7 pt-3 sm:pt-4 phland:pt-2 pb-2 phland:pb-1">
          {title && (
            <h2 className="flex items-center gap-2.5 min-w-0 font-display text-[19px] min-[360px]:text-[21px] sm:text-[28px] phland:text-[21px] leading-tight text-ink">
              <ShurikenIcon className="w-4 h-4 text-shu shrink-0" hole="#f1e9d6" />
              {title}
            </h2>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 w-10 h-10 -mr-2 -mt-1 flex items-center justify-center text-ink-faint hover:text-shu rounded-full hover:bg-ink/5 transition-colors ml-auto cursor-pointer"
              title="Cerrar"
              aria-label="Cerrar"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="px-4 sm:px-7">
          <hr className="brush-rule" />
        </div>

        {/* Scrollable Body */}
        <div className="modal-body px-4 sm:px-7 py-4 phland:py-3 overflow-y-auto flex-1 min-h-0 text-ink text-[14px]">
          {children}
        </div>

        {/* Footer Actions */}
        {actions && (
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 px-4 sm:px-7 py-2.5 sm:py-3 phland:py-2 border-t border-dashed border-ink/25 bg-paper-deep/40">
            {actions}
          </div>
        )}
      </ScrollPanel>
    </div>
  );
}
