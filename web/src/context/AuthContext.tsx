import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { api, tokenStore } from "@/lib/api";
import type { AuthUser, ApiEnvelope, LoginResponse } from "@/types";

const USER_KEY = "hrp.user";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
  hasPermission: (...perms: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  // On mount: if we have a token but the stored user is stale, refresh it.
  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get<ApiEnvelope<AuthUser>>("/auth/me");
        if (active && res.data?.data) {
          setUser(res.data.data);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data.data));
        }
      } catch {
        // token invalid / endpoint unavailable — keep any cached user
      } finally {
        if (active) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<ApiEnvelope<LoginResponse>>("/auth/login", {
      username,
      password
    });

    const payload = res.data.data;
    tokenStore.set(payload.tokens.accessToken, payload.tokens.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    setUser(payload.user);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<ApiEnvelope<AuthUser>>("/auth/me");
      if (res.data?.data) {
        setUser(res.data.data);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.data));
      }
    } catch {
      // ignore — keep current user
    }
  }, []);

  const logout = useCallback(() => {
    const refreshToken = tokenStore.refresh;

    if (refreshToken) {
      api.post("/auth/logout", { refreshToken }).catch(() => undefined);
    }

    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: string[]) => !!user && roles.some((r) => user.roles?.includes(r)),
    [user]
  );

  const hasPermission = useCallback(
    (...perms: string[]) => !!user && perms.some((p) => user.permissions?.includes(p)),
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser, hasRole, hasPermission }),
    [user, loading, login, logout, refreshUser, hasRole, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}