import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Verify a card',
  robots: { index: false, follow: false }
};

export default async function VerifyEntryPage({
  searchParams
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  if (code && /^[0-9a-f]{32}$/i.test(code.trim())) {
    redirect(`/verify/${code.trim().toLowerCase()}`);
  }

  return (
    <div className="surface-raised p-8 text-center">
      <p className="eyebrow">Card verification</p>
      <h1 className="font-display text-2xl mt-3">Verify a Vantera card</h1>
      <p className="mt-3 text-sm leading-relaxed text-ivory-100/50">
        Enter the 32-character verification code shown on the card. The result
        confirms authenticity only — it never reveals the member’s identity.
      </p>
      <form method="get" className="mt-8 space-y-4">
        <input
          type="text"
          name="code"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. 9f4c2b…  (32 characters)"
          className="input-dark text-center font-mono"
          minLength={32}
          maxLength={32}
          required
        />
        <button
          type="submit"
          className="w-full rounded-md bg-gold-500 px-4 py-2.5 text-sm font-semibold text-noir-900 hover:bg-gold-400"
        >
          Verify card
        </button>
      </form>
      {code && (
        <p className="mt-4 text-sm text-danger/90">
          That is not a valid verification code. Check the card and try again.
        </p>
      )}
    </div>
  );
}
