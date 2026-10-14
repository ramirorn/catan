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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pt-4 pb-8 sm:p-6 bg-[#070a12]/75 animate-fade-in"
      onClick={onClose}
    >
      <ScrollPanel
        as="div"
        className={`animate-modal-pop w-full ${maxWidth}`}
        bodyClassName="max-h-[88dvh] sm:max-h-[84vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-7 pt-4 pb-2">
          {title && (
            <h2 className="flex items-center gap-2.5 font-display text-[22px] sm:text-[28px] leading-tight text-ink">
              <ShurikenIcon className="w-4 h-4 text-shu shrink-0" hole="#f1e9d6" />
              {title}
            </h2>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -mr-2 text-ink-faint hover:text-shu rounded-full hover:bg-ink/5 transition-colors ml-auto cursor-pointer"
              title="Cerrar"
              aria-label="Cerrar"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="px-5 sm:px-7">
          <hr className="brush-rule" />
        </div>

        {/* Scrollable Body */}
        <div className="px-5 sm:px-7 py-4 overflow-y-auto flex-1 text-ink text-[14px]">
          {children}
        </div>

        {/* Footer Actions */}
        {actions && (
          <div className="flex items-center justify-end gap-3 px-5 sm:px-7 py-3 border-t border-dashed border-ink/25 bg-paper-deep/40">
            {actions}
          </div>
        )}
      </ScrollPanel>
    </div>
  );
}
