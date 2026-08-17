const {
  packagesForFeatures,
  resolveFeatureKeys,
  RECOMMENDED_FEATURES,
  ALL_FEATURES
} = require('../../commands/optionalFeatures');

describe('optionalFeatures', () => {
  test('resolveFeatureKeys minimal is empty', () => {
    expect(resolveFeatureKeys('minimal')).toEqual([]);
  });

  test('resolveFeatureKeys recommended matches constant', () => {
    expect(resolveFeatureKeys('recommended')).toEqual(RECOMMENDED_FEATURES);
  });

  test('resolveFeatureKeys full is all features', () => {
    expect(resolveFeatureKeys('full').sort()).toEqual([...ALL_FEATURES].sort());
  });

  test('resolveFeatureKeys custom filters unknown keys', () => {
    expect(resolveFeatureKeys('custom', ['postgres', 'nope', 'pdf'])).toEqual([
      'postgres',
      'pdf'
    ]);
  });

  test('packagesForFeatures expands and dedupes', () => {
    const pkgs = packagesForFeatures(['image', 'charts', 'pdf', 'postgres']);
    expect(pkgs).toEqual(
      expect.arrayContaining(['sharp', 'pg', 'pdfmake', 'chartjs-node-canvas', 'canvas'])
    );
    expect(new Set(pkgs).size).toBe(pkgs.length);
  });

  test('recommended includes image (sharp) for require(image)', () => {
    const pkgs = packagesForFeatures(RECOMMENDED_FEATURES);
    expect(RECOMMENDED_FEATURES).toContain('image');
    expect(pkgs).toContain('sharp');
  });
});
