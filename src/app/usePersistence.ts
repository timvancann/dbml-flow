import { useEffect } from 'react';
import { useAppStore } from '@/app/store';
import { loadMarts, saveMarts, searchWithSelector, selectorFromSearch } from '@/app/persistence';

export function usePersistence(): void {
  useEffect(() => {
    const initialSelector = selectorFromSearch(window.location.search);
    if (initialSelector) useAppStore.getState().setSelector(initialSelector);
    useAppStore.getState().setSavedMarts(loadMarts(window.localStorage));

    let prevSelector = useAppStore.getState().selector;
    let prevMarts = useAppStore.getState().savedMarts;
    const unsub = useAppStore.subscribe((state) => {
      if (state.selector !== prevSelector) {
        prevSelector = state.selector;
        const search = searchWithSelector(state.selector);
        window.history.replaceState(null, '', `${window.location.pathname}${search}`);
      }
      if (state.savedMarts !== prevMarts) {
        prevMarts = state.savedMarts;
        saveMarts(window.localStorage, state.savedMarts);
      }
    });
    return unsub;
  }, []);
}
