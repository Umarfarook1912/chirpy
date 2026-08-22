import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import { AuthProvider } from './modules/Auth/AuthProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { authApi } from './api/auth.api';
import { Spinner } from './ui/atoms/Spinner';
import type { UserProfile } from '@chirpy/shared';
import './index.scss';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Root() {
  const [initialUser, setInitialUser] = useState<UserProfile | null | undefined>(undefined);

  useEffect(() => {
    authApi.me().then(setInitialUser).catch(() => setInitialUser(null));
  }, []);

  if (initialUser === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <AuthProvider initialUser={initialUser}>
      <App />
    </AuthProvider>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Root />
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
