// src/shared/utils/base64.ts

/**
 * Encodes an array of numbers (tokens) into a base64 string.
 * This function handles both 2-byte and 4-byte token sizes.
 *
 * @param tokens - The array of numbers to encode.
 * @param tokenSize - The size of each token in bytes (2 or 4).
 * @returns The base64 encoded string.
 */
export function encodeTokens(tokens: number[], tokenSize: 2 | 4): string {
  const buffer = new ArrayBuffer(tokens.length * tokenSize);
  const view = new DataView(buffer);

  if (tokenSize === 2) {
    tokens.forEach((token, i) => {
      view.setUint16(i * 2, token, true); // true for little-endian
    });
  } else {
    tokens.forEach((token, i) => {
      view.setUint32(i * 4, token, true); // true for little-endian
    });
  }

  const binaryString = Array.from(new Uint8Array(buffer))
    .map(byte => String.fromCharCode(byte))
    .join('');

  return btoa(binaryString);
}

/**
 * Decodes a base64 string back into an array of numbers (tokens).
 * This function handles both 2-byte and 4-byte token sizes.
 *
 * @param encoded - The base64 encoded string.
 * @param tokenSize - The size of each token in bytes (2 or 4).
 * @returns The array of decoded numbers.
 */
export function decodeTokens(encoded: string, tokenSize: 2 | 4): number[] {
  const binaryString = atob(encoded);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const buffer = bytes.buffer;
  const view = new DataView(buffer);
  const tokens: number[] = [];

  if (tokenSize === 2) {
    for (let i = 0; i < view.byteLength; i += 2) {
      tokens.push(view.getUint16(i, true)); // true for little-endian
    }
  } else {
    for (let i = 0; i < view.byteLength; i += 4) {
      tokens.push(view.getUint32(i, true)); // true for little-endian
    }
  }

  return tokens;
}