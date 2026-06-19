import { useEffect } from 'react';
import { useAppStore } from '@/app/store';
import { searchWithSelector, selectorFromSearch } from '@/app/persistence';

export function usePersistence(): void {
  useEffect(() => {
    const initialSelector = selectorFromSearch(window.location.search);
    if (initialSelector) useAppStore.getState().setSelector(initialSelector);

    let prevSelector = useAppStore.getState().selector;
    const unsub = useAppStore.subscribe((state) => {
      if (state.selector !== prevSelector) {
        prevSelector = state.selector;
        const search = searchWithSelector(state.selector);
        window.history.replaceState(null, '', `${window.location.pathname}${search}`);
      }
    });
    return unsub;
  }, []);
}
