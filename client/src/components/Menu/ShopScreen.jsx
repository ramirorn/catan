import { useAuth } from '../../context/AuthContext';
import { CityIcon, CoinsIcon, RoadIcon, SettlementIcon } from '../Shared/Icons';
import { MenuShell, PanelHeading } from './MenuParts';

// Placeholder until the shop opens: shows the balance and what is coming
export function ShopScreen({ onBack, onLogin, onProfile }) {
  const { user, coinName, accountsEnabled, status } = useAuth();

  return (
    <MenuShell onProfile={onProfile} onLogin={onLogin} compactTitle>
      <PanelHeading title="Tienda" subtitle="Cambia tus Ryō por fichas y tableros." onBack={onBack} />

      <div className="relative paper-inset px-4 py-4 short:py-3 phland:py-2.5 flex items-center gap-4">
        <span className="shrink-0 w-14 h-14 phland:w-11 phland:h-11 flex items-center justify-center rounded-full bg-night text-chakra-light shadow-[inset_0_0_0_2px_rgba(226,113,29,0.55)]">
          <CoinsIcon className="w-8 h-8 phland:w-6 phland:h-6" />
        </span>
        <div className="min-w-0">
          <div className="label-caps">Tu bolsa</div>
          {user ? (
            <div className="font-display text-[30px] phland:text-[24px] leading-none text-ink tabular-nums mt-1">
              {user.coins} <span className="text-[18px] text-chakra-dark">{coinName}</span>
            </div>
          ) : (
            <p className="text-[14px] text-ink-soft mt-1 leading-snug">
              {accountsEnabled ? 'Inicia sesión para guardar los Ryō que ganas al jugar.' : 'Las cuentas no están disponibles ahora.'}
            </p>
          )}
        </div>
        <span
          className="hanko absolute -top-3 -right-2 !rounded-[5px] rotate-6 px-2 py-1 font-display text-[15px] leading-none shadow-[inset_0_0_0_1.5px_rgba(251,241,224,0.6),0_2px_0_#5a140a]"
        >
          Próximamente
        </span>
      </div>

      <ul className="mt-4 short:mt-3 grid grid-cols-3 gap-2 text-center" aria-label="Lo que llegará a la tienda">
        {[
          { icon: SettlementIcon, label: 'Aldeas' },
          { icon: RoadIcon, label: 'Caminos' },
          { icon: CityIcon, label: 'Tableros' },
        ].map(({ icon: Icon, label }) => (
          <li key={label} className="border border-dashed border-ink/30 rounded-[3px] py-3 short:py-2.5 phland:py-1.5 text-ink-faint">
            <Icon className="w-7 h-7 phland:w-5 phland:h-5 mx-auto" />
            <span className="block text-[12px] font-bold mt-1">{label}</span>
          </li>
        ))}
      </ul>

      <p className="text-[13px] text-ink-soft mt-3 leading-snug">
        Pronto podrás vestir tus piezas (todos los ninjas las verán) y elegir el tablero de las salas que crees.
      </p>

      {!user && accountsEnabled && status !== 'loading' && (
        <button type="button" onClick={onLogin} className="btn btn-primary w-full mt-4 short:mt-3 min-h-[44px] py-2.5 text-[15px]">
          Iniciar sesión o crear cuenta
        </button>
      )}
    </MenuShell>
  );
}
