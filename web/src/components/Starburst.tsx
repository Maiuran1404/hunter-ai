'use client';

import { useMemo } from 'react';

const C = { bg: '#1a1a1e' };

export default function Starburst({ size = 160 }: { size?: number }) {
  const center = size / 2;
  const innerR = size * 0.065;
  const baseR = size * 0.17;
  const maxR = size * 0.44;

  const lines = useMemo(() => {
    const result: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
    const count = 220;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const pr = ((i * 7919 + 17) % 97) / 97;
      const variation =
        Math.abs(Math.sin(angle * 7)) * 0.28 +
        Math.abs(Math.sin(angle * 13 + 0.7)) * 0.22 +
        Math.abs(Math.sin(angle * 3 + 1.5)) * 0.25 +
        pr * 0.25;
      const clamped = Math.min(variation, 1);
      const outerR = baseR + (maxR - baseR) * clamped;
      const opacity = 0.15 + clamped * 0.85;
      result.push({
        x1: center + Math.cos(angle) * innerR,
        y1: center + Math.sin(angle) * innerR,
        x2: center + Math.cos(angle) * outerR,
        y2: center + Math.sin(angle) * outerR,
        opacity,
      });
    }
    return result;
  }, [size, center, innerR, baseR, maxR]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      <defs>
        <radialGradient id="hBurstGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.10" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={center} cy={center} r={maxR * 0.85} fill="url(#hBurstGlow)" />
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#fff" strokeWidth="0.65" opacity={l.opacity} />
      ))}
      <circle cx={center} cy={center} r={innerR + 2} fill={C.bg} />
      <circle cx={center} cy={center} r={innerR} fill="#111114" />
    </svg>
  );
}
