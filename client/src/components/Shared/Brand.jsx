import { LeafSwirlIcon } from './Icons';

/** Forehead-protector style plate with our leaf-swirl crest engraved on it */
export function BrandPlate({ className = '' }) {
  return (
    <span className={`steel-plate relative inline-flex items-center justify-center rounded-[3px] ${className}`} aria-hidden="true">
      <span className="absolute left-[3px] top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-[#59626c]" />
      <span className="absolute right-[3px] top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-[#59626c]" />
      <LeafSwirlIcon className="w-[62%] h-[80%] text-[#2c333b]" strokeWidth={2} />
    </span>
  );
}
