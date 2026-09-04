import { LogoMark } from '@/components/brand';

interface LoadingStateProps {
  state: string;
}

export function LoadingState({ state }: LoadingStateProps) {
  return (
    <div className="bg-sky bg-bubbles flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex size-16 items-center justify-center">
          <div className="ring-spinner absolute inset-0" aria-hidden />
          <LogoMark size={28} />
        </div>
        <p className="text-text-2 text-sm">
          {state === 'connecting' ? 'Connecting...' : 'Loading...'}
        </p>
      </div>
    </div>
  );
}
