import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import { FlagIcon } from '../Shared/Icons';

const REPORT_REASONS = [
  { value: 'insultos', label: 'Insultos' },
  { value: 'trampa', label: 'Trampa' },
  { value: 'spam', label: 'Spam' },
  { value: 'nombre', label: 'Nombre ofensivo' },
  { value: 'imagen', label: 'Cara del ladrón' },
  { value: 'otro', label: 'Otro' },
];

/**
 * «Reportar» a ninja of this room to the moderators. `target` = { id, name,
 * messageId?, message?, reason? } (a chat message when reported from the
 * chat; `reason` preselects one, e.g. 'imagen' for the robber's face).
 * Mount it conditionally so every opening starts clean. Rendered in a
 * portal: the chat panel clips (overflow / containing block) fixed children.
 */
export function ReportDialog({ target, onClose }) {
  const { reportPlayer, addToast } = useGame();
  const [reason, setReason] = useState(target.reason || (target.messageId != null ? 'insultos' : ''));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError('');
    const res = await reportPlayer(target.id, reason, text.trim(), target.messageId ?? null);
    setBusy(false);
    if (res.success) {
      addToast('Reporte enviado. Gracias: los moderadores lo revisarán.', 'success', 4000);
      onClose();
    } else {
      setError(res.error || 'No se pudo enviar el reporte');
    }
  };

  return createPortal(
    <Modal
      isOpen
      onClose={onClose}
      title={`Reportar a ${target.name}`}
      maxWidth="max-w-sm"
      actions={
        <>
          <button type="button" className="btn btn-ghost min-h-[42px] px-4 py-1.5" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary min-h-[42px] px-4 py-1.5" disabled={!reason || busy} onClick={send}>
            <FlagIcon className="w-4 h-4" />
            {busy ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </>
      }
    >
      <div className="text-ink-soft space-y-3">
        {target.message && (
          <p className="text-[13px] border-l-2 border-shu/60 pl-2 italic text-ink">«{target.message}»</p>
        )}
        <fieldset>
          <legend className="label-caps !text-[10px] mb-1.5">Motivo</legend>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Motivo del reporte">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reason === r.value}
                onClick={() => setReason(r.value)}
                className={`min-h-[36px] px-3 py-1 rounded-[3px] border text-[13px] font-bold cursor-pointer ${
                  reason === r.value ? 'border-shu bg-shu/10 text-shu-dark' : 'border-ink/25 text-ink hover:border-ink/50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="label-caps !text-[10px] block mb-1">Detalles (opcional)</span>
          <textarea
            className="field w-full min-h-[70px] text-[14px] coarse:text-[16px]"
            maxLength={300}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="¿Qué pasó?"
          />
        </label>
        <p className="text-[12px] text-ink-faint">Se envían también los últimos mensajes del chat de la sala.</p>
        {error && <p role="alert" className="text-[13px] font-semibold text-shu-dark">{error}</p>}
      </div>
    </Modal>,
    document.body,
  );
}
