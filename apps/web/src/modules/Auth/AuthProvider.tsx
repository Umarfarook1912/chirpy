import { useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth.api';
import { AuthContext } from '../../hooks/useAuth';
import type { UserProfile } from '@chirpy/shared';

export interface AuthProviderProps {
  children: ReactNode;
  initialUser: UserProfile | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { profile } = await authApi.login({ email, password });
      setUser(profile);
      await queryClient.invalidateQueries();
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  const register = useCallback(
    async (data: { email: string; password: string; displayName: string; organizationName: string }) => {
      setIsLoading(true);
      try {
        const { profile } = await authApi.register(data);
        setUser(profile);
        await queryClient.invalidateQueries();
      } finally {
        setIsLoading(false);
      }
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
      setUser(null);
      queryClient.clear();
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
