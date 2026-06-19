import { useAppStore } from '@/app/store';
import { focusSelector, parseFocus } from '@/app/focus';

export function HopStepper() {
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);

  const focus = parseFocus(selector);
  if (!focus) return null;

  const { table, hops } = focus;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: '"Spline Sans Mono", monospace',
        fontSize: 11,
        color: 'var(--ink-2)',
        background: 'rgba(13,16,24,.7)',
        border: '1px solid var(--line)',
        padding: '5px 9px',
        borderRadius: 7,
        backdropFilter: 'blur(6px)',
      }}
    >
      <button
        onClick={() => setSelector(focusSelector(table, Math.max(1, hops - 1)))}
        style={{
          width: 18,
          height: 18,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 4,
          border: '1px solid var(--line)',
          background: 'transparent',
          color: 'var(--ink-2)',
          cursor: 'pointer',
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        −
      </button>
      <span style={{ minWidth: 48, textAlign: 'center', color: 'var(--dim)' }}>
        {hops} hop{hops !== 1 ? 's' : ''}
      </span>
      <button
        onClick={() => setSelector(focusSelector(table, hops + 1))}
        style={{
          width: 18,
          height: 18,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 4,
          border: '1px solid var(--line)',
          background: 'transparent',
          color: 'var(--ink-2)',
          cursor: 'pointer',
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        +
      </button>
    </div>
  );
}
