// src/app/QuickJump.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/app/store';
import { matchSegs } from '@/app/selectorCompletions';

export function QuickJump() {
  const model = useAppStore((s) => s.model);
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const segs = useMemo(
    () => (model ? [...new Set([...model.tables.keys()].map((n) => n.split('.').pop()!))].sort() : []),
    [model],
  );
  const results = useMemo(() => matchSegs(segs, query).slice(0, 12), [segs, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        setQuery('');
        setActive(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  if (!open || !model) return null;

  const pick = (seg: string, union: boolean) => {
    setSelector(union && selector.trim() ? `${selector.trim()} ~1${seg}` : `~1${seg}`);
    setOpen(false);
  };

  return (
    <div
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', justifyContent: 'center', paddingTop: '18vh' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, height: 'fit-content', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 24px 60px rgba(0,0,0,.6)', overflow: 'hidden' }}
      >
        <input
          ref={inputRef}
          value={query}
          placeholder="Jump to table (Enter replaces, Shift-Enter adds)"
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            else if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            else if (e.key === 'Enter' && results[active]) pick(results[active], e.shiftKey);
          }}
          style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontFamily: '"Spline Sans Mono", monospace', fontSize: 13, borderBottom: '1px solid var(--line)' }}
        />
        <div>
          {results.map((seg, i) => (
            <div
              key={seg}
              onMouseEnter={() => setActive(i)}
              onClick={(e) => pick(seg, e.shiftKey)}
              style={{
                padding: '6px 14px', cursor: 'pointer', fontFamily: '"Spline Sans Mono", monospace', fontSize: 12,
                color: i === active ? 'var(--accent)' : 'var(--ink-2)',
                background: i === active ? 'rgba(139,156,255,.12)' : 'transparent',
              }}
            >
              {seg}
            </div>
          ))}
          {results.length === 0 && (
            <div style={{ padding: '10px 14px', fontFamily: '"Spline Sans Mono", monospace', fontSize: 12, color: 'var(--ink-3)' }}>No matches</div>
          )}
        </div>
      </div>
    </div>
  );
}
