import { useRef, useEffect } from 'react';

export function RenderTracker({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const countRef = useRef(0);
  const elRef = useRef<HTMLDivElement>(null);
  countRef.current++;

  useEffect(() => {
    const el = elRef.current;
    if (!el || countRef.current <= 1) return;
    el.style.outline = '2px solid #4ade80';
    el.style.outlineOffset = '-2px';
    const t = setTimeout(() => {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }, 400);
    return () => clearTimeout(t);
  });

  return (
    <div ref={elRef} style={{ transition: 'outline 0.2s' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
        <span
          style={{
            fontSize: 11,
            color: '#888',
            fontFamily: 'monospace',
          }}
        >
          renders: {countRef.current}
        </span>
      </div>
      {children}
    </div>
  );
}
