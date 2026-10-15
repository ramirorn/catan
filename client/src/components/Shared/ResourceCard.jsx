import { RESOURCE_NAMES } from '../../utils/constants';
import { ResourceIcon } from './Icons';
import { RESOURCE_KANJI } from '../../utils/theme';

const SIZES = {
  lg: { card: 'w-[60px] h-[84px]', icon: 'w-8 h-8', name: 'text-[10px] tracking-[0.08em]' },
  md: { card: 'w-[44px] h-[62px] sm:w-[52px] sm:h-[72px]', icon: 'w-6 h-6 sm:w-7 sm:h-7', name: 'text-[8px] sm:text-[9px] tracking-[0.02em] sm:tracking-[0.08em]' },
  sm: { card: 'w-[38px] h-[52px]', icon: 'w-5 h-5', name: 'text-[8px] tracking-[0.02em]' },
  // Hand in the HUD: sized by CSS (index.css) so it can shrink to fit any phone
  hand: { card: 'res-card-hand', icon: 'w-[clamp(18px,6vw,28px)] h-[clamp(18px,6vw,28px)]', name: 'text-[clamp(7.5px,2.2vw,9px)] tracking-[0.02em] sm:tracking-[0.08em]' },
};

/**
 * Illustrated playing card for a resource. Purely presentational.
 */
export function ResourceCard({ type, count, size = 'md', showName = true, className = '' }) {
  const s = SIZES[size] || SIZES.md;
  const isEmpty = count !== undefined && count <= 0;

  return (
    <div
      className={`res-card ${s.card} ${isEmpty ? 'is-empty' : ''} ${className}`}
      title={count !== undefined ? `${RESOURCE_NAMES[type]}: ${count}` : RESOURCE_NAMES[type]}
    >
      <div className={`res-card-art res-bg-${type}`}>
        {size !== 'sm' && <span className="res-kanji" aria-hidden="true">{RESOURCE_KANJI[type]}</span>}
        <ResourceIcon type={type} className={`res-card-icon ${s.icon} relative drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]`} />
      </div>
      {showName && (
        <div
          className={`res-card-name ${s.name} pt-[3px] pb-[1px] text-center font-bold uppercase text-ink leading-none overflow-hidden whitespace-nowrap`}
        >
          {RESOURCE_NAMES[type]}
        </div>
      )}
      {count !== undefined && !isEmpty && (
        <span className="hanko absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 font-serif font-extrabold text-[13px] leading-none">
          {count}
        </span>
      )}
    </div>
  );
}

/**
 * Compact inline token: small coloured tile with a resource glyph.
 */
export function ResourceChip({ type, className = 'w-5 h-5', iconClassName = 'w-3.5 h-3.5' }) {
  return (
    <span
      className={`res-bg-${type} inline-flex items-center justify-center rounded-[3px] text-paper-light shrink-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)] ${className}`}
      title={RESOURCE_NAMES[type]}
    >
      <ResourceIcon type={type} className={iconClassName} />
    </span>
  );
}

/**
 * Renders a cost / bundle as a row of chips: { wood: 1, brick: 1 } → ▣ ▣
 */
export function ResourceBundle({ bundle, chipClassName = 'w-3.5 h-3.5', iconClassName = 'w-2.5 h-2.5', className = '' }) {
  const items = [];
  Object.entries(bundle || {}).forEach(([type, n]) => {
    for (let i = 0; i < n; i++) items.push(`${type}-${i}`);
  });
  return (
    <span className={`inline-flex items-center gap-[2px] ${className}`}>
      {items.map((k) => (
        <ResourceChip key={k} type={k.split('-')[0]} className={chipClassName} iconClassName={iconClassName} />
      ))}
    </span>
  );
}
