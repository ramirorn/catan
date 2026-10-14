import { useGame } from '../../context/GameContext';
import { AlertIcon, CheckIcon, InfoIcon } from './Icons';

export function ToastContainer() {
  const { toasts } = useGame();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-3 sm:right-5 z-[60] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-1.5rem)] sm:max-w-sm w-full items-end">
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';

        return (
          <div
            key={toast.id}
            role="status"
            className={`paper animate-toast-slide pointer-events-auto flex items-start gap-2.5 pl-3 pr-4 py-2.5 rounded-[2px] border border-paper-edge border-l-4 shadow-[0_8px_18px_-6px_rgba(0,0,0,0.6)] ${
              isError ? '!border-l-shu' : isSuccess ? '!border-l-leaf' : '!border-l-chakra'
            }`}
          >
            <span className={`shrink-0 mt-px ${isError ? 'text-shu' : isSuccess ? 'text-leaf' : 'text-chakra'}`}>
              {isError ? <AlertIcon className="w-4.5 h-4.5" /> : isSuccess ? <CheckIcon className="w-4.5 h-4.5" /> : <InfoIcon className="w-4.5 h-4.5" />}
            </span>
            <span className="text-[14px] font-semibold text-ink leading-snug">
              {toast.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
