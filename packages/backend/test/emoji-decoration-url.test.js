/**
 * Test for emoji and decoration URL regeneration logic
 * This tests the URL extraction and reconstruction without requiring a database
 */

describe('Emoji and Decoration URL Regeneration', () => {
  test('extracts S3 object key from path-style URL', () => {
    const storedUrl = 'https://s3.amazonaws.com/my-bucket/emoji/abc123.png?X-Amz-Signature=xyz';
    const baseUrl = 'https://s3.amazonaws.com/my-bucket';
    
    const urlObj = new URL(storedUrl);
    const baseUrlObj = new URL(baseUrl);
    
    const pathname = urlObj.pathname; // '/my-bucket/emoji/abc123.png'
    const key = pathname.substring(baseUrlObj.pathname.length); // '/emoji/abc123.png'
    const cleanKey = key.startsWith('/') ? key.substring(1) : key; // 'emoji/abc123.png'
    
    expect(cleanKey).toBe('emoji/abc123.png');
  });

  test('extracts S3 object key from custom baseUrl', () => {
    const storedUrl = 'https://cdn.example.com/emoji/abc123.png?X-Amz-Signature=xyz';
    const baseUrl = 'https://cdn.example.com';
    
    const urlObj = new URL(storedUrl);
    const baseUrlObj = new URL(baseUrl);
    
    const pathname = urlObj.pathname; // '/emoji/abc123.png'
    const key = pathname.substring(baseUrlObj.pathname.length); // '/emoji/abc123.png'
    const cleanKey = key.startsWith('/') ? key.substring(1) : key; // 'emoji/abc123.png'
    
    expect(cleanKey).toBe('emoji/abc123.png');
  });

  test('handles URL with nested paths', () => {
    const storedUrl = 'https://s3.amazonaws.com/my-bucket/files/emoji/test/abc123.png?signature=xyz';
    const baseUrl = 'https://s3.amazonaws.com/my-bucket';
    
    const urlObj = new URL(storedUrl);
    const baseUrlObj = new URL(baseUrl);
    
    const pathname = urlObj.pathname; // '/my-bucket/files/emoji/test/abc123.png'
    const key = pathname.substring(baseUrlObj.pathname.length); // '/files/emoji/test/abc123.png'
    const cleanKey = key.startsWith('/') ? key.substring(1) : key; // 'files/emoji/test/abc123.png'
    
    expect(cleanKey).toBe('files/emoji/test/abc123.png');
  });

  test('checks URL startsWith baseUrl correctly', () => {
    const storedUrl = 'https://s3.amazonaws.com/my-bucket/emoji/abc123.png';
    const baseUrl = 'https://s3.amazonaws.com/my-bucket';
    
    expect(storedUrl.startsWith(baseUrl)).toBe(true);
  });

  test('rejects URL that does not match baseUrl', () => {
    const storedUrl = 'https://old-cdn.example.com/emoji/abc123.png';
    const baseUrl = 'https://new-cdn.example.com';
    
    expect(storedUrl.startsWith(baseUrl)).toBe(false);
  });

  test('constructs new URL with query parameters', () => {
    const baseUrl = 'https://s3.amazonaws.com/my-bucket';
    const key = 'emoji/abc123.png';
    const queryParams = new Map([
      ['X-Amz-Signature', 'newsignature123'],
      ['X-Amz-Expires', '3600']
    ]);
    
    const finalUrl = new URL(`${baseUrl}/${key}`);
    queryParams.forEach((value, k) => {
      finalUrl.searchParams.set(k, value);
    });
    
    const result = finalUrl.toString();
    
    expect(result).toBe('https://s3.amazonaws.com/my-bucket/emoji/abc123.png?X-Amz-Signature=newsignature123&X-Amz-Expires=3600');
  });

  test('handles decoration URLs the same way as emoji URLs', () => {
    const storedUrl = 'https://s3.amazonaws.com/my-bucket/decorations/def456.png?sig=old';
    const baseUrl = 'https://s3.amazonaws.com/my-bucket';
    
    const urlObj = new URL(storedUrl);
    const baseUrlObj = new URL(baseUrl);
    
    const pathname = urlObj.pathname;
    const key = pathname.substring(baseUrlObj.pathname.length);
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    
    expect(cleanKey).toBe('decorations/def456.png');
  });
});
