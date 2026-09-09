import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null | undefined;
  isLoading: boolean;
  setupRequired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  const setupQuery = useQuery({
    queryKey: ["auth", "setup-required"],
    queryFn: () => api.auth.setupRequired(),
    enabled: meQuery.data === null,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.auth.login(email, password),
    onSuccess: (user) => qc.setQueryData(["auth", "me"], user),
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.auth.register(email, password),
    onSuccess: (user) => qc.setQueryData(["auth", "me"], user),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      qc.setQueryData(["auth", "me"], null);
      qc.clear();
    },
  });

  const value: AuthContextValue = {
    user: meQuery.data,
    isLoading: meQuery.isLoading,
    setupRequired: setupQuery.data?.setupRequired ?? false,
    login: async (email, password) => { await loginMutation.mutateAsync({ email, password }); },
    register: async (email, password) => { await registerMutation.mutateAsync({ email, password }); },
    logout: async () => { await logoutMutation.mutateAsync(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
