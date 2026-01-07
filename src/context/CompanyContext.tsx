import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

interface CompanyContextType {
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  selectedAssignmentId: number | null;
  setSelectedAssignmentId: (id: number | null) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
    return sessionStorage.getItem("selectedCompanyId");
  });
  
  const [selectedAssignmentId, setSelectedAssignmentIdState] = useState<number | null>(() => {
    const stored = sessionStorage.getItem("selectedAssignmentId");
    return stored ? parseInt(stored) : null;
  });

  // Persist to Session Storage
  useEffect(() => {
    if (selectedCompanyId) {
      sessionStorage.setItem("selectedCompanyId", selectedCompanyId);
    } else {
      sessionStorage.removeItem("selectedCompanyId");
    }
  }, [selectedCompanyId]);

  // NEW: Listen for Auth Changes to self-clean
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setSelectedCompanyId(null);
        setSelectedAssignmentIdState(null);
        sessionStorage.removeItem("selectedCompanyId");
        sessionStorage.removeItem("selectedAssignmentId");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setSelectedAssignmentId = (id: number | null) => {
    setSelectedAssignmentIdState(id);
    if (id) {
      sessionStorage.setItem("selectedAssignmentId", id.toString());
    } else {
      sessionStorage.removeItem("selectedAssignmentId");
    }
  };

  return (
    <CompanyContext.Provider
      value={{ 
        selectedCompanyId, 
        setSelectedCompanyId,
        selectedAssignmentId,
        setSelectedAssignmentId
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within a CompanyProvider");
  return ctx;
};