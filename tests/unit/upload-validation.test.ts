import { describe, it, expect } from 'vitest';
import { validateUpload, looksLikeGiftCardSecret, UPLOAD_LIMITS } from '@/lib/storage/upload-validation';

function bytesOf(magic: number[], size = 100 * 1024): Uint8Array {
  const buf = new Uint8Array(size);
  buf.set(magic);
  return buf;
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03]; // Windows PE header

describe('upload validation', () => {
  it('accepts genuine PNG / JPEG files for card artwork', () => {
    expect(
      validateUpload({ fileName: 'art.png', declaredMime: 'image/png', bytes: bytesOf(PNG), kind: 'card' }).ok
    ).toBe(true);
    expect(
      validateUpload({ fileName: 'art.jpg', declaredMime: 'image/jpeg', bytes: bytesOf(JPEG), kind: 'card' }).ok
    ).toBe(true);
  });

  it('evidence accepts genuine PDFs too', () => {
    expect(
      validateUpload({ fileName: 'receipt.pdf', declaredMime: 'application/pdf', bytes: bytesOf(PDF), kind: 'evidence' }).ok
    ).toBe(true);
  });

  it('rejects an executable renamed to .jpg (magic-bytes mismatch)', () => {
    const result = validateUpload({ fileName: 'evil.jpg', declaredMime: 'image/jpeg', bytes: bytesOf(EXE), kind: 'card' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/contents/i);
  });

  it('rejects disallowed extensions outright', () => {
    expect(
      validateUpload({ fileName: 'malware.exe', declaredMime: 'image/jpeg', bytes: bytesOf(EXE), kind: 'card' }).ok
    ).toBe(false);
    expect(
      validateUpload({ fileName: 'page.html', declaredMime: 'image/png', bytes: bytesOf(PNG), kind: 'card' }).ok
    ).toBe(false);
  });

  it('rejects loads above the per-kind size caps', () => {
    const tooBigTeeny = new Uint8Array(UPLOAD_LIMITS.card + 1);
    tooBigTeeny.set(PNG);
    expect(
      validateUpload({ fileName: 'huge.png', declaredMime: 'image/png', bytes: tooBigTeeny, kind: 'card' }).ok
    ).toBe(false);
  });

  it('rejects empty files and wrong declared MIME', () => {
    expect(
      validateUpload({ fileName: 'a.png', declaredMime: 'image/png', bytes: new Uint8Array(0), kind: 'card' }).ok
    ).toBe(false);
    expect(
      validateUpload({ fileName: 'a.png', declaredMime: 'text/html', bytes: bytesOf(PNG), kind: 'card' }).ok
    ).toBe(false);
  });

  it('storage file names are randomised, never customer input', () => {
    const result = validateUpload({ fileName: 'sarah-jones-id.png', declaredMime: 'image/png', bytes: bytesOf(PNG), kind: 'card' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.safeFileName).toMatch(/^[a-f0-9]{16,32}\.png$/);
      expect(result.safeFileName).not.toContain('sarah');
      expect(result.safeFileName).not.toContain('jones');
    }
  });

  it('detects gift-card-looking secrets (must never be stored)', () => {
    expect(looksLikeGiftCardSecret('6044 1234 1234 1234')).toBe(true);
    expect(looksLikeGiftCardSecret('4123123412341234123')).toBe(true);
    expect(looksLikeGiftCardSecret('Receipt 210 from the wallet app')).toBe(false);
    expect(looksLikeGiftCardSecret('USDT')).toBe(false);
  });

  it('upload limits stay under the 25 MB bucket hard limit', () => {
    expect(UPLOAD_LIMITS.evidence).toBeLessThanOrEqual(25 * 1024 * 1024);
    expect(UPLOAD_LIMITS.card).toBeLessThanOrEqual(25 * 1024 * 1024);
  });
});
