import { readFileSync } from 'node:fs';
import { useAppStore } from '@/app/store';

const dbml = readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8');

beforeEach(() => {
  useAppStore.setState({ model: null, selector: '', selectedTable: null, pathMode: false, pathStart: null, loadError: null, databases: null, activeDb: null });
});

describe('useAppStore', () => {
  it('loads a model from DBML and indexes it', () => {
    useAppStore.getState().loadDbml(dbml);
    expect(useAppStore.getState().model?.tables.size).toBe(8);
  });

  it('loadDbml resets selector and selectedTable', () => {
    useAppStore.setState({ selector: 'x', selectedTable: 'y' });
    useAppStore.getState().loadDbml(dbml);
    expect(useAppStore.getState().selector).toBe('');
    expect(useAppStore.getState().selectedTable).toBeNull();
  });

  it('sets the selector', () => {
    useAppStore.getState().setSelector('group:sales');
    expect(useAppStore.getState().selector).toBe('group:sales');
  });

  it('loadDbmlSafe sets model and clears loadError on valid content', () => {
    useAppStore.getState().loadDbmlSafe(dbml);
    expect(useAppStore.getState().model?.tables.size).toBe(8);
    expect(useAppStore.getState().loadError).toBeNull();
  });

  it('loadDbmlSafe sets loadError and leaves model unchanged on invalid content', () => {
    useAppStore.getState().loadDbml(dbml);
    const prevModel = useAppStore.getState().model;
    useAppStore.getState().loadDbmlSafe('Table { broken');
    expect(useAppStore.getState().loadError).toBeTruthy();
    expect(useAppStore.getState().model).toBe(prevModel);
  });

  it('records the baked databases and the active one', () => {
    const dbs = [
      { id: 'a', label: 'a', file: 'a.dbml' },
      { id: 'b', label: 'b', file: 'b.dbml' },
    ];
    useAppStore.getState().setDatabases(dbs);
    expect(useAppStore.getState().databases).toEqual(dbs);
    useAppStore.getState().setActiveDatabase('b');
    expect(useAppStore.getState().activeDb).toBe('b');
  });

  it('clearing the active database reopens the chooser', () => {
    useAppStore.getState().setActiveDatabase('a');
    useAppStore.getState().setActiveDatabase(null);
    expect(useAppStore.getState().activeDb).toBeNull();
  });

  it('path mode: first pick sets start, second pick builds path selector', () => {
    const s = useAppStore.getState();
    s.setPathMode(true);
    s.pickPathTable('model.shop.f_order');
    expect(useAppStore.getState().pathStart).toBe('model.shop.f_order');
    expect(useAppStore.getState().selector).toBe('');
    s.pickPathTable('model.shop.d_warehouse');
    expect(useAppStore.getState().selector).toBe('path:f_order>d_warehouse');
    expect(useAppStore.getState().pathMode).toBe(false);
    expect(useAppStore.getState().pathStart).toBeNull();
  });
});
