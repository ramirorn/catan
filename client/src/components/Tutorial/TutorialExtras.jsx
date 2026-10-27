// Small paper panels shown under the text of some tutorial steps.

import { BUILD_COSTS, RESOURCE_NAMES } from '../../utils/constants';
import { ResourceBundle, ResourceChip } from '../Shared/ResourceCard';
import {
  CardsIcon,
  CityIcon,
  DevCardIcon,
  MedalIcon,
  RoadIcon,
  SettlementIcon,
  ShipIcon,
  SwordsIcon,
  TradeIcon,
} from '../Shared/Icons';

// Short names of the board's terrains
const TERRAIN_NAMES = {
  forest: 'Bosque',
  hills: 'Colinas',
  pasture: 'Pastos',
  fields: 'Campos',
  mountains: 'Montañas',
};

const TERRAIN_RES = [
  ['forest', 'wood'],
  ['hills', 'brick'],
  ['pasture', 'sheep'],
  ['fields', 'wheat'],
  ['mountains', 'ore'],
];

function Row({ icon: Icon, label, children }) {
  return (
    <li className="flex items-center gap-2.5 min-h-[30px]">
      <span className="hanko !rounded-[5px] w-7 h-7 shrink-0 -rotate-3" aria-hidden="true">
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0 text-[14px] leading-tight text-ink">{label}</span>
      {children}
    </li>
  );
}

export function Points() {
  return (
    <ul className="paper-inset px-3 py-2 space-y-1">
      <Row icon={SettlementIcon} label="Poblado"><b className="text-[14px] text-shu">1 PV</b></Row>
      <Row icon={CityIcon} label="Ciudad"><b className="text-[14px] text-shu">2 PV</b></Row>
      <Row icon={RoadIcon} label="Camino más largo"><b className="text-[14px] text-shu">2 PV</b></Row>
      <Row icon={SwordsIcon} label="Gran ejército"><b className="text-[14px] text-shu">2 PV</b></Row>
      <Row icon={MedalIcon} label="Carta de Punto de victoria"><b className="text-[14px] text-shu">1 PV</b></Row>
    </ul>
  );
}

export function Terrains() {
  return (
    <ul className="paper-inset px-3 py-2 grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-4 gap-y-1">
      {TERRAIN_RES.map(([t, r]) => (
        <li key={t} className="flex items-center gap-2 min-h-[28px] text-[14px] text-ink">
          <ResourceChip type={r} className="w-6 h-6" iconClassName="w-4 h-4" />
          <span className="truncate">
            {TERRAIN_NAMES[t]} <span className="text-ink-faint">→</span> <b>{RESOURCE_NAMES[r]}</b>
          </span>
        </li>
      ))}
      <li className="flex items-center gap-2 min-h-[28px] text-[14px] text-ink-soft">
        <span className="w-6 h-6 rounded-[3px] bg-[#d9b979] shrink-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]" aria-hidden="true" />
        Desierto <span className="text-ink-faint">→</span> nada
      </li>
    </ul>
  );
}

const WAYS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

export function Odds() {
  return (
    <div className="paper-inset px-2 pt-2 pb-1.5" role="img" aria-label="Probabilidad de cada suma: el 7 es la más común, luego 6 y 8; el 2 y el 12 son las más raras">
      <div className="flex items-end justify-between gap-0.5">
        {Object.entries(WAYS).map(([n, ways]) => {
          const hot = n === '6' || n === '8';
          const seven = n === '7';
          return (
            <div key={n} className="flex-1 flex flex-col items-center gap-[3px]">
              {Array.from({ length: ways }, (_, i) => (
                <span
                  key={i}
                  className={`w-[7px] h-[7px] rounded-full ${seven ? 'bg-ink-faint/50' : hot ? 'bg-shu' : 'bg-ink'}`}
                />
              ))}
              <span
                className={`mt-0.5 font-serif font-extrabold text-[13px] leading-none ${seven ? 'text-ink-faint' : hot ? 'text-shu' : 'text-ink'}`}
              >
                {n}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink-faint text-center">Puntos = formas de sacar esa suma con 2 dados</p>
    </div>
  );
}

const COSTS = [
  [RoadIcon, 'Camino', BUILD_COSTS.road, '—'],
  [SettlementIcon, 'Poblado', BUILD_COSTS.settlement, '1 PV'],
  [CityIcon, 'Ciudad', BUILD_COSTS.city, '2 PV'],
  [CardsIcon, 'Carta de desarrollo', BUILD_COSTS.devCard, '?'],
];

export function Costs() {
  return (
    <ul className="paper-inset px-3 py-2 space-y-1.5">
      {COSTS.map(([icon, label, cost, vp]) => (
        <Row key={label} icon={icon} label={label}>
          <ResourceBundle bundle={cost} chipClassName="w-5 h-5" iconClassName="w-3.5 h-3.5" />
          <span className="w-9 text-right text-[12px] font-bold text-ink-faint">{vp}</span>
        </Row>
      ))}
    </ul>
  );
}

export function Trades() {
  return (
    <ul className="paper-inset px-3 py-2 space-y-1">
      <Row icon={TradeIcon} label="Con jugadores">
        <b className="text-[13px] text-ink-soft">lo que acuerden</b>
      </Row>
      <Row icon={CardsIcon} label="Banco">
        <b className="text-[14px] text-shu">4 : 1</b>
      </Row>
      <Row icon={ShipIcon} label="Puerto genérico">
        <b className="text-[14px] text-shu">3 : 1</b>
      </Row>
      <Row icon={ShipIcon} label="Puerto de un recurso">
        <b className="text-[14px] text-shu">2 : 1</b>
      </Row>
    </ul>
  );
}

const DEVS = [
  ['knight', 'Caballero', 'mueve al ladrón y roba 1 carta'],
  ['roadBuilding', 'Construcción de caminos', '2 caminos gratis'],
  ['yearOfPlenty', 'Año de la abundancia', '2 recursos del banco'],
  ['monopoly', 'Monopolio', 'todos te dan un recurso'],
  ['victoryPoint', 'Punto de victoria', '+1 PV oculto'],
];

export function DevList() {
  return (
    <ul className="paper-inset px-3 py-2 space-y-1">
      {DEVS.map(([type, name, what]) => (
        <li key={type} className="flex items-center gap-2.5 min-h-[28px]">
          <span className="hanko !rounded-[5px] w-7 h-7 shrink-0 -rotate-3" aria-hidden="true">
            <DevCardIcon type={type} className="w-4 h-4" />
          </span>
          <span className="min-w-0 text-[13.5px] leading-tight text-ink">
            <b>{name}</b> <span className="text-ink-soft">· {what}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const TIPS = [
  'Busca esquinas con 6 y 8, y con recursos distintos.',
  'Trigo y piedra son la llave de ciudades y cartas.',
  'Un puerto rinde mucho si produces bastante de su recurso.',
  'No guardes más de 7 cartas: un 7 te hará descartar.',
  'Comercia seguido: un buen trato te ayuda a los dos.',
];

export function Tips() {
  return (
    <ol className="paper-inset px-3 py-2 space-y-1.5">
      {TIPS.map((tip, i) => (
        <li key={tip} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink">
          <span className="hanko w-5.5 h-5.5 shrink-0 text-[11px] font-bold mt-px" aria-hidden="true">
            {i + 1}
          </span>
          {tip}
        </li>
      ))}
    </ol>
  );
}
