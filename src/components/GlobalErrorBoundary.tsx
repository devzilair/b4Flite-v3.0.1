'use client';

import React, { ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  // Explicitly declare props to avoid TS error in some environments
  declare props: Readonly<Props>;

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Capture exception in Sentry
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 text-center dark:bg-gray-900">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl dark:bg-gray-800 border-t-4 border-red-500">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg
                className="h-10 w-10 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white">
              Something went wrong
            </h1>

            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
              The application encountered an unexpected error. Please try reloading the page to resolve the issue.
            </p>

            {this.state.error && (
              <div className="mb-6 rounded-md bg-gray-100 p-3 text-left font-mono text-xs text-red-600 dark:bg-gray-700 dark:text-red-400 overflow-auto max-h-32 border border-gray-200 dark:border-gray-600">
                {this.state.error.toString()}
              </div>
            )}

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-md bg-brand-primary px-4 py-3 font-semibold text-white shadow-md transition-colors hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-50"
            >
              Reload Application
            </button>

            <div className="mt-6 border-t pt-4 dark:border-gray-700">
              <p className="text-xs text-gray-400">
                If this persists, please contact IT support.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;