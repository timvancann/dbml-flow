// src/app/SelectorInput.tsx
import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import {
  autocompletion,
  completionKeymap,
  acceptCompletion,
} from '@codemirror/autocomplete';
import type { CompletionContext } from '@codemirror/autocomplete';
import { useAppStore } from '@/app/store';
import { selectorCompletions } from '@/app/selectorCompletions';
import type { Model } from '@/model/types';

function buildEditor(
  parent: HTMLDivElement,
  model: Model,
  initialValue: string,
  onChange: (val: string) => void,
): EditorView {
  const completionSource = (ctx: CompletionContext) => {
    const text = ctx.state.sliceDoc(0, ctx.pos);
    const r = selectorCompletions(model, text);
    if (!r.options.length) return null;
    return {
      from: r.from,
      options: r.options.map((o) => ({ label: o.label, type: o.type, detail: o.detail })),
    };
  };

  const theme = EditorView.theme({
    '&': {
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: '"Spline Sans Mono", monospace',
      fontSize: '12px',
      flex: '1',
    },
    '.cm-content': {
      padding: '0',
      caretColor: 'var(--ink-2)',
      fontFamily: '"Spline Sans Mono", monospace',
    },
    '.cm-line': { padding: '0' },
    '.cm-focused': { outline: 'none' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: 'var(--ink-2)' },
    '.cm-placeholder': { color: 'var(--ink-3)', fontFamily: '"Spline Sans Mono", monospace' },
    '.cm-tooltip-autocomplete': {
      background: 'var(--bg-2)',
      border: '1px solid var(--line)',
      borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0,0,0,.4)',
    },
    '.cm-tooltip-autocomplete ul': { padding: '4px 0' },
    '.cm-tooltip-autocomplete ul li': {
      padding: '3px 12px',
      fontFamily: '"Spline Sans Mono", monospace',
      fontSize: '12px',
      color: 'var(--ink-2)',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      background: 'rgba(139,156,255,.18)',
      color: 'var(--accent)',
    },
  });

  const singleLineFilter = EditorState.transactionFilter.of((tr) => {
    if (tr.newDoc.lines > 1) return [];
    return tr;
  });

  const enterKeymap = keymap.of([
    {
      key: 'Enter',
      run: (view) => acceptCompletion(view),
    },
  ]);

  const updateListener = EditorView.updateListener.of((u) => {
    if (u.docChanged) {
      onChange(u.state.doc.toString());
    }
  });

  const state = EditorState.create({
    doc: initialValue,
    extensions: [
      theme,
      singleLineFilter,
      enterKeymap,
      keymap.of(completionKeymap),
      autocompletion({ override: [completionSource], activateOnTyping: true }),
      cmPlaceholder('selector — e.g. group:sales f_order+ or path:a>b'),
      updateListener,
    ],
  });

  return new EditorView({ state, parent });
}

export function SelectorInput() {
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);
  const model = useAppStore((s) => s.model);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Build/rebuild editor when model changes
  useEffect(() => {
    if (!containerRef.current || !model) return;

    // Destroy previous editor if any
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const view = buildEditor(containerRef.current, model, selector, setSelector);
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // Two-way sync: when store selector changes externally, update editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== selector) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: selector },
      });
    }
  }, [selector]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        overflow: 'hidden',
      }}
    />
  );
}
