// src/context/UserContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/context/CompanyContext";

export type UserRole = "admin" | "auditor" | "client";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  assigned_locations?: string[];
  assigned_companies?: string[];
}

interface UserContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // 🔴 important: we will clear this on logout
  const { setSelectedCompanyId } = useCompany();

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setLoading(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from("user_profiles")
          .select("id, email, name, role, assigned_locations, assigned_companies")
          .eq("id", session.user.id)
          .single();

        if (error || !profile) {
          setIsAuthenticated(false);
          setCurrentUser(null);
        } else {
          setCurrentUser(profile as UserProfile);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("No user received from Supabase.");

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, email, name, role, assigned_locations, assigned_companies")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) throw profileError || new Error("Profile not found");

    setCurrentUser(profile as UserProfile);
    setIsAuthenticated(true);

    // ✅ Optional: also clear previous company on fresh login
    //    (ensures a *new* selection each time user logs in)
    setSelectedCompanyId(null);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAuthenticated(false);

    // ✅ CRITICAL: force company reselection after EVERY logout
    setSelectedCompanyId(null);
  };

  const hasPermission = (permission: string) => {
    if (!currentUser) return false;

    switch (permission) {
      case "manageUsers":
        return currentUser.role === "admin";
      case "conductAudits":
        return currentUser.role === "admin" || currentUser.role === "auditor";
      default:
        return true;
    }
  };

  const refreshProfile = async () => {
    if (!currentUser) return;
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("id, email, name, role, assigned_locations, assigned_companies")
      .eq("id", currentUser.id)
      .single();

    if (!error && profile) {
      setCurrentUser(profile as UserProfile);
    }
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        loading,
        login,
        logout,
        hasPermission,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a UserProvider");
  return ctx;
};
