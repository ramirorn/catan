import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import { AlertIcon, InfoIcon } from '../Shared/Icons';
import { captureFace, preloadFaceDetector } from './faceCapture';
import { useRobberFaceData } from './robberFaceStore';

const FacePreview3D = lazy(() => import('./FacePreview3D'));

/**
 * Host only: pick a photo, find the face in this browser and put it on the
 * robber for the whole room. Mount it conditionally (fresh state each time).
 */
export function RobberFaceDialog({ onClose }) {
  const { setRobberFace, addToast } = useGame();
  const current = useRobberFaceData();
  const inputRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | working | ready | sending
  const [face, setFace] = useState(null); // { image, points } not sent yet
  const [error, setError] = useState('');

  // Start downloading the detector while the host looks for a photo
  useEffect(() => {
    preloadFaceDetector();
  }, []);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setStatus('working');
    try {
      setFace(await captureFace(file));
      setStatus('ready');
    } catch (err) {
      setFace(null);
      setStatus('idle');
      setError(err?.message || 'No se pudo leer esa foto');
    }
  };

  const send = async (value) => {
    setStatus('sending');
    setError('');
    const res = await setRobberFace(value);
    if (res.success) {
      addToast(value ? '¡El ladrón ya tiene cara!' : 'El ladrón volvió a esconder su cara', 'success');
      onClose();
    } else {
      setStatus(value ? 'ready' : 'idle');
      setError(res.error || 'No se pudo cambiar la cara');
    }
  };

  const shown = face || current;
  const busy = status === 'working' || status === 'sending';

  return createPortal(
    <Modal
      isOpen
      onClose={busy ? undefined : onClose}
      title="Cara del ladrón"
      maxWidth="max-w-md"
      actions={
        <>
          {current && !face && (
            <button type="button" className="btn btn-ghost min-h-[42px] px-4 py-1.5" disabled={busy} onClick={() => send(null)}>
              Quitar la cara
            </button>
          )}
          <button
            type="button"
            className={`btn ${face ? 'btn-ghost' : 'btn-primary'} min-h-[42px] px-4 py-1.5`}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {status === 'working' ? 'Buscando la cara…' : shown ? 'Elegir otra foto' : 'Elegir una foto'}
          </button>
          {face && (
            <button type="button" className="btn btn-primary min-h-[42px] px-4 py-1.5" disabled={busy} onClick={() => send(face)}>
              {status === 'sending' ? 'Enviando…' : 'Usar esta cara'}
            </button>
          )}
        </>
      }
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      <div className="text-ink-soft space-y-3">
        <p>Sube una foto de frente y el ninja renegado llevará esa cara en 3D durante la partida.</p>

        <div className="flex justify-center">
          <div className="relative w-[180px] h-[180px] rounded-full border-2 border-ink/25 bg-night/90 overflow-hidden">
            {shown ? (
              <Suspense fallback={<img src={shown.image} alt="" className="w-full h-full object-cover" />}>
                <FacePreview3D face={shown} />
              </Suspense>
            ) : (
              <span className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] italic text-paper-light/70">
                {status === 'working' ? 'Buscando la cara…' : 'Sin cara: el ladrón se esconde bajo el sombrero'}
              </span>
            )}
          </div>
        </div>
        {face && <p className="text-center text-[13px] font-semibold text-ink">Así se verá. ¿La usamos?</p>}

        {error && (
          <p role="alert" className="flex items-start gap-2 text-[13px] font-semibold text-shu-dark">
            <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </p>
        )}

        <p className="flex items-start gap-2 text-[12px] text-ink-faint">
          <InfoIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            La foto se analiza en tu dispositivo. Solo se envía la cara recortada a los ninjas de esta sala y se borra al
            cerrarse la sala. Usa fotos de personas que estén de acuerdo; una cara ofensiva puede reportarse.
          </span>
        </p>
      </div>
    </Modal>,
    document.body,
  );
}
