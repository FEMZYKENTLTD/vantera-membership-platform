'use client';

/**
 * Root-level error boundary: renders when the root layout itself fails.
 * Inline styles only — the stylesheet may not have loaded in this state.
 */
export default function GlobalRootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0A08',
          color: '#F3EFE6',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#C6A468'
            }}
          >
            Vantera
          </p>
          <h1 style={{ fontSize: '1.5rem', margin: '1rem 0', fontWeight: 500 }}>
            An unexpected error occurred
          </h1>
          <p style={{ color: '#a19a89', fontSize: '0.9rem', maxWidth: '26rem' }}>
            Nothing was charged and no decision was recorded. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              background: '#C6A468',
              color: '#0B0A08',
              border: 'none',
              borderRadius: '6px',
              padding: '0.75rem 2rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: '1.5rem', fontSize: '0.7rem', color: '#6b6455' }}>
              reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
