// src/app/AppShell.tsx
import { useAppStore } from '@/app/store';
import { CanvasApp } from '@/canvas/Canvas';
import { SelectionBar } from '@/app/SelectionBar';
import { LeftRail } from '@/app/LeftRail';
import { Inspector } from '@/app/Inspector';
import { focusSelector } from '@/app/focus';

export function AppShell() {
  const model = useAppStore((s) => s.model);
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);
  const setSelectedTable = useAppStore((s) => s.setSelectedTable);

  return (
    <div
      className="h-screen w-screen grid bg-[var(--bg)] text-[var(--ink)]"
      style={{ gridTemplateColumns: '264px 1fr 290px', gridTemplateRows: '52px 1fr' }}
    >
      <header className="col-span-3 flex items-center px-4 border-b border-[var(--line)]" style={{ background: 'linear-gradient(180deg, var(--panel-2), var(--panel))' }} data-slot="selection-bar">
        <SelectionBar />
      </header>
      <aside className="border-r border-[var(--line)] bg-[var(--panel)] overflow-hidden" data-slot="rail"><LeftRail /></aside>
      <main className="min-w-0">
        {model && <CanvasApp model={model} selector={selector} onSelectorChange={setSelector} onTableSelect={setSelectedTable} onTableFocus={(seg) => setSelector(focusSelector(seg))} />}
      </main>
      <aside className="border-l border-[var(--line)] bg-[var(--panel)] overflow-auto" data-slot="inspector"><Inspector /></aside>
    </div>
  );
}
