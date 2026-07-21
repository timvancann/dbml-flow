import React, { useRef } from 'react';
import { useAppStore } from '@/app/store';
import { parseDbtManifest } from '@/model/parseDbtManifest';

function looksLikeDbtManifest(v: unknown): v is { nodes: unknown; parent_map: unknown } {
  return !!v && typeof v === 'object' && 'nodes' in v && 'parent_map' in v;
}

// Pure ordering: at most one .dbml/.txt file (loaded first), followed by any
// number of .json manifests (loaded against the freshly loaded model).
export function orderSelectedFiles(files: File[]): {
  dbmlFile: File | null;
  jsonFiles: File[];
  error: string | null;
} {
  const dbmlFiles = files.filter((f) => /\.(dbml|txt)$/i.test(f.name));
  const jsonFiles = files.filter((f) => /\.json$/i.test(f.name));
  if (dbmlFiles.length > 1) {
    return { dbmlFile: null, jsonFiles: [], error: 'Select at most one .dbml file' };
  }
  return { dbmlFile: dbmlFiles[0] ?? null, jsonFiles, error: null };
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
    const { edges, external, matchedTables } = parseDbtManifest(json, model);
    if (matchedTables.size === 0) {
      setLoadError('dbt manifest matched no tables in the current model');
      return;
    }
    setLoadError(null);
    setLineage({ edges, external });
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Reset so the same file(s) can be re-picked
    e.target.value = '';
    if (files.length === 0) return;

    const { dbmlFile, jsonFiles, error } = orderSelectedFiles(files);
    if (error) {
      setLoadError(error);
      return;
    }
    if (dbmlFile) loadDbmlSafe(await dbmlFile.text());
    for (const jsonFile of jsonFiles) {
      handleDbtManifest(await jsonFile.text());
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".dbml,.txt,.json"
        multiple
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
