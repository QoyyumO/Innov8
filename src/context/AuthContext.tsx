"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Id } from "../../convex/_generated/dataModel";

export type UserRole =
  | "doctor"
  | "nurse"
  | "pharmacist"
  | "laboratory"
  | "hospital_admin"
  | "system_admin"
  | "security_officer"
  | "patient";

export interface User {
  _id: Id<"users">;
  email: string;
  roles: UserRole[];
  hospital: string;
  department?: string;
  accountStatus: "active" | "suspended";
  profile: {
    firstName: string;
    lastName: string;
    middleName?: string;
  };
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  sessionToken: string | null;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasAllRoles: (roles: UserRole[]) => boolean;
}

const SESSION_KEY = "innov8_session_token";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setStoredToken(localStorage.getItem(SESSION_KEY));
    setIsInitialized(true);
  }, []);

  const currentUser = useQuery(
    api.auth.getCurrentUser,
    storedToken ? { token: storedToken } : "skip",
  );
  const loginMutation = useMutation(api.auth.login);
  const logoutMutation = useMutation(api.auth.logout);

  const { isAuthenticated, user } = useMemo(() => {
    if (!storedToken || currentUser === undefined || currentUser === null) {
      return { isAuthenticated: false, user: null as User | null };
    }

    return {
      isAuthenticated: true,
      user: currentUser as User,
    };
  }, [currentUser, storedToken]);

  const shouldClearToken = storedToken !== null && currentUser === null;

  useEffect(() => {
    if (shouldClearToken) {
      localStorage.removeItem(SESSION_KEY);
      setStoredToken(null);
    }
  }, [shouldClearToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const result = await loginMutation({ email, password });
        if (result.success && result.token) {
          localStorage.setItem(SESSION_KEY, result.token);
          setStoredToken(result.token);
          return {
            success: true,
            user: {
              _id: result._id,
              email: result.email,
              roles: result.roles as UserRole[],
              hospital: result.hospital,
              department: result.department,
              accountStatus: result.accountStatus,
              profile: result.profile,
            },
          };
        }
        return { success: false, error: "Login failed" };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An error occurred during login";
        return { success: false, error: errorMessage };
      }
    },
    [loginMutation],
  );

  const logout = useCallback(async () => {
    try {
      if (storedToken) {
        try {
          await logoutMutation({ token: storedToken });
        } catch (error) {
          console.error("Error invalidating session on server:", error);
        }
      }
      localStorage.removeItem(SESSION_KEY);
      setStoredToken(null);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  }, [logoutMutation, storedToken]);

  const hasRole = useCallback(
    (role: UserRole) => user?.roles.includes(role) ?? false,
    [user],
  );
  const hasAnyRole = useCallback(
    (roles: UserRole[]) =>
      user ? roles.some((role) => user.roles.includes(role)) : false,
    [user],
  );
  const hasAllRoles = useCallback(
    (roles: UserRole[]) =>
      user ? roles.every((role) => user.roles.includes(role)) : false,
    [user],
  );

  const isLoading =
    !isInitialized || (storedToken !== null && currentUser === undefined);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        sessionToken: storedToken,
        login,
        logout,
        hasRole,
        hasAnyRole,
        hasAllRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
