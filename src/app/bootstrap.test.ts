import { looksLikeDbml, siblingManifestUrl } from '@/app/bootstrap';

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

describe('siblingManifestUrl', () => {
  it('swaps the .dbml suffix for .manifest.json', () => {
    expect(siblingManifestUrl('/dbml/shop.dbml')).toBe('/dbml/shop.manifest.json');
  });
  it('is case-insensitive on the .dbml suffix', () => {
    expect(siblingManifestUrl('/dbml/shop.DBML')).toBe('/dbml/shop.manifest.json');
  });
});
