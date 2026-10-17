import { boardTheme } from '../../utils/cosmetics';

/** Small round sample of a board theme palette (sea, paper, rule, land) */
export function ThemeSwatch({ themeId, size = 18, className = '' }) {
  const [a, b, c, d] = boardTheme(themeId).swatch;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border border-ink/60 ${className}`}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${a} 0 40%, ${d} 40% 62%, ${c} 62% 72%, ${b} 72% 100%)`,
      }}
    />
  );
}
