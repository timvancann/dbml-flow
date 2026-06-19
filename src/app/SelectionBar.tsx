// src/app/SelectionBar.tsx
import { useAppStore } from '@/app/store';
import { LoadButton } from '@/app/LoadButton';
import { SelectorInput } from '@/app/SelectorInput';
import { HelpModal } from '@/app/HelpModal';

export function SelectionBar() {
  const pathMode = useAppStore((s) => s.pathMode);
  const setPathMode = useAppStore((s) => s.setPathMode);
  const loadError = useAppStore((s) => s.loadError);

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Wordmark */}
      <div className="flex items-baseline gap-2 pr-3.5 border-r border-[var(--line)]">
        <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 22, letterSpacing: '.3px', color: 'var(--ink)' }}>
          dbml&thinsp;<em style={{ color: 'var(--dim)', fontStyle: 'italic' }}>flow</em>
        </span>
        <span style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>viewer</span>
      </div>

      {/* Selector area */}
      <div className="flex-1 flex items-center h-8 px-2.5 rounded-[9px] border border-[var(--line)] bg-[var(--bg-2)]">
        <SelectorInput />
      </div>

      {/* Find path toggle */}
      <button
        onClick={() => setPathMode(!pathMode)}
        title="Pick two tables to render the shortest ref path"
        style={{
          fontFamily: '"Spline Sans Mono", monospace',
          fontSize: 12,
          color: pathMode ? 'var(--accent)' : 'var(--ink-2)',
          background: pathMode ? 'rgba(139,156,255,.12)' : 'var(--panel-2)',
          border: pathMode ? '1px solid rgba(139,156,255,.5)' : '1px solid var(--line-2)',
          padding: '0 10px',
          height: 28,
          borderRadius: 8,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Find path
      </button>

      {/* Help modal */}
      <HelpModal />

      {/* Load button */}
      <LoadButton />

      {/* Load error */}
      {loadError && (
        <span
          style={{
            fontFamily: '"Spline Sans Mono", monospace',
            fontSize: 11,
            color: '#f87171',
            background: 'rgba(248,113,113,.1)',
            border: '1px solid rgba(248,113,113,.3)',
            borderRadius: 6,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            maxWidth: 260,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={loadError}
        >
          Parse error: {loadError}
        </span>
      )}
    </div>
  );
}
