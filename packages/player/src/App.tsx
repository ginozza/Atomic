import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRouter,
  ErrorComponentProps,
  RouterProvider,
} from '@tanstack/react-router';
import { platform } from '@tauri-apps/plugin-os';
import { Component, FC, ReactNode, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';

import { i18n } from '@nuclearplayer/i18n';
import { Platform, PlatformProvider } from '@nuclearplayer/ui';

import { routeTree } from './routeTree.gen';

const isBenignError = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof DOMException) return true;
  const errorObj = error as {
    name?: string;
    message?: string;
    toString?: () => string;
  };
  const name = errorObj.name ?? '';
  const message = errorObj.message ?? '';
  const stringified =
    typeof errorObj.toString === 'function' ? errorObj.toString() : '';
  const combined = `${name} ${message} ${stringified}`.toLowerCase();

  if (name === 'AbortError' || name === 'QuotaExceededError') return true;

  if (
    combined.includes('domexception') ||
    combined.includes('aborterror') ||
    combined.includes('interrupted') ||
    combined.includes('removechild') ||
    combined.includes('not a child of this node') ||
    combined.includes('failed to fetch dynamically imported module') ||
    combined.includes('preload') ||
    combined.includes('dynamically imported')
  ) {
    return true;
  }

  return false;
};

const RouterErrorFallback: FC<ErrorComponentProps> = ({ error, reset }) => {
  const errorObj = error as {
    name?: string;
    message?: string;
    stack?: string;
  } | null;
  console.error(
    '[Router] Unhandled route error:',
    errorObj?.name,
    errorObj?.message,
    errorObj?.stack,
  );

  const benign = isBenignError(error);

  useEffect(() => {
    if (benign) {
      reset?.();
    }
  }, [benign, reset]);

  if (benign) {
    return null;
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center select-none">
      <span className="text-sm font-medium text-muted-foreground">
        {error instanceof Error ? error.message : 'An unexpected error occurred'}
      </span>
      {reset && (
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 active:scale-95 transition-transform"
        >
          Retry
        </button>
      )}
    </div>
  );
};

const router = createRouter({
  routeTree,
  defaultErrorComponent: RouterErrorFallback,
});
const defaultQueryClient = new QueryClient();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const isRecoverableError = (error: unknown): boolean => {
  if (isBenignError(error)) return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('load') ||
      message.includes('chunk') ||
      message.includes('abort') ||
      message.includes('dynamically imported')
    ) {
      return true;
    }
  }
  return true;
};

type RootErrorBoundaryState = { hasError: boolean; error: unknown };

class RootErrorBoundary extends Component<
  { children: ReactNode },
  RootErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    if (isBenignError(error)) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    if (isBenignError(error)) {
      console.warn('[RootErrorBoundary] Suppressed benign error:', error);
    } else {
      console.error('[RootErrorBoundary] Unexpected error:', error);
    }
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (isRecoverableError(this.state.error)) {
        return (
          <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground select-none">
            <span className="text-sm font-medium text-muted-foreground">
              {this.state.error instanceof Error
                ? this.state.error.message
                : 'A temporary error occurred'}
            </span>
            <button
              type="button"
              onClick={this.handleRecover}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 active:scale-95 transition-transform"
            >
              Recover
            </button>
          </div>
        );
      }
      return null;
    }
    return this.props.children;
  }
}

type AppProps = {
  routerProp?: typeof router;
  queryClientProp?: QueryClient;
};

const App: FC<AppProps> = ({ routerProp, queryClientProp }) => {
  return (
    <RootErrorBoundary>
      <PlatformProvider platform={platform() as Platform}>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClientProp ?? defaultQueryClient}>
            <RouterProvider router={routerProp ?? router} />
          </QueryClientProvider>
        </I18nextProvider>
      </PlatformProvider>
    </RootErrorBoundary>
  );
};

export default App;
