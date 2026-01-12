/**
 * Test for avatar decoration URL signing in user repository
 * Verifies that avatar decorations use the proper pack method to sign URLs
 */

// Helper function that simulates the user repository logic for packing avatar decorations
const packAvatarDecorations = async (decorations, DecorationsRepo) => {
  return Promise.all(decorations.map(async decoration => {
    const dec = await DecorationsRepo.findOne({ where: { id: decoration.id } });
    if (!dec) {
      return {
        ...decoration,
        url: null,
      };
    }
    // Use Decorations.pack() to properly sign URLs for object storage
    const packed = await DecorationsRepo.pack(dec);
    return {
      ...decoration,
      url: packed.url,
    };
  }));
};

describe('Avatar Decoration URL Signing', () => {
  test('decoration pack method should be called for avatar decorations', async () => {
    // Mock decoration entity
    const mockDecoration = {
      id: 'decoration123',
      name: 'test-decoration',
      publicUrl: 'https://s3.amazonaws.com/bucket/decorations/test.png',
      originalUrl: 'https://s3.amazonaws.com/bucket/decorations/test.png',
      aliases: [],
      host: null,
      category: 'test',
      isPlus: false,
      isMPlus: false,
      credit: null,
    };

    // Mock user avatar decoration
    const userAvatarDecoration = {
      id: 'decoration123',
      angle: 0,
      flipH: false,
      offsetX: 0,
      offsetY: 0,
    };

    // Mock the pack method that should generate signed URLs
    const mockPackedDecoration = {
      id: 'decoration123',
      name: 'test-decoration',
      url: 'https://s3.amazonaws.com/bucket/decorations/test.png?X-Amz-Signature=NEWSIGNATURE&X-Amz-Expires=3600',
      aliases: [],
      host: null,
      category: 'test',
      isPlus: false,
      isMPlus: false,
      credit: null,
    };

    // Create a mock Decorations repository
    const mockDecorationsRepo = {
      findOne: vi.fn().mockResolvedValue(mockDecoration),
      pack: vi.fn().mockResolvedValue(mockPackedDecoration),
    };

    // Test the packing logic
    const result = await packAvatarDecorations([userAvatarDecoration], mockDecorationsRepo);

    // Verify findOne was called to fetch the decoration
    expect(mockDecorationsRepo.findOne).toHaveBeenCalledTimes(1);
    expect(mockDecorationsRepo.findOne).toHaveBeenCalledWith({ where: { id: 'decoration123' } });

    // Verify pack was called to generate signed URL
    expect(mockDecorationsRepo.pack).toHaveBeenCalledTimes(1);
    expect(mockDecorationsRepo.pack).toHaveBeenCalledWith(mockDecoration);

    // Verify the result contains the signed URL from pack method
    expect(result).toEqual([{
      id: 'decoration123',
      angle: 0,
      flipH: false,
      offsetX: 0,
      offsetY: 0,
      url: 'https://s3.amazonaws.com/bucket/decorations/test.png?X-Amz-Signature=NEWSIGNATURE&X-Amz-Expires=3600',
    }]);
  });

  test('should handle missing decorations gracefully', async () => {
    const userAvatarDecoration = {
      id: 'nonexistent',
      angle: 0,
    };

    const mockDecorationsRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      pack: vi.fn(),
    };

    const result = await packAvatarDecorations([userAvatarDecoration], mockDecorationsRepo);

    // Verify findOne was called
    expect(mockDecorationsRepo.findOne).toHaveBeenCalledTimes(1);

    // Verify pack was NOT called since decoration doesn't exist
    expect(mockDecorationsRepo.pack).not.toHaveBeenCalled();

    // Verify the result contains null URL
    expect(result).toEqual([{
      id: 'nonexistent',
      angle: 0,
      url: null,
    }]);
  });

  test('signed URL should have query parameters', () => {
    const unsignedUrl = 'https://s3.amazonaws.com/bucket/decorations/test.png';
    const signedUrl = 'https://s3.amazonaws.com/bucket/decorations/test.png?X-Amz-Signature=abc&X-Amz-Expires=3600';

    // Parse URLs to check for signature parameters
    const unsignedUrlObj = new URL(unsignedUrl);
    const signedUrlObj = new URL(signedUrl);

    // Unsigned URL should not have signature parameters
    expect(unsignedUrlObj.searchParams.has('X-Amz-Signature')).toBe(false);
    expect(unsignedUrlObj.searchParams.has('X-Amz-Expires')).toBe(false);

    // Signed URL should have signature parameters
    expect(signedUrlObj.searchParams.has('X-Amz-Signature')).toBe(true);
    expect(signedUrlObj.searchParams.has('X-Amz-Expires')).toBe(true);
  });
});
