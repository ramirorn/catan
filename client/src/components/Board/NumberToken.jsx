import { getDiceDots } from '../../utils/hexMath';

// Chakra seal: a washi disc ringed with sealing-formula ticks.
// The hot numbers (6 and 8) are inked in vermilion with a solid ring.
export function NumberToken({ number, x, y }) {
  if (!number) return null;

  const isHot = number === 6 || number === 8;
  const pipCount = getDiceDots(number).length;
  const ink = isHot ? '#b6331f' : '#1f1b17';
  const pipGap = 3.6;
  const pipStart = -((pipCount - 1) * pipGap) / 2;

  return (
    <g transform={`translate(${x}, ${y})`} className="number-token">
      {/* Manual drop shadow (SVG filters re-rasterise on every zoom frame) */}
      <circle cx={0.6} cy={1.8} r={20.2} fill="#07090f" opacity="0.45" />
      <circle r={19.5} fill="#f4ecda" />
      <circle r={19.5} fill="none" stroke="#1f1b17" strokeWidth="1.3" />
      <circle
        r={16.4}
        fill="none"
        stroke="#b6331f"
        strokeWidth={isHot ? 1.6 : 1.1}
        strokeDasharray={isHot ? undefined : '1.4 2.4'}
        opacity={isHot ? 0.9 : 0.75}
      />

      <text
        y={-1.8}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Shippori Mincho B1', Georgia, serif"
        fontWeight={800}
        fontSize={isHot ? 18 : 16}
        fill={ink}
      >
        {number}
      </text>

      {/* Probability pips */}
      <g fill={ink}>
        {Array.from({ length: pipCount }, (_, i) => (
          <circle key={i} cx={pipStart + i * pipGap} cy={10} r={1.15} />
        ))}
      </g>
    </g>
  );
}
