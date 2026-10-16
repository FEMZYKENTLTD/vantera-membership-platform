import { randomToken } from '@/lib/random';

/**
 * Strict upload validation for payment evidence and membership card designs.
 *
 * Defence in depth:
 *  1. Extension allowlist (png / jpg / jpeg / pdf) — anything executable is
 *     impossible to upload because it is not on the list.
 *  2. MIME allowlist enforced again by the storage bucket configuration.
 *  3. Magic-byte sniffing: the first bytes must match the claimed type.
 *  4. Size caps per upload kind (all under the 25 MB bucket hard limit).
 *  5. The original file name is DISCARDED: it is user-controlled text and can
 *     itself contain personal data ("sarah-passport.pdf"). Stored object
 *     names are `random-token.ext` only, so object paths never contain
 *     customer personal data.
 */

export type UploadKind = 'evidence' | 'card';

interface AllowedType {
  ext: readonly string[];
  mime: string;
  magic: readonly number[];
}

const ALLOWED: readonly AllowedType[] = [
  { ext: ['png'], mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: ['jpg', 'jpeg'], mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { ext: ['pdf'], mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] } // %PDF
];

export const UPLOAD_LIMITS: Record<UploadKind, number> = {
  evidence: 10 * 1024 * 1024, // 10 MB
  card: 15 * 1024 * 1024 // 15 MB
};

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

function magicMatches(buf: Uint8Array, magic: readonly number[]): boolean {
  if (buf.length < magic.length) return false;
  return magic.every((byte, i) => buf[i] === byte);
}

export interface ValidatedUpload {
  ok: true;
  detectedMime: string;
  extension: string;
  safeFileName: string;
  sizeBytes: number;
}

export interface RejectedUpload {
  ok: false;
  error: string;
}

export function validateUpload(input: {
  fileName: string;
  declaredMime: string;
  bytes: Uint8Array;
  kind: UploadKind;
}): ValidatedUpload | RejectedUpload {
  const { fileName, declaredMime, bytes, kind } = input;
  const limit = UPLOAD_LIMITS[kind];

  if (!bytes || bytes.byteLength === 0) {
    return { ok: false, error: 'The file is empty.' };
  }
  if (bytes.byteLength > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return { ok: false, error: `Files must be at most ${mb} MB.` };
  }

  const ext = fileExtension(fileName);
  const byExt = ALLOWED.find((t) => t.ext.includes(ext));
  if (!byExt) {
    return {
      ok: false,
      error: 'Unsupported file type. Allowed: PNG, JPEG or PDF.'
    };
  }

  if (!magicMatches(bytes, byExt.magic)) {
    return {
      ok: false,
      error: 'The file contents do not match its extension and were rejected.'
    };
  }

  if (declaredMime && declaredMime !== byExt.mime) {
    return { ok: false, error: 'The declared file type does not match the file.' };
  }

  // Random object name + original extension only — the customer-chosen file
  // name never reaches storage paths (privacy by construction).
  const safeFileName = `${randomToken(16)}.${ext}`;
  return {
    ok: true,
    detectedMime: byExt.mime,
    extension: ext,
    safeFileName,
    sizeBytes: bytes.byteLength
  };
}

/** Detect if a text value looks like a gift-card secret we must never store. */
export function looksLikeGiftCardSecret(value: string): boolean {
  const compact = value.replace(/[\s-]+/g, '');
  // Long unbroken numeric runs (typical card numbers/PINs).
  if (/^\d{13,25}$/.test(compact)) return true;
  return false;
}
