import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Avatar } from '../Shared/Avatar';
import { BrandPlate } from '../Shared/Brand';
import { ArrowRightIcon, CoinsIcon } from '../Shared/Icons';
import { ScrollPanel } from '../Shared/ScrollPanel';
import { InstallAppButton } from '../Shared/Pwa';
import { IslandChart } from '../Lobby/IslandChart';

/** "← Menú" link used at the top right of a menu panel */
export function BackButton({ onClick, label = 'Menú', className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 min-h-[36px] px-2 rounded-[2px] text-[13px] font-bold text-ink-soft hover:text-shu hover:bg-ink/5 cursor-pointer shrink-0 ${className}`}
      aria-label={`Volver al ${label.toLowerCase()}`}
    >
      <ArrowRightIcon className="w-4 h-4 rotate-180" />
      {label}
    </button>
  );
}

/** Coin balance pill: gold coins on lacquer (night) or on paper */
export function CoinBadge({ coins, tone = 'night', className = '' }) {
  const { coinName } = useAuth();
  const night = tone === 'night';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-0.5 font-bold tabular-nums leading-none ${
        night
          ? 'bg-night-dark/70 text-chakra-light border border-chakra/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'bg-paper-light text-chakra-dark border border-chakra/50'
      } ${className}`}
      title={`${coins} ${coinName}`}
    >
      <CoinsIcon className="w-4 h-4 shrink-0" />
      <span>{coins}</span>
      <span className={`text-[0.82em] ${night ? 'text-paper/70' : 'text-ink-faint'}`}>{coinName}</span>
    </span>
  );
}

/** Header chip: avatar + name + Ryō (signed in) or the sign-in button */
export function AccountChip({ onProfile, onLogin }) {
  const { status, user } = useAuth();
  if (status === 'loading' || status === 'disabled') return <span className="min-h-[40px]" aria-hidden="true" />;
  if (!user) {
    return (
      <button
        type="button"
        onClick={onLogin}
        className="btn min-h-[40px] px-3 py-1.5 text-[13px] text-paper-light border border-paper/40 hover:border-chakra-light hover:text-chakra-light bg-night-dark/40"
      >
        Iniciar sesión
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onProfile}
      className="group inline-flex items-center gap-2 min-h-[40px] pl-1 pr-1 py-1 rounded-full bg-night-dark/45 border border-paper/15 hover:border-chakra/60 cursor-pointer min-w-0"
      title="Ver tu perfil"
    >
      <Avatar id={user.avatarId} size={32} ring="#e2711d" />
      <span className="max-[359px]:hidden text-[13px] font-bold text-paper-light truncate max-w-[9rem] group-hover:text-chakra-light">
        {user.displayName}
      </span>
      <CoinBadge coins={user.coins} className="text-[13px]" />
    </button>
  );
}

/** Big "Catán Shinobi" title with its seal (same as the lobby) */
function TitleBlock({ compact = false }) {
  return (
    <section className="flex flex-col items-center lg:items-start phland:items-start text-center lg:text-left phland:text-left lg:h-full lg:min-h-0 lg:justify-center phland:justify-center">
      <div className="flex items-start gap-3 sm:gap-4">
        <h1 className="font-display leading-[0.85] text-paper-light drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">
          <span className={`block ${compact ? 'text-[52px] short:text-[46px] tiny:text-[40px]' : 'text-[68px] short:text-[56px] tiny:text-[46px]'} sm:text-[96px] phland:text-[52px]`}>Catán</span>
          <span className={`block ${compact ? 'text-[30px] short:text-[27px] tiny:text-[24px]' : 'text-[38px] short:text-[32px] tiny:text-[28px]'} sm:text-[52px] phland:text-[30px] text-chakra mt-1 sm:mt-0 lg:pl-1 phland:pl-1`}>Shinobi</span>
        </h1>
        <span
          className="hanko !rounded-[6px] mt-2 w-11 h-11 tiny:w-9 tiny:h-9 sm:w-14 sm:h-14 phland:w-10 phland:h-10 font-display text-[28px] tiny:text-[22px] sm:text-[36px] phland:text-[24px] leading-none -rotate-6 shrink-0"
          aria-hidden="true"
        >
          忍
        </span>
      </div>
      <p className="text-paper/75 text-[15px] short:text-[14px] sm:text-lg phland:text-[14px] mt-3 short:mt-2 phland:mt-2 max-w-md squat:hidden">
        Comercia, construye y expande tu aldea oculta en el país de las hojas.
      </p>
      <IslandChart className="hidden lg:block w-full lg:max-w-[520px] lg:flex-1 lg:min-h-0 lg:h-auto lg:max-h-[460px] mt-6" />
    </section>
  );
}

