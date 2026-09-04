/**
 * Error Boundary Component for Omegle Route
 * Catches React errors and provides fallback UI
 */

'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { LogoMark } from '@/components/brand';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class OmegleErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/omegle';
  };

  private handleGoHome = () => {
    window.location.href = '/welcome';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="bg-sky bg-bubbles flex min-h-screen items-center justify-center px-4">
          <div className="bg-surface shadow-card pop w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
            <LogoMark size={56} className="mx-auto" />
            <h2 className="text-text mt-6 text-2xl font-bold tracking-tight">Something broke</h2>
            <p className="text-text-2 mt-3 leading-relaxed">
              Usually it&apos;s camera permissions, a flaky network, or an old browser. Give it
              another go.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="bg-sky mt-5 rounded-2xl p-4 text-left text-xs">
                <summary className="text-text-2 cursor-pointer font-medium">Error details</summary>
                <pre className="text-red mt-2 max-h-40 overflow-auto whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="bg-blue hover:bg-blue-dark inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white transition-colors"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="bg-blue-softer hover:bg-blue-soft text-blue-dark inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors"
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
