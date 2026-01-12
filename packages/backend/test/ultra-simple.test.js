/**
 * An ultra simple test that doesn't rely on mocking or complex assertions
 */

describe('Ultra Simple Tests', () => {
  test('basic math works', () => {
    expect(1 + 1).toBe(2);
  });

  test('string concatenation works', () => {
    expect('hello ' + 'world').toBe('hello world');
  });

  test('array operations work', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr[0]).toBe(1);
  });
});
