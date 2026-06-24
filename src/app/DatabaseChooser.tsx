import type { DbEntry } from '@/app/bakedManifest';

interface Props {
  databases: DbEntry[];
  onPick: (entry: DbEntry) => void;
}

export function DatabaseChooser({ databases, onPick }: Props) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg)] text-[var(--ink)]">
      <div className="w-full max-w-md px-6">
        <h1 className="text-lg font-semibold mb-1">Choose a database</h1>
        <p className="text-sm text-[var(--ink-dim)] mb-5">
          This image bundles {databases.length} databases. Pick one to start exploring.
        </p>
        <ul className="flex flex-col gap-2">
          {databases.map((db) => (
            <li key={db.id}>
              <button
                type="button"
                onClick={() => onPick(db)}
                className="w-full text-left px-4 py-3 rounded-md border border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--panel-2)] transition-colors"
              >
                {db.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
