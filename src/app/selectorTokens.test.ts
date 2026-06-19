import { describe, expect, it } from 'vitest';
import { removeTokenAt } from './selectorTokens';

describe('removeTokenAt', () => {
  it('removes the first token', () => {
    expect(removeTokenAt('group:sales f_order+', 0)).toBe('f_order+');
  });

  it('removes the second token', () => {
    expect(removeTokenAt('group:sales f_order+', 1)).toBe('group:sales');
  });

  it('removing the only token returns empty string', () => {
    expect(removeTokenAt('f_order+', 0)).toBe('');
  });
});
