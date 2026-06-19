import { looksLikeDbml } from '@/app/bootstrap';

describe('looksLikeDbml', () => {
  it('accepts plausible dbml', () => {
    expect(looksLikeDbml('Table "x" {\n}')).toBe(true);
    expect(looksLikeDbml('//c\nRef: "a"."x" > "b"."y"')).toBe(true);
  });
  it('rejects empty and HTML (SPA fallback)', () => {
    expect(looksLikeDbml('')).toBe(false);
    expect(looksLikeDbml('  ')).toBe(false);
    expect(looksLikeDbml('<!doctype html><html>...')).toBe(false);
  });
});
