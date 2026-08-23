import { useCallback, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth.api';
import { AuthContext } from '../../hooks/useAuth';
import { Spinner } from '../../ui/atoms/Spinner';

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: user = null, isPending: isInitializing } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    retry: false,
    staleTime: 5 * 60 * 1_000,
    refetchOnWindowFocus: false,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      setIsSubmitting(true);
      try {
        const { profile } = await authApi.login({ email, password });
        queryClient.setQueryData(['auth', 'me'], profile);
        await queryClient.invalidateQueries();
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient],
  );

  const register = useCallback(
    async (data: { email: string; password: string; displayName: string; organizationName: string }) => {
      setIsSubmitting(true);
      try {
        const { profile } = await authApi.register(data);
        queryClient.setQueryData(['auth', 'me'], profile);
        await queryClient.invalidateQueries();
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await authApi.logout();
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
    } finally {
      setIsSubmitting(false);
    }
  }, [queryClient]);

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading: isSubmitting, isInitializing, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
