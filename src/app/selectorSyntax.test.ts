import { readFileSync } from 'node:fs';
import { loadModel } from '@/model/loadModel';
import { tokenizeSelector, validateSelector } from '@/app/selectorSyntax';

const model = loadModel(readFileSync('src/model/__fixtures__/grouped.dbml', 'utf8'));
const kinds = (t: string) => tokenizeSelector(t).filter((x) => x.kind !== 'whitespace').map((x) => x.kind);
const errs = (t: string) => validateSelector(model, t);

describe('tokenizeSelector', () => {
  it('classifies operators, numbers, identifiers', () => {
    expect(kinds('2+d_customer')).toEqual(['number', 'operator', 'identifier']);
    expect(kinds('~d_customer')).toEqual(['operator', 'identifier']);
  });
  it('classifies keywords and globs', () => {
    expect(kinds('group:sales')).toEqual(['keyword', 'identifier']);
    expect(kinds('g:*sales')).toEqual(['keyword', 'glob', 'identifier']);
    expect(kinds('path:f_order>d_warehouse')).toEqual(['keyword', 'identifier', 'operator', 'identifier']);
  });
  it('flags invalid characters', () => {
    expect(kinds('-d_customer')).toContain('invalid');
  });
});

describe('validateSelector', () => {
  it('no diagnostics for valid input', () => {
    expect(errs('group:sales f_order+ ~2d_customer')).toEqual([]);
    expect(errs('path:f_order>d_warehouse')).toEqual([]);
    expect(errs('')).toEqual([]);
  });
  it('errors on an invalid operator/char', () => {
    const d = errs('-d_customer');
    expect(d.some((x) => x.severity === 'error')).toBe(true);
  });
  it('warns on an unknown table', () => {
    const d = errs('not_a_table');
    expect(d.some((x) => x.severity === 'warning' && /Unknown table/.test(x.message))).toBe(true);
  });
  it('warns on an unknown group', () => {
    const d = errs('group:nope');
    expect(d.some((x) => x.severity === 'warning' && /Unknown group/.test(x.message))).toBe(true);
  });
  it('warns on a malformed path', () => {
    expect(errs('path:f_order').some((x) => /Path needs/.test(x.message))).toBe(true);
  });
});
