// src/app/SelectionBar.tsx
import React, { useState } from 'react';
import { useAppStore } from '@/app/store';
import { classifyTable } from '@/canvas/classifyTable';
import { removeTokenAt } from '@/app/selectorTokens';
import { LoadButton } from '@/app/LoadButton';

/** Determine chip color kind from a raw selector token */
function chipStyle(token: string): React.CSSProperties {
  if (token.startsWith('group:') || token.startsWith('g:')) {
    return { color: 'var(--dim)', background: 'var(--dim-dim)', border: '1px solid rgba(95,211,196,.3)' };
  }
  if (token.startsWith('path:')) {
    return { color: 'var(--accent)', background: 'rgba(139,156,255,.12)', border: '1px solid rgba(139,156,255,.3)', fontFamily: '"Spline Sans Mono", monospace' };
  }
  // strip leading !~+digits and trailing +digits to get bare table name
  const bare = token.replace(/^[!~+0-9]+/, '').replace(/\+\d*$/, '');
  const kind = classifyTable('x.' + bare);
  if (kind === 'fact') {
    return { color: 'var(--fact)', background: 'var(--fact-dim)', border: '1px solid rgba(240,168,104,.3)' };
  }
  // exclude tokens or neutral
  if (token.startsWith('!')) {
    return { color: 'var(--ink-3)', background: 'transparent', border: '1px solid var(--line-2)', opacity: 0.7 };
  }
  return { color: 'var(--ink-2)', background: 'transparent', border: '1px solid var(--line-2)' };
}

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 22,
  padding: '0 8px 0 7px',
  borderRadius: 6,
  fontSize: 12.5,
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

export function SelectionBar() {
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);
  const saveMart = useAppStore((s) => s.saveMart);
  const pathMode = useAppStore((s) => s.pathMode);
  const setPathMode = useAppStore((s) => s.setPathMode);
  const loadError = useAppStore((s) => s.loadError);
  const [editing, setEditing] = useState(false);

  const tokens = selector.trim() ? selector.trim().split(/\s+/) : [];
  const removeToken = (i: number) => setSelector(removeTokenAt(selector, i));

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
      <div className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-[9px] border border-[var(--line)] bg-[var(--bg-2)]">
        {editing ? (
          <input
            autoFocus
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            onBlur={() => setEditing(false)}
            placeholder="selector — e.g. group:sales f_order+"
            style={{ fontFamily: '"Spline Sans Mono", monospace', fontSize: 12, color: 'var(--ink-2)', background: 'transparent', outline: 'none', flex: 1, minWidth: 160 }}
          />
        ) : (
          <>
            {tokens.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: '"Spline Sans Mono", monospace' }}>
                selector — e.g. group:sales f_order+
              </span>
            )}
            {tokens.map((token, i) => (
              <span key={i} style={{ ...chipBase, ...chipStyle(token) }}>
                {token}
                <button
                  onClick={() => removeToken(i)}
                  style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  aria-label={`Remove ${token}`}
                >
                  ×
                </button>
              </span>
            ))}
          </>
        )}
        {/* Edit toggle */}
        <button
          onClick={() => setEditing((e) => !e)}
          title={editing ? 'Back to chips' : 'Edit raw DSL'}
          style={{
            marginLeft: 'auto',
            fontFamily: '"Spline Sans Mono", monospace',
            fontSize: 11,
            color: editing ? 'var(--accent)' : 'var(--ink-3)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 2px',
            flexShrink: 0,
          }}
        >
          {'{}'}
        </button>
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

      {/* Load button */}
      <LoadButton />

      {/* Save button */}
      <button
        className="text-[12.5px] text-[var(--ink-2)] border border-[var(--line-2)] bg-[var(--panel-2)] px-2.5 py-1.5 rounded-lg"
        onClick={() => {
          const name = window.prompt('Save current selection as data mart:');
          if (name) saveMart(name);
        }}
      >
        ＋ Save data mart
      </button>

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
