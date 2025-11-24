
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface CompanyContextType {
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
    return sessionStorage.getItem("selectedCompanyId");
  });

  useEffect(() => {
    if (selectedCompanyId) {
      sessionStorage.setItem("selectedCompanyId", selectedCompanyId);
    } else {
      sessionStorage.removeItem("selectedCompanyId");
    }
  }, [selectedCompanyId]);

  return (
    <CompanyContext.Provider
      value={{ selectedCompanyId, setSelectedCompanyId }}
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
