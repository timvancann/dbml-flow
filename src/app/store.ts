import { create } from 'zustand';
import { loadModel } from '@/model/loadModel';
import type { Model } from '@/model/types';
import type { DbEntry } from '@/app/bakedManifest';
import type { ViewMode } from '@/app/persistence';

export interface AppState {
  model: Model | null;
  selector: string;
  selectedTable: string | null;
  pathMode: boolean;
  pathStart: string | null;
  loadError: string | null;
  databases: DbEntry[] | null;
  activeDb: string | null;
  viewMode: ViewMode;
  setSelector: (s: string) => void;
  setSelectedTable: (t: string | null) => void;
  setModel: (m: Model) => void;
  loadDbml: (content: string) => void;
  loadDbmlSafe: (content: string) => void;
  setPathMode: (on: boolean) => void;
  pickPathTable: (name: string) => void;
  setDatabases: (dbs: DbEntry[]) => void;
  setActiveDatabase: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setLoadError: (err: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  model: null,
  selector: '',
  selectedTable: null,
  pathMode: false,
  pathStart: null,
  loadError: null,
  databases: null,
  activeDb: null,
  viewMode: 'refs',
  setSelector: (selector) => set({ selector }),
  setSelectedTable: (selectedTable) => set({ selectedTable }),
  setModel: (model) => set({ model }),
  loadDbml: (content) => {
    const model = loadModel(content);
    set({
      model,
      selector: '',
      selectedTable: null,
      pathMode: false,
      pathStart: null,
      viewMode: model.lineage.length > 0 ? 'lineage' : 'refs',
    });
  },
  loadDbmlSafe: (content) => {
    try {
      const model = loadModel(content);
      set({
        model,
        selector: '',
        selectedTable: null,
        loadError: null,
        pathMode: false,
        pathStart: null,
        viewMode: model.lineage.length > 0 ? 'lineage' : 'refs',
      });
    } catch (error: any) {
      set({ loadError: error?.message ?? String(error) });
    }
  },
  setDatabases: (databases) => set({ databases }),
  setActiveDatabase: (activeDb) => set({ activeDb }),
  setViewMode: (viewMode) => set({ viewMode }),
  setLoadError: (loadError) => set({ loadError }),
  setPathMode: (on) => set({ pathMode: on, pathStart: on ? get().pathStart : null }),
  pickPathTable: (name) => {
    const { pathStart } = get();
    if (!pathStart) {
      set({ pathStart: name });
    } else {
      const seg = (n: string) => n.split('.').pop() ?? n;
      set({ selector: `path:${seg(pathStart)}>${seg(name)}`, pathStart: null, pathMode: false });
    }
  },
}));
