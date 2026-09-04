'use client';

import { useState, useEffect, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { JoinButton } from './JoinButton';
import { useUser } from '@/hooks';
import { BACKEND_CHECK_TIMEOUT, ONLINE_STATUS_CHECK_INTERVAL } from '@/constants';
import { cn } from '@/lib/utils';

const GENDERS = ['Male', 'Female'] as const;

export const WelcomeForm = () => {
  const { name, setName, gender, setGender } = useUser();
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(true);
  const [serviceMessage, setServiceMessage] = useState('');
  const [isCheckingService, setIsCheckingService] = useState(false);
  const [nameError, setNameError] = useState('');
  const router = useRouter();
  const nameId = useId();

  const validateName = (value: string): string => {
    const trimmedName = value.trim();
    if (trimmedName.length === 0) return '';
    if (trimmedName.length < 3) return 'A bit longer, at least 3 letters.';
    if (/\d/.test(trimmedName)) return 'Letters only, no numbers.';
    if (!/^[a-zA-Z\s]+$/.test(trimmedName)) return 'Letters and spaces only.';
    return '';
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    setNameError(validateName(value));
  };

  const isNameValid =
    name.trim().length >= 3 && !/\d/.test(name) && /^[a-zA-Z\s]+$/.test(name.trim());

  useEffect(() => {
    const checkOnlineStatus = async () => {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        setIsOnline(true);
        return;
      }

      try {
        const res = await fetch(`${backendUrl}/status`, {
          signal: AbortSignal.timeout(BACKEND_CHECK_TIMEOUT),
        });
        const data = (await res.json()) as { status?: boolean };
        setIsOnline(data.status === true);
      } catch {
        setIsOnline(false);
      }
    };

    checkOnlineStatus();
    const interval = setInterval(checkOnlineStatus, ONLINE_STATUS_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const handleJoin = async () => {
    if (!isNameValid || isLoading) return;

    if (!isOnline) {
      setServiceAvailable(false);
      setServiceMessage('Chat is closed right now. It opens daily from 11 PM to 3 AM IST.');
      return;
    }

    setIsLoading(true);
    setIsCheckingService(true);
    setServiceAvailable(true);
    setServiceMessage('');

    try {
      setIsCheckingService(false);
      router.push('/omegle');
    } catch {
      setServiceAvailable(false);
      setServiceMessage('Could not open the room. Try again.');
      setIsLoading(false);
      setIsCheckingService(false);
    }
  };

  return (
    <div className="bg-surface shadow-card rounded-3xl p-6 sm:p-7">
      <div className="flex items-center justify-between">
        <label htmlFor={nameId} className="text-text text-sm font-semibold">
          Your name
        </label>
        <span className="text-text-3 inline-flex items-center gap-1.5 text-sm">
          <span
            className={cn('size-2 rounded-full', isOnline ? 'bg-green animate-live' : 'bg-red')}
            aria-hidden
          />
          {isOnline ? 'Online' : 'Closed'}
        </span>
      </div>

      <input
        id={nameId}
        type="text"
        placeholder="what should we call you?"
        value={name}
        onChange={handleNameChange}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        aria-invalid={Boolean(nameError)}
        aria-describedby={nameError ? `${nameId}-error` : undefined}
        className={cn(
          'bg-sky text-text placeholder:text-text-3 mt-2.5 h-13 w-full rounded-2xl px-4 text-[16px] transition-all outline-none',
          nameError
            ? 'ring-red/40 ring-2'
            : 'focus:bg-surface focus:ring-blue/50 hover:bg-sky-2 focus:ring-2'
        )}
      />
      {nameError && (
        <p id={`${nameId}-error`} className="text-red mt-2 pl-1 text-sm" aria-live="polite">
          {nameError}
        </p>
      )}

      <p className="text-text text-sm font-semibold mt-5">I am</p>
      <div
        role="radiogroup"
        aria-label="Gender"
        className="bg-sky relative mt-2.5 grid h-13 grid-cols-2 rounded-2xl p-1.5"
      >
        <span
          aria-hidden
          className={cn(
            'bg-surface shadow-float absolute inset-y-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-xl transition-transform duration-300 ease-[var(--ease-bounce)]',
            gender === 'Female' && 'translate-x-full'
          )}
        />
        {GENDERS.map((g) => {
          const active = gender === g;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setGender(g)}
              className={cn(
                'relative z-10 rounded-xl text-[15px] font-semibold transition-colors',
                active ? (g === 'Female' ? 'text-pink' : 'text-blue') : 'text-text-3'
              )}
            >
              {g}
            </button>
          );
        })}
      </div>

      {!serviceAvailable && serviceMessage && (
        <p role="alert" className="bg-red-soft text-red mt-5 rounded-2xl px-4 py-3 text-sm">
          {serviceMessage}
        </p>
      )}

      <div className="mt-5">
        <JoinButton
          isOnline={isOnline}
          onClick={handleJoin}
          disabled={!isNameValid || isLoading}
          isChecking={isCheckingService}
        />
      </div>

      <p className="text-text-3 mt-4 text-center text-xs leading-relaxed">
        By continuing you agree to our{' '}
        <Link href="/terms" className="hover:text-text underline underline-offset-2">
          terms
        </Link>
        ,{' '}
        <Link href="/privacy" className="hover:text-text underline underline-offset-2">
          privacy
        </Link>{' '}
        and{' '}
        <Link href="/community-guidelines" className="hover:text-text underline underline-offset-2">
          guidelines
        </Link>
        .
      </p>
    </div>
  );
};
