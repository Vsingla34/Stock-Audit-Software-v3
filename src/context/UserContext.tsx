import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "super_admin" | "admin" | "auditor" | "client";

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

  // REMOVED: useCompany dependency to prevent circular loops
  
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
    
    // Note: Company context will auto-reset because we clear sessionStorage on logout
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      // 1. Clear State
      setCurrentUser(null);
      setIsAuthenticated(false);

      // 2. Clear Storage (This handles clearing the Company Selection indirectly)
      localStorage.clear();
      sessionStorage.clear();

      // 3. HARD REDIRECT
      // This forces the browser to reload the page, guaranteeing that no 
      // old React components try to render with null user data.
      window.location.href = '/login';
    }
  };

  const hasPermission = (permission: string) => {
    if (!currentUser) return false;

    switch (permission) {
      case "manageCompanies":
        return currentUser.role === "super_admin";
      case "manageUsers":
        return currentUser.role === "super_admin" || currentUser.role === "admin";
      case "conductAudits":
        return ["super_admin", "admin", "auditor"].includes(currentUser.role);
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