/**
 * Layout of the menu screens: a header (brand + account chip), the title on
 * the left (top on phones) and a hanging scroll panel with the content.
 */
export function MenuShell({ children, onProfile, onLogin, compactTitle = false, panelClassName = '' }) {
  const { connected } = useSocket();
  return (
    <div className="night-surface relative h-dvh w-full overflow-y-auto lg:overflow-hidden phland:overflow-hidden">
      <div className="min-h-full lg:h-full phland:h-full w-full max-w-6xl mx-auto safe-x [--pad-x:1rem] min-[360px]:[--pad-x:1.25rem] sm:[--pad-x:2rem] pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-6 sm:pb-8 lg:py-5 phland:pt-[max(0.5rem,env(safe-area-inset-top))] phland:pb-[max(0.5rem,env(safe-area-inset-bottom))] flex flex-col gap-3 sm:gap-5 phland:gap-2">
        <header className="flex items-center justify-between gap-3 shrink-0">
          <p className="flex items-center gap-2 min-w-0 text-[10px] min-[360px]:text-[11px] sm:text-xs font-bold uppercase tracking-[0.12em] min-[420px]:tracking-[0.2em] text-chakra-light/85">
            <BrandPlate className="w-8 h-5 shrink-0" />
            <span className="max-[479px]:hidden truncate">Partida multijugador en tiempo real</span>
          </p>
          <AccountChip onProfile={onProfile} onLogin={onLogin} />
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[1.15fr_1fr] lg:grid-rows-[minmax(0,1fr)] phland:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] phland:grid-rows-[minmax(0,1fr)] gap-4 short:gap-3 sm:gap-7 lg:gap-12 phland:gap-6 items-center content-center">
          <TitleBlock compact={compactTitle} />

          <ScrollPanel
            className={`w-full max-w-md mx-auto lg:mx-0 phland:mx-0 phland:max-w-none animate-modal-pop lg:max-h-full lg:min-h-0 lg:flex lg:flex-col phland:max-h-full phland:min-h-0 phland:flex phland:flex-col ${panelClassName}`}
            bodyClassName="px-4 min-[360px]:px-5 sm:px-8 pt-5 short:pt-4 tiny:pt-3 pb-6 short:pb-5 tiny:pb-4 phland:px-5 phland:pt-3 phland:pb-3.5 lg:min-h-0 lg:overflow-y-auto phland:min-h-0 phland:overflow-y-auto"
          >
            {children}
            <div className="mt-5 short:mt-3.5 tiny:mt-2.5 phland:mt-2.5 flex items-center gap-2 text-[12px] text-ink-faint">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-leaf' : 'bg-shu-light'}`} />
              {connected ? 'Conectado al servidor' : 'Sin conexión con el servidor'}
              <InstallAppButton className="ml-auto" />
            </div>
          </ScrollPanel>
        </div>
      </div>
    </div>
  );
}

/** Panel heading: title (+ optional subtitle) and a back link */
export function PanelHeading({ title, subtitle, onBack }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[24px] min-[360px]:text-[28px] short:text-[25px] phland:text-[24px] leading-tight text-ink">{title}</h2>
        {onBack && <BackButton onClick={onBack} className="-mr-1.5 mt-0.5" />}
      </div>
      {subtitle && <p className="text-[14px] text-ink-soft mt-0.5">{subtitle}</p>}
      <hr className="brush-rule mt-2 mb-4 short:mb-3 phland:mb-2.5" />
    </>
  );
}
