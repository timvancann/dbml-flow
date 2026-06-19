import React, { useRef } from 'react';
import { useAppStore } from '@/app/store';

export function LoadButton() {
  const loadDbmlSafe = useAppStore((s) => s.loadDbmlSafe);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === 'string') loadDbmlSafe(text);
    };
    reader.readAsText(file);
    // Reset so the same file can be re-picked
    e.target.value = '';
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".dbml,.txt"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <button
        onClick={handleClick}
        title="Upload a .dbml file to view"
        style={{
          fontFamily: '"Spline Sans Mono", monospace',
          fontSize: 12,
          color: 'var(--ink-2)',
          background: 'var(--panel-2)',
          border: '1px solid var(--line-2)',
          padding: '0 10px',
          height: 28,
          borderRadius: 8,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Load .dbml
      </button>
    </>
  );
}
