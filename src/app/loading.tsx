export default function Loading() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border border-gold-500/20 border-t-gold-400"
          role="status"
          aria-label="Loading"
        />
        <p className="text-xs uppercase tracking-[0.3em] text-ivory-100/35">Vantera</p>
      </div>
    </div>
  );
}
