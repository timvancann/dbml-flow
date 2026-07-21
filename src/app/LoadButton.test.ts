import { orderSelectedFiles } from '@/app/LoadButton';

function file(name: string): File {
  return new File(['x'], name);
}

describe('orderSelectedFiles', () => {
  it('separates a single dbml file from json manifests', () => {
    const result = orderSelectedFiles([file('shop.manifest.json'), file('shop.dbml')]);
    expect(result.error).toBeNull();
    expect(result.dbmlFile?.name).toBe('shop.dbml');
    expect(result.jsonFiles.map((f) => f.name)).toEqual(['shop.manifest.json']);
  });

  it('accepts a lone json file with no dbml', () => {
    const result = orderSelectedFiles([file('shop.manifest.json')]);
    expect(result.error).toBeNull();
    expect(result.dbmlFile).toBeNull();
    expect(result.jsonFiles.map((f) => f.name)).toEqual(['shop.manifest.json']);
  });

  it('accepts a .txt file as the dbml source', () => {
    const result = orderSelectedFiles([file('shop.txt')]);
    expect(result.error).toBeNull();
    expect(result.dbmlFile?.name).toBe('shop.txt');
  });

  it('errors on more than one dbml file', () => {
    const result = orderSelectedFiles([file('a.dbml'), file('b.dbml')]);
    expect(result.error).toBe('Select at most one .dbml file');
    expect(result.dbmlFile).toBeNull();
    expect(result.jsonFiles).toEqual([]);
  });
});
