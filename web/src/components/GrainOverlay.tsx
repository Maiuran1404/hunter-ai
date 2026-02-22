'use client';

export default function GrainOverlay() {
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 'inherit', mixBlendMode: 'overlay', opacity: 0.055 }}>
      <filter id="hunterGrain">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#hunterGrain)" />
    </svg>
  );
}
