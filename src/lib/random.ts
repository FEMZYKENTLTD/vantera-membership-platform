import { randomBytes } from 'node:crypto';

/**
 * Cryptographically secure random token for server-side identifiers such as
 * storage object names. Hex-encoded; 16 bytes => 32 chars, non-guessable.
 */
export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}

/** Safe single-segment file name for private storage objects. */
export function safeStorageFileName(original: string, maxLength = 120): string {
  const cleaned = original
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  const trimmed = cleaned.slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : 'file';
}
