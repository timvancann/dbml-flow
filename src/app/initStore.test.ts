import { readFileSync } from 'node:fs';
import { useAppStore } from '@/app/store';
import { initStore } from '@/app/initStore';

const dbml = readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8');

beforeEach(() => {
  useAppStore.setState({ model: null, selector: '', selectedTable: null });
});

describe('initStore', () => {
  it('applies URL selector AFTER loadDbml so it is not wiped (regression)', () => {
    initStore('?s=group:sales', dbml);
    const state = useAppStore.getState();
    expect(state.selector).toBe('group:sales');
    expect(state.model).not.toBeNull();
  });

  it('leaves selector empty when no ?s= param', () => {
    initStore('', dbml);
    const state = useAppStore.getState();
    expect(state.selector).toBe('');
    expect(state.model).not.toBeNull();
  });
});
