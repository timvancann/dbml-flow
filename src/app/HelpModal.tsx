// src/app/HelpModal.tsx
import { useEffect, useRef, useState } from 'react';

const MONO = '"Spline Sans Mono", monospace';

const SYNTAX_ROWS = [
  { syntax: 'a b', desc: 'Union — include tables matching a OR b' },
  { syntax: 'a,b', desc: 'Intersection — include tables matching both a AND b' },
  { syntax: '!x  /  --exclude x', desc: 'Exclude tables matching x from the result' },
  { syntax: '~a  /  ~2a', desc: 'Undirected 1-hop (or N-hop) neighbors of a' },
  { syntax: '+a  /  a+', desc: 'Toward-facts (inbound) / toward-dims (outbound) from a' },
  { syntax: '2+a  /  a+2', desc: 'N hops toward-facts / toward-dims from a' },
  { syntax: 'group:sales  /  g:sales_*', desc: 'Select by group name or group glob' },
  { syntax: '*order*', desc: 'Table name glob (wildcard match)' },
  { syntax: 'path:a>b', desc: 'Shortest FK reference path between a and b' },
];

const EXAMPLES = [
  { expr: 'group:sales', label: 'All tables in the sales group' },
  { expr: 'f_order+', label: 'f_order and its outbound (dim) neighbors' },
  { expr: '~2d_customer', label: '2-hop undirected neighbors of d_customer' },
  { expr: 'path:f_order>d_warehouse', label: 'Shortest FK path from f_order to d_warehouse' },
];

export function HelpModal() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* "?" button */}
      <button
        onClick={() => setOpen(true)}
        title="Selector syntax help"
        aria-label="Open selector syntax help"
        style={{
          fontFamily: MONO,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink-2)',
          background: 'var(--panel-2)',
          border: '1px solid var(--line-2)',
          width: 28,
          height: 28,
          borderRadius: 8,
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ?
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          {/* Panel */}
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Selector syntax help"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              padding: '28px 32px',
              maxWidth: 680,
              width: '92vw',
              maxHeight: '85vh',
              overflowY: 'auto',
              outline: 'none',
              boxShadow: '0 24px 64px rgba(0,0,0,.5)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, color: 'var(--ink)' }}>
                Selector Syntax
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close help"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-3)',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: '2px 6px',
                }}
              >
                ×
              </button>
            </div>

            {/* Syntax table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--ink-3)', paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>Syntax</th>
                  <th style={{ textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--ink-3)', paddingBottom: 8, borderBottom: '1px solid var(--line)', paddingLeft: 20 }}>Meaning</th>
                </tr>
              </thead>
              <tbody>
                {SYNTAX_ROWS.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line-2)' }}>
                    <td style={{ fontFamily: MONO, fontSize: 12, color: 'var(--accent)', padding: '7px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      {row.syntax}
                    </td>
                    <td style={{ fontFamily: 'inherit', fontSize: 13, color: 'var(--ink-2)', paddingLeft: 20, verticalAlign: 'top', padding: '7px 0 7px 20px' }}>
                      {row.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Exploring section */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Exploring</div>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li style={{ fontSize: 13, color: 'var(--ink-2)' }}>Click a table to focus it and its neighbors; use the hop stepper to widen.</li>
                <li style={{ fontSize: 13, color: 'var(--ink-2)' }}>Click <span style={{ fontFamily: MONO, color: 'var(--accent)' }}>Find path</span>, then two tables, to highlight the shortest reference path.</li>
                <li style={{ fontSize: 13, color: 'var(--ink-2)' }}>Type in the selector bar for autocomplete.</li>
              </ul>
            </div>

            {/* Examples section */}
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Examples</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {EXAMPLES.map((ex, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--accent)', minWidth: 200 }}>{ex.expr}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{ex.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
