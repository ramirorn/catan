import { memo } from 'react';
import { RESOURCE_NAMES } from '../../utils/constants';
import { ResourceIcon, AnchorIcon } from '../Shared/Icons';

const PORT_TINT = {
  wood: '#2f5a35',
  brick: '#a4482a',
  sheep: '#6f9140',
  wheat: '#c08a22',
  ore: '#56606b',
  generic: '#1f1b17',
};

export const Port = memo(function Port({ port, index, vertices, center = { x: 0, y: 0 } }) {
  if (!port) return null;

  const [vk1, vk2] = port.vertices || [];
  const v1 = vertices ? vertices[vk1] : null;
  const v2 = vertices ? vertices[vk2] : null;

  const isGeneric = port.type === 'generic';
  const label = `${port.ratio}:1`;
  const tint = PORT_TINT[port.type] || PORT_TINT.generic;

  const hasVertexCoords = v1 && v2;

  // Push the badge out to sea, perpendicular to the coastline edge
  let bx = port.x;
  let by = port.y;
  if (hasVertexCoords) {
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if ((port.x - center.x) * nx + (port.y - center.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    bx = port.x + nx * 30;
    by = port.y + ny * 30;
  }


  // Wooden jetty planks from the two harbour corners to the talisman
  const pier = (v) => (
    <g>
      <line x1={v.x} y1={v.y} x2={bx} y2={by} stroke="#2a1a10" strokeWidth="4.6" strokeLinecap="round" />
      <line x1={v.x} y1={v.y} x2={bx} y2={by} stroke="#8a6740" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="2.6 1.2" />
    </g>
  );

  return (
    <g className="port-group" pointerEvents="none">
      {hasVertexCoords && (
        <>
          {pier(v1)}
          {pier(v2)}
        </>
      )}

      {/* Harbour talisman: a paper ofuda with a tinted head band */}
      {/* The talisman takes the pointer (info card); the piers stay inert */}
      <g
        transform={`translate(${bx}, ${by})`}
        pointerEvents="all"
        data-tip={`port:${index}`}
        role="img"
        aria-label={isGeneric ? `Puerto genérico ${label}` : `Puerto de ${RESOURCE_NAMES[port.type] || port.type} ${label}`}
      >
        <rect x="-10" y="-13.5" width="21.5" height="31" rx="1.5" fill="#07090f" opacity="0.45" />
        <rect x="-10.5" y="-15.5" width="21" height="31" rx="1" fill="#f6efdf" stroke="#1f1b17" strokeWidth="1.1" />
        <rect x="-10.5" y="-15.5" width="21" height="5" rx="1" fill={tint} />
        <rect x="-8" y="-8.5" width="16" height="21.5" fill="none" stroke="#b6331f" strokeWidth="0.7" opacity="0.8" />
        <g style={{ color: tint }}>
          {isGeneric ? (
            <AnchorIcon className="" x={-5.5} y={-7.6} width={11} height={11} strokeWidth={2.2} />
          ) : (
            <ResourceIcon type={port.type} className="" x={-6} y={-8} width={12} height={12} />
          )}
        </g>
        <text
          y="8.2"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'Shippori Mincho B1', Georgia, serif"
          fontSize="8.5"
          fontWeight="800"
          fill="#1f1b17"
        >
          {label}
        </text>
      </g>
    </g>
  );
});
