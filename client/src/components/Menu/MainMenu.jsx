import { useAuth } from '../../context/AuthContext';
import { ArrowRightIcon, CoinsIcon, CrownIcon, LeafSwirlIcon, NinjaIcon, ScrollIcon, SwordsIcon } from '../Shared/Icons';
import { MenuShell } from './MenuParts';

// One menu entry: seal with an icon, title, one-line hint, arrow
function MenuItem({ icon: Icon, title, hint, tag, onClick, primary = false }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group w-full flex items-center gap-3 text-left rounded-[3px] px-3 py-2 short:py-1.5 phland:py-1 lowdesk:py-1.5 min-h-[50px] short:min-h-[48px] phland:min-h-[42px] lowdesk:min-h-[46px] cursor-pointer transition-colors ${
          primary
            ? 'btn-primary'
            : 'border border-ink/25 hover:border-ink/55 hover:bg-paper-light/60'
        }`}
      >
        <span
          className={`shrink-0 w-9 h-9 phland:w-8 phland:h-8 flex items-center justify-center rounded-[6px] -rotate-3 ${
            primary ? 'bg-paper-light/95 text-shu shadow-[0_2px_0_#5a140a]' : 'hanko'
          }`}
          aria-hidden="true"
        >
          <Icon className="w-5 h-5 phland:w-4.5 phland:h-4.5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`flex items-center gap-2 font-display text-[19px] short:text-[18px] phland:text-[17px] leading-tight ${primary ? 'text-paper-light' : 'text-ink'}`}>
            {title}
            {tag && (
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-[2px] bg-chakra/15 text-chakra-dark border border-chakra/35">
                {tag}
              </span>
            )}
          </span>
          <span className={`block text-[12.5px] leading-snug mt-0.5 truncate ${primary ? 'text-paper/85' : 'text-ink-faint'}`}>{hint}</span>
        </span>
        <ArrowRightIcon className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${primary ? 'text-paper-light' : 'text-ink-soft'}`} />
      </button>
    </li>
  );
}

// Slim secondary entry: the lesson for new players (keeps the menu short)
function TutorialRow({ onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group w-full flex items-center gap-2.5 text-left rounded-[3px] px-3 min-h-[40px] phland:min-h-[36px] border border-dashed border-ink/35 hover:border-shu/70 hover:bg-paper-light/60 cursor-pointer transition-colors"
      >
        <span className="hanko !rounded-[5px] shrink-0 w-7 h-7 phland:w-6 phland:h-6 -rotate-3" aria-hidden="true">
          <LeafSwirlIcon className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0 truncate text-[13px] text-ink-faint">
          <span className="font-display text-[17px] phland:text-[16px] text-ink mr-1.5">Tutorial</span>
          Aprende a jugar Catán
        </span>
        <ArrowRightIcon className="w-4 h-4 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" />
      </button>
    </li>
  );
}

export function MainMenu({ onNavigate, onLogin }) {
  const { status, user, accountsEnabled, config } = useAuth();
  const loggedIn = !!user;

  return (
    <MenuShell onProfile={() => onNavigate('profile')} onLogin={onLogin}>
      <h2 className="font-display text-[24px] min-[360px]:text-[28px] short:text-[25px] phland:text-[24px] leading-tight text-ink">
        {loggedIn ? `Hola, ${user.displayName}` : 'Menú del ninja'}
      </h2>
      <p className="text-[14px] text-ink-soft mt-0.5 squat:hidden lowdesk:hidden">
        {loggedIn ? 'Tus partidas suman Ryō a tu cuenta.' : 'Juega como invitado o crea una cuenta para ganar Ryō.'}
      </p>
      <hr className="brush-rule mt-2 mb-4 short:mb-3 phland:mb-2.5 lowdesk:mb-3" />

      <ul className="space-y-2 short:space-y-1.5 phland:space-y-1 lowdesk:space-y-1.5">
        <MenuItem icon={SwordsIcon} title="Jugar" hint="Crea, únete u observa una sala" primary onClick={() => onNavigate('play')} />
        <MenuItem icon={CoinsIcon} title="Tienda" hint="Fichas y tableros shinobi por Ryō" onClick={() => onNavigate('shop')} />
        <MenuItem icon={CrownIcon} title="Ranking" hint="Los ninjas con más victorias" onClick={() => onNavigate('ranking')} />
        <MenuItem
          icon={NinjaIcon}
          title="Perfil"
          hint="Nombre, avatar y estadísticas"
          onClick={() => onNavigate('profile')}
        />
        {!loggedIn && accountsEnabled && status !== 'loading' && (
          <MenuItem icon={ScrollIcon} title="Iniciar sesión" hint="O crea tu cuenta (correo o Google)" onClick={onLogin} />
        )}
        <TutorialRow onClick={() => onNavigate('tutorial')} />
      </ul>

      {status === 'disabled' && (
        <p className="mt-3 text-[12.5px] leading-snug text-ink-faint">
          {config?.message || 'Las cuentas no están disponibles ahora. Puedes jugar como invitado.'}
        </p>
      )}
    </MenuShell>
  );
}
