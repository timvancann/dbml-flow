// src/app/AppShell.tsx
import { useAppStore } from '@/app/store';
import { CanvasApp } from '@/canvas/Canvas';
import { SelectionBar } from '@/app/SelectionBar';
import { LeftRail } from '@/app/LeftRail';
import { Inspector } from '@/app/Inspector';
import { DatabaseChooser } from '@/app/DatabaseChooser';
import { focusSelector } from '@/app/focus';
import { loadDatabase } from '@/app/bootstrap';
import { QuickJump } from '@/app/QuickJump';

export function AppShell() {
  const model = useAppStore((s) => s.model);
  const selector = useAppStore((s) => s.selector);
  const setSelector = useAppStore((s) => s.setSelector);
  const setSelectedTable = useAppStore((s) => s.setSelectedTable);
  const databases = useAppStore((s) => s.databases);
  const activeDb = useAppStore((s) => s.activeDb);
  const setActiveDatabase = useAppStore((s) => s.setActiveDatabase);

  const multiDb = !!databases && databases.length > 1;
  if (multiDb && activeDb === null) {
    return <DatabaseChooser databases={databases!} onPick={(e) => void loadDatabase(e)} />;
  }
  const activeLabel = databases?.find((d) => d.id === activeDb)?.label;

  return (
    <div
      className="h-screen w-screen grid bg-[var(--bg)] text-[var(--ink)]"
      style={{ gridTemplateColumns: '264px 1fr 290px', gridTemplateRows: '52px 1fr' }}
    >
      <header className="col-span-3 flex items-center gap-3 px-4 border-b border-[var(--line)]" style={{ background: 'linear-gradient(180deg, var(--panel-2), var(--panel))' }} data-slot="selection-bar">
        <SelectionBar />
        {multiDb && activeLabel && (
          <button
            type="button"
            onClick={() => setActiveDatabase(null)}
            title="Switch database"
            className="shrink-0 ml-auto text-xs px-2.5 py-1 rounded-md border border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--panel-2)] transition-colors"
            data-slot="db-switcher"
          >
            {activeLabel} ▾
          </button>
        )}
      </header>
      <aside className="border-r border-[var(--line)] bg-[var(--panel)] overflow-hidden" data-slot="rail"><LeftRail /></aside>
      <main className="min-w-0">
        {model && <CanvasApp model={model} selector={selector} onSelectorChange={setSelector} onTableSelect={setSelectedTable} onTableFocus={(seg) => setSelector(focusSelector(seg))} />}
        <QuickJump />
      </main>
      <aside className="border-l border-[var(--line)] bg-[var(--panel)] overflow-auto" data-slot="inspector"><Inspector /></aside>
    </div>
  );
}
