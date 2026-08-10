// Fix 1.7: The cached role in localStorage is now used ONLY for
// offline UX (instant paint on slow connections). It never gates data access —
// all data access is enforced by RLS (Phase 1.5) on the server.

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "auditor" | "client";
  assigned_companies: string[] | null;
}

interface UserContextType {
  user: User | null;
  currentUser: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const CACHE_KEY = "offline_user_profile";

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        if (!currentUser || currentUser.id !== session.user.id) {
          fetchUserProfile(session.user.id);
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem(CACHE_KEY);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // ── Fix 1.7: Only use the cache for offline scenarios ──────────────
      // Cache is NEVER the source of truth for permissions.
      // It's purely a UX convenience to avoid blank screens on slow connections.
      if (!navigator.onLine) {
        const cachedProfile = localStorage.getItem(CACHE_KEY);
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            if (parsed.id === userId) {
              setCurrentUser(parsed);
              // Still let setLoading(false) run in finally
            }
          } catch {
            localStorage.removeItem(CACHE_KEY);
          }
        }
        // Don't attempt network fetch when offline
        return;
      }

      // ── Always fetch fresh profile from server when online ─────────────
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, name, role, assigned_companies")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        // Fall back to cache on transient network error, but log it
        const cachedProfile = localStorage.getItem(CACHE_KEY);
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            if (parsed.id === userId) setCurrentUser(parsed);
          } catch {
            localStorage.removeItem(CACHE_KEY);
          }
        }
      } else {
        // Server is the source of truth — always update state and cache
        setCurrentUser(data as UserProfile);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.error("Unexpected error fetching user profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setCurrentUser(null);
    localStorage.removeItem(CACHE_KEY);
    toast.success("Logged out successfully");
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        currentUser,
        session,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};