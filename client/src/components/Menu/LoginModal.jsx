import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';

// Mounted only while open, so every opening starts clean.
// Google's four-colour "G" (sign-in button branding)
function GoogleG(props) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginModal({ isOpen, onClose }) {
  const { login, register, loginWithGoogle, config, accountsEnabled } = useAuth();
  const { playerName, avatarId, addToast } = useGame();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(playerName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const res = mode === 'register'
      ? await register({ email, password, displayName: name, avatarId })
      : await login({ email, password });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    addToast(mode === 'register' ? `¡Cuenta creada, ${res.user.displayName}! Ya ganas Ryō al jugar.` : `¡Hola de nuevo, ${res.user.displayName}!`, 'success', 4000);
    onClose();
  };

  const google = () => {
    setBusy(true);
    loginWithGoogle();
  };

  const tabClass = (active) =>
    `flex-1 pb-2 text-[14px] min-[360px]:text-[15px] leading-tight font-bold border-b-2 transition-colors cursor-pointer ${
      active ? 'border-chakra text-ink' : 'border-transparent text-ink-faint hover:text-ink-soft'
    }`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'} maxWidth="max-w-md">
      {!accountsEnabled ? (
        <p className="text-[14px] text-ink-soft">{config?.message || 'Las cuentas no están disponibles ahora. Puedes jugar como invitado.'}</p>
      ) : (
        <>
          <div className="flex gap-4 mb-4 phland:mb-3 border-b border-ink/15" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setError(''); }} className={tabClass(mode === 'login')}>
              Ya tengo cuenta
            </button>
            <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setError(''); }} className={tabClass(mode === 'register')}>
              Soy nuevo
            </button>
          </div>

          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="btn w-full min-h-[44px] py-2.5 text-[15px] bg-white text-[#1f1f1f] border border-[#747775] hover:bg-[#f6f6f6] shadow-[0_1px_2px_rgba(0,0,0,0.2)] disabled:opacity-60"
          >
            <GoogleG className="w-5 h-5" />
            Continuar con Google
          </button>

          <div className="flex items-center gap-3 my-3.5 phland:my-2.5 text-[12px] text-ink-faint" aria-hidden="true">
            <span className="flex-1 border-t border-ink/20" />o con tu correo<span className="flex-1 border-t border-ink/20" />
          </div>

          <form onSubmit={submit} className="space-y-3 phland:space-y-2">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="label-caps block mb-1">Nombre de ninja</label>
                <input
                  id="auth-name"
                  type="text"
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  required
                  autoComplete="nickname"
                  placeholder="ej. Kaito"
                />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className="label-caps block mb-1">Correo</label>
              <input
                id="auth-email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                required
                autoComplete="email"
                inputMode="email"
                placeholder="tu@correo.com"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="label-caps block mb-1">Contraseña</label>
              <input
                id="auth-password"
                type="password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'register' ? 8 : undefined}
                maxLength={128}
                required
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                placeholder={mode === 'register' ? 'Al menos 8 caracteres' : ''}
              />
            </div>
            {error && <p className="text-[13px] text-shu font-semibold" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className="btn btn-primary w-full min-h-[44px] py-2.5 text-[15px]">
              {busy ? 'Un momento…' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
            </button>
          </form>
          <p className="text-[12px] text-ink-faint mt-3 leading-snug">
            No necesitas cuenta para jugar. Con ella guardas tu perfil y ganas Ryō en cada partida.
          </p>
        </>
      )}
    </Modal>
  );
}
