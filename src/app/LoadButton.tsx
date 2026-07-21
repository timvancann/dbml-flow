import React, { useRef } from 'react';
import { useAppStore } from '@/app/store';
import { parseDbtManifest } from '@/model/parseDbtManifest';

function looksLikeDbtManifest(v: unknown): v is { nodes: unknown; parent_map: unknown } {
  return !!v && typeof v === 'object' && 'nodes' in v && 'parent_map' in v;
}

export function LoadButton() {
  const loadDbmlSafe = useAppStore((s) => s.loadDbmlSafe);
  const setLineage = useAppStore((s) => s.setLineage);
  const setLoadError = useAppStore((s) => s.setLoadError);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    inputRef.current?.click();
  }

  function handleDbtManifest(text: string) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      setLoadError('Invalid JSON file');
      return;
    }
    if (!looksLikeDbtManifest(json)) {
      setLoadError('Not a recognized dbt manifest (expected "nodes" and "parent_map")');
      return;
    }
    const model = useAppStore.getState().model;
    if (!model) {
      setLoadError('Load a database before uploading a dbt manifest');
      return;
    }
    const { edges, matchedTables } = parseDbtManifest(json, model);
    if (matchedTables.size === 0) {
      setLoadError('dbt manifest matched no tables in the current model');
      return;
    }
    setLoadError(null);
    setLineage(edges);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isJson = file.name.toLowerCase().endsWith('.json');
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== 'string') return;
      if (isJson) handleDbtManifest(text);
      else loadDbmlSafe(text);
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
        accept=".dbml,.txt,.json"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <button
        onClick={handleClick}
        title="Upload a .dbml file, or a dbt manifest.json for the lineage overlay"
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
