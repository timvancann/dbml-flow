import { useEffect } from 'react';
import { useAppStore } from '@/app/store';
import { searchWith } from '@/app/persistence';

// Keep the URL in sync with the active database, selector and view mode. The initial
// values are read from the URL by bootstrap(); this hook only writes back.
export function usePersistence(): void {
  useEffect(() => {
    let prevSelector = useAppStore.getState().selector;
    let prevDb = useAppStore.getState().activeDb;
    let prevView = useAppStore.getState().viewMode;
    const unsub = useAppStore.subscribe((state) => {
      if (state.selector !== prevSelector || state.activeDb !== prevDb || state.viewMode !== prevView) {
        prevSelector = state.selector;
        prevDb = state.activeDb;
        prevView = state.viewMode;
        const search = searchWith({ db: state.activeDb, selector: state.selector, view: state.viewMode });
        window.history.replaceState(null, '', `${window.location.pathname}${search}`);
      }
    });
    return unsub;
  }, []);
}
