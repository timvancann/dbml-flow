import { create } from 'zustand';
import { loadModel } from '@/model/loadModel';
import type { Model } from '@/model/types';

export interface SavedMart {
  name: string;
  selector: string;
}

export interface AppState {
  model: Model | null;
  selector: string;
  selectedTable: string | null;
  savedMarts: SavedMart[];
  pathMode: boolean;
  pathStart: string | null;
  loadError: string | null;
  setSelector: (s: string) => void;
  setSelectedTable: (t: string | null) => void;
  setModel: (m: Model) => void;
  loadDbml: (content: string) => void;
  loadDbmlSafe: (content: string) => void;
  saveMart: (name: string) => void;
  removeMart: (name: string) => void;
  setSavedMarts: (m: SavedMart[]) => void;
  setPathMode: (on: boolean) => void;
  pickPathTable: (name: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  model: null,
  selector: '',
  selectedTable: null,
  savedMarts: [],
  pathMode: false,
  pathStart: null,
  loadError: null,
  setSelector: (selector) => set({ selector }),
  setSelectedTable: (selectedTable) => set({ selectedTable }),
  setModel: (model) => set({ model }),
  loadDbml: (content) => set({ model: loadModel(content), selector: '', selectedTable: null, pathMode: false, pathStart: null }),
  loadDbmlSafe: (content) => {
    try {
      const model = loadModel(content);
      set({ model, selector: '', selectedTable: null, loadError: null, pathMode: false, pathStart: null });
    } catch (error: any) {
      set({ loadError: error?.message ?? String(error) });
    }
  },
  saveMart: (name) =>
    set((state) => {
      const selector = state.selector;
      const others = state.savedMarts.filter((m) => m.name !== name);
      return { savedMarts: [...others, { name, selector }] };
    }),
  removeMart: (name) =>
    set((state) => ({ savedMarts: state.savedMarts.filter((m) => m.name !== name) })),
  setSavedMarts: (savedMarts) => set({ savedMarts }),
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
