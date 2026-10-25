import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const authQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: () => api.get('/auth/me'), retry: false, staleTime: 60_000 });
  const login = useCallback(async (input) => {
    const result = await api.post('/auth/login', input);
    queryClient.setQueryData(['auth', 'me'], { user: result.user });
    return result.user;
  }, [queryClient]);
  const verifyEmail = useCallback(async (token) => {
    const result = await api.post('/auth/verify-email', { token });
    queryClient.setQueryData(['auth', 'me'], { user: result.user });
    return result.user;
  }, [queryClient]);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); }
    finally { queryClient.setQueryData(['auth', 'me'], { user: null }); queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === 'dashboard' }); }
  }, [queryClient]);
  const refreshUser = useCallback(async () => {
    const result = await api.get('/auth/me');
    queryClient.setQueryData(['auth', 'me'], result);
    return result.user;
  }, [queryClient]);
  const value = { user: authQuery.data?.user || null, isLoading: authQuery.isLoading, login, verifyEmail, logout, refreshUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
