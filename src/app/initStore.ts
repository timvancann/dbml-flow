import { selectorFromSearch, viewFromSearch } from '@/app/persistence';
import { useAppStore } from '@/app/store';

// Loads the default model (if none) and applies any URL selector. The URL selector
// must be read BEFORE loadDbml, because loadDbml resets the selector (which, via the
// persistence subscription, strips ?s= from the URL).
export function initStore(search: string, rawDbml: string): void {
  const urlSelector = selectorFromSearch(search);
  const urlView = viewFromSearch(search);
  const store = useAppStore.getState();
  if (!store.model) store.loadDbml(rawDbml);
  if (urlSelector) store.setSelector(urlSelector);
  if (urlView) store.setViewMode(urlView);
}
