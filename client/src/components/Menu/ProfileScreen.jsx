import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { AvatarPicker } from '../Shared/AvatarPicker';
import { CoinsIcon, CrownIcon, ExitIcon, SwordsIcon } from '../Shared/Icons';
import { MenuShell, PanelHeading } from './MenuParts';

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="paper-inset px-2 py-2.5 short:py-2 phland:py-1.5 text-center min-w-0">
      <Icon className="w-5 h-5 phland:w-4 phland:h-4 mx-auto text-shu" />
      <div className="font-display text-[24px] phland:text-[20px] leading-none text-ink tabular-nums mt-1">{value}</div>
      <div className="label-caps !text-[10px] mt-1 truncate">{label}</div>
    </div>
  );
}

function CoinRules() {
  const { config, coinName } = useAuth();
  const r = config?.rewards || { finish: 20, win: 30, perVp: 2, minVoteMinutes: 15 };
  return (
    <p className="text-[12.5px] leading-snug text-ink-soft">
      <strong className="text-ink">Cómo ganar {coinName}:</strong> +{r.finish} por terminar una partida, +{r.win} si ganas y +{r.perVp} por
      cada punto de victoria. No suman las partidas que abandonas, las de menos de 2 ninjas ni las terminadas por votación antes de {r.minVoteMinutes} minutos.
    </p>
  );
}

export function ProfileScreen({ onBack, onLogin }) {
  const { user, status, accountsEnabled, updateProfile, logout, fetchStats, coinName } = useAuth();
  const { playerName, setPlayerName, avatarId, setAvatarId, addToast } = useGame();
  const [name, setName] = useState(user ? user.displayName : playerName);
  const [avatar, setAvatar] = useState(user ? user.avatarId : avatarId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fresh numbers from the server when the screen opens
  const userId = user ? user.id : null;
  useEffect(() => {
    if (userId) fetchStats();
  }, [userId, fetchStats]);

  const trimmed = name.replace(/\s+/g, ' ').trim();
  const dirty = !!user && (trimmed !== user.displayName || avatar !== user.avatarId);

  const save = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!trimmed) {
      setError('Escribe tu nombre de ninja');
      return;
    }
    setSaving(true);
    setError('');
    const res = await updateProfile({ displayName: trimmed, avatarId: avatar });
    setSaving(false);
    if (res.success) addToast('Perfil guardado', 'success');
    else setError(res.error);
  };

  const signOut = async () => {
    await logout();
    addToast('Cerraste sesión. Puedes seguir jugando como invitado.', 'info', 4000);
  };

  // ─── Guest: local name / avatar and an invitation to sign in ───
  if (!user) {
    return (
      <MenuShell onProfile={() => {}} onLogin={onLogin} compactTitle>
        <PanelHeading title="Perfil" subtitle="Juegas como invitado en este dispositivo." onBack={onBack} />
        <label htmlFor="guest-name" className="label-caps block mb-1.5">Nombre y avatar del ninja</label>
        <div className="flex items-center gap-2.5">
          <AvatarPicker value={avatarId} onChange={setAvatarId} size={42} />
          <input
            id="guest-name"
            type="text"
            className="field"
            placeholder="ej. Kaito, Sombra del Este…"
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              try {
                localStorage.setItem('catan_player_name', e.target.value);
              } catch {
                // storage blocked
              }
            }}
            maxLength={20}
          />
        </div>
        <div className="mt-4 short:mt-3">
          <CoinRules />
        </div>
        {accountsEnabled && status !== 'loading' ? (
          <button type="button" onClick={onLogin} className="btn btn-primary w-full mt-4 short:mt-3 min-h-[44px] py-2.5 text-[15px]">
            Iniciar sesión o crear cuenta
          </button>
        ) : status === 'disabled' ? (
          <p className="mt-3 text-[12.5px] text-ink-faint">Las cuentas no están disponibles ahora.</p>
        ) : null}
      </MenuShell>
    );
  }

  // ─── Signed in ───
  return (
    <MenuShell onProfile={() => {}} onLogin={onLogin} compactTitle>
      <PanelHeading title="Perfil" onBack={onBack} />

      <form onSubmit={save}>
        <label htmlFor="profile-name" className="label-caps block mb-1.5">Nombre y avatar del ninja</label>
        <div className="flex items-center gap-2.5">
          <AvatarPicker value={avatar} onChange={setAvatar} size={42} />
          <input
            id="profile-name"
            type="text"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            required
            autoComplete="nickname"
          />
          <button type="submit" disabled={!dirty || saving} className="btn btn-primary shrink-0 min-h-[44px] px-3.5 py-2 text-[14px]">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {error && <p className="text-[13px] text-shu font-semibold mt-1.5" role="alert">{error}</p>}
      </form>

      <div className="grid grid-cols-3 gap-2 mt-4 short:mt-3 phland:mt-2.5">
        <StatTile icon={SwordsIcon} label="Partidas" value={user.gamesPlayed} />
        <StatTile icon={CrownIcon} label="Victorias" value={user.gamesWon} />
        <StatTile icon={CoinsIcon} label={coinName} value={user.coins} />
      </div>

      <div className="mt-3.5 short:mt-3 phland:mt-2">
        <CoinRules />
      </div>

      <div className="mt-4 short:mt-3 phland:mt-2.5 pt-3 phland:pt-2 border-t border-dashed border-ink/25 flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[12.5px] leading-tight text-ink-faint">
          <span className="block truncate text-ink-soft font-semibold">{user.email}</span>
          {user.authProvider === 'google' ? 'Cuenta de Google' : 'Cuenta con correo y contraseña'}
        </p>
        <button type="button" onClick={signOut} className="btn btn-ghost shrink-0 min-h-[40px] px-3 py-1.5 text-[13px]">
          <ExitIcon className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </MenuShell>
  );
}
