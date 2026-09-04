import { LogoMark } from '@/components/brand';

interface ErrorStateProps {
  error: string;
  onGoBack: () => void;
  onRetry?: () => void;
}

export function ErrorState({ error, onGoBack, onRetry }: ErrorStateProps) {
  const isBackendDown =
    error.includes('Backend') ||
    error.includes('unavailable') ||
    error.includes('not responding') ||
    error.includes('server');

  return (
    <div className="bg-sky bg-bubbles flex min-h-screen items-center justify-center px-4">
      <div className="bg-surface shadow-card pop w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
        <LogoMark size={56} className="mx-auto" />
        <h2 className="text-text mt-6 text-2xl font-bold tracking-tight">
          {isBackendDown ? 'Chat is offline' : 'Connection lost'}
        </h2>
        <p className="text-text-2 mt-3 leading-relaxed">{error}</p>

        {isBackendDown && (
          <p className="bg-sky text-text-2 mt-5 rounded-2xl p-4 text-sm">
            Chat opens daily from 11 PM to 3 AM IST. Come back then.
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="bg-blue hover:bg-blue-dark inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white transition-colors"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={onGoBack}
            className="bg-blue-softer hover:bg-blue-soft text-blue-dark inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
