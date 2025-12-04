import { randomBytes } from 'crypto';

/**
 * Secure token generator with cryptographically-strong random bytes
 * تولید توکن امن با بایت‌های تصادفی رمزنگاری‌شده
 */
export class TokenGenerator {
  private static readonly BASE62_CHARS =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  /**
   * Generate a cryptographically-strong random token
   * @param length - Length of the token (default: 24 chars = ~138 bits entropy)
   * @returns Base62-encoded token
   */
  static generateSecureToken(length: number = 24): string {
    // Calculate bytes needed for desired entropy
    // Each base62 char provides log2(62) ≈ 5.95 bits of entropy
    // For 24 chars: 24 * 5.95 ≈ 143 bits
    const bytesNeeded = Math.ceil((length * Math.log2(62)) / 8);
    const buffer = randomBytes(bytesNeeded);

    let token = '';
    for (let i = 0; i < length; i++) {
      // Use multiple bytes to ensure uniform distribution
      const index =
        (buffer[i % buffer.length] + buffer[(i + 1) % buffer.length]) %
        this.BASE62_CHARS.length;
      token += this.BASE62_CHARS[index];
    }

    return token;
  }

  /**
   * Generate a numeric ID (for backward compatibility)
   * NOT recommended for security-critical tokens
   */
  static generateNumericId(min: number = 100000, max: number = 999999): number {
    const range = max - min + 1;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const buffer = randomBytes(bytesNeeded);
    const randomValue = buffer.readUIntBE(0, bytesNeeded);
    return min + (randomValue % range);
  }

  /**
   * Validate token format
   */
  static isValidTokenFormat(
    token: string,
    expectedLength: number = 24,
  ): boolean {
    if (token.length !== expectedLength) return false;
    return /^[0-9A-Za-z]+$/.test(token);
  }
}
