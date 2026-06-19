import { create } from 'zustand';
import { loadModel } from '@/model/loadModel';
import type { Model } from '@/model/types';

export interface AppState {
  model: Model | null;
  selector: string;
  selectedTable: string | null;
  pathMode: boolean;
  pathStart: string | null;
  loadError: string | null;
  setSelector: (s: string) => void;
  setSelectedTable: (t: string | null) => void;
  setModel: (m: Model) => void;
  loadDbml: (content: string) => void;
  loadDbmlSafe: (content: string) => void;
  setPathMode: (on: boolean) => void;
  pickPathTable: (name: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  model: null,
  selector: '',
  selectedTable: null,
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
