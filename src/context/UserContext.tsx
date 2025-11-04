import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// User profile structure from your database
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'auditor' | 'client';
  assignedLocations?: string[];
  assignedCompanies?: string[]; // NEW
}

// Defines what the context will provide
interface UserContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  users: UserProfile[];
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  createUser: (userData: Omit<UserProfile, 'id'>, pass: string) => Promise<void>;
  updateUser: (profileData: UserProfile) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllUsers = useCallback(async (userRole: string | undefined) => {
    if (userRole !== 'admin') {
      setUsers([]);
      return;
    }
    try {
      const { data, error } = await supabase.from('user_profiles').select('id, email, name, role, assigned_locations');
      if (error) throw error;

      const mappedUsers = data.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        assignedLocations: user.assigned_locations,
      }));

      setUsers(mappedUsers as UserProfile[]);

    } catch (error) {
      console.error("Error fetching all users:", error);
    }
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("id, email, name, role, assigned_locations")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          const mappedProfile: UserProfile = {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role,
            assignedLocations: profile.assigned_locations,
          };
          
          setCurrentUser(mappedProfile);
          setIsAuthenticated(true);
          await fetchAllUsers(mappedProfile.role);
        } else {
          await supabase.auth.signOut();
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          fetchSession();
        }
        if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setIsAuthenticated(false);
          setUsers([]);
          setLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchAllUsers]);

  const login = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const createUser = async (userData: Omit<UserProfile, 'id'>, pass: string) => {
    // Use the admin_create_user function instead of auth.signUp
    // This prevents auto-login of the newly created user
    const { data, error } = await supabase.rpc('admin_create_user', {
      p_email: userData.email,
      p_password: pass,
      p_name: userData.name,
      p_role: userData.role,
      p_assigned_locations: userData.assignedLocations || []
    });

    if (error) throw new Error(error.message);
    if (!data) throw new Error("User not created successfully.");
    
    // Refresh the users list
    await fetchAllUsers(currentUser?.role);
  };

  const updateUser = async (profileData: UserProfile) => {
    // Use the admin_update_user function
    const { error } = await supabase.rpc('admin_update_user', {
      p_user_id: profileData.id,
      p_email: profileData.email,
      p_name: profileData.name,
      p_role: profileData.role,
      p_assigned_locations: profileData.assignedLocations || []
    });

    if (error) throw new Error(error.message);

    // Update local state
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === profileData.id ? profileData : user
      )
    );

    if (currentUser?.id === profileData.id) {
      setCurrentUser(profileData);
    }
  };

  const deleteUser = async (userId: string) => {
    console.log('Attempting to delete user:', userId);
    
    // Use the admin_delete_user function
    const { error } = await supabase.rpc('admin_delete_user', {
      p_user_id: userId
    });

    console.log('RPC response - error:', error);

    if (error) {
      console.error('Delete user error:', error);
      throw new Error(error.message);
    }

    // Update local state after successful deletion
    setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
  };

  const hasPermission = (permission: string) => {
    if (!currentUser) return false;
    switch (permission) {
      case 'manageUsers': return currentUser.role === 'admin';
      case 'conductAudits': return ['admin', 'auditor'].includes(currentUser.role);
      default: return false;
    }
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        users,
        loading,
        login,
        logout,
        createUser,
        updateUser,
        deleteUser,
        hasPermission,
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