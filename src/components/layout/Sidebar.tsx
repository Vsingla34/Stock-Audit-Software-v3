import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; 
import { useUserAccess } from "@/hooks/useUserAccess";
import {
  BarChart3,
  FileSpreadsheet,
  Home,
  Search,
  UserCircle,
  ScanBarcode,
  LogOut,
  Upload,
  ListChecks,
  Building2,
  History,
  ArrowLeftRight,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/context/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import logo from "../../../public/logo.png";

const companyNameCache: Record<string, string> = {};

export function Sidebar({
  isMobile,
  setMobileOpen,
}: {
  isMobile?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useUser();
  const { accessibleLocations, userRole, userRoleDisplay } = useUserAccess();
  const { selectedCompanyId } = useCompany();

  const [currentCompanyName, setCurrentCompanyName] = useState<string | null>(
    null
  );

  const fetchCompanyName = useCallback(async () => {
    if (!selectedCompanyId) {
      setCurrentCompanyName(null);
      return;
    }

    const cached = companyNameCache[selectedCompanyId];
    if (cached) {
      setCurrentCompanyName(cached);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("companies")
        .select("name")
        .eq("id", selectedCompanyId)
        .single();

      if (error) throw error;

      const name = data?.name || null;
      if (name) {
        companyNameCache[selectedCompanyId] = name;
      }
      setCurrentCompanyName(name);
    } catch (err) {
      console.error("Error fetching current company:", err);
      setCurrentCompanyName(null);
    }
  }, [selectedCompanyId]);
  useEffect(() => {
    fetchCompanyName();
  }, [fetchCompanyName]);

  if (location.pathname === "/login") return null;
  if (!isAuthenticated) return null;

  const navigation = useMemo(() => {
    const nav = [{ name: "Dashboard", href: "/", icon: Home }];
    
    // Scanner: Visible to Super Admin, Admin, Auditor
    if (["super_admin", "admin", "auditor"].includes(userRole)) {
      nav.push({ name: "Scanner", href: "/scanner", icon: ScanBarcode });
    }

    // Search: Hidden for Clients
    if (userRole !== "client") {
      nav.push({ name: "Search", href: "/search", icon: Search });
    }

    // Reports and History: Visible to everyone
    nav.push(
      { name: "Reports", href: "/reports", icon: FileSpreadsheet },
      { name: "History", href: "/history", icon: History }
    );

    // Analytics: Hidden for Auditors
    if (userRole !== "auditor") {
      nav.push({ name: "Analytics", href: "/analytics", icon: BarChart3 });
    }

    nav.push({
      name: "Questionnaire",
      href: "/questionnaire",
      icon: ListChecks,
    });

    if (["super_admin", "admin", "auditor"].includes(userRole)) {
      nav.push({ name: "Upload Data", href: "/upload", icon: Upload });
    }
    
    if (userRole === "super_admin") {
      nav.push({ name: "Company", href: "/add-company", icon: Building2 });
    }
    nav.push({ name: "My Profile", href: "/profile", icon: UserCircle });
    return nav;
  }, [userRole]);

  const handleLogout = () => logout();
  const handleLinkClick = () => {
    if (isMobile && setMobileOpen) setMobileOpen(false);
  };

  return (
    <aside className="flex h-full w-64 flex-col overflow-y-auto border-r border-indigo-500 bg-indigo-600 px-5 py-8 text-white">
      <div className="flex flex-col h-full">
        <div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative p-2 bg-white rounded-lg w-full flex justify-center shadow-sm">
                 <img src={logo} alt="Software Logo" className="h-auto w-32 object-contain" />
              </div>
            </div>

            <div className="bg-indigo-700 rounded-lg p-2.5 shadow-sm ring-1 ring-indigo-500 mx-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-indigo-200 uppercase tracking-wider">
                  Logged in as
                </p>
                <div className="inline-flex items-center rounded-full border border-indigo-400 bg-indigo-800 px-2 py-0.5 text-[10px] font-medium text-white">
                  {userRoleDisplay()}
                </div>
              </div>

              {currentCompanyName && (
                <div className="mt-1.5 pt-1.5 border-t border-indigo-500">
                  <p className="text-xs text-indigo-200 truncate">
                    Company: <span className="font-medium text-white">{currentCompanyName}</span>
                  </p>
                </div>
              )}

              {userRole !== "super_admin" && accessibleLocations.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[10px] text-indigo-300 mb-1">Assigned locations:</p>
                  <div className="max-h-20 overflow-y-auto pr-1 space-y-1">
                    {accessibleLocations.map((loc) => (
                      <div key={loc.id} className="text-[10px] py-0.5 px-2 bg-indigo-800 rounded text-indigo-100 truncate">
                        {loc.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <nav className="flex flex-col space-y-1 mt-6">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleLinkClick}
                  className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white text-indigo-600 shadow-md"
                      : "text-indigo-100 hover:bg-indigo-700 hover:text-white"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 transition-colors ${
                      isActive ? "text-indigo-600" : "text-indigo-300 group-hover:text-white"
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="mt-auto pt-6 border-t border-indigo-500 space-y-2">
          
          <Button
            variant="ghost"
            className="w-full justify-start text-indigo-100 hover:bg-indigo-700 hover:text-white transition-colors"
            onClick={() => navigate("/assignment-selection")}
          >
            <ArrowLeftRight className="mr-3 h-5 w-5" />
            <span>Exit Assignment</span>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start text-indigo-100 hover:bg-indigo-700 hover:text-white transition-colors"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            <span>Log out</span>
          </Button>
          
          <div className="mt-4 px-2 text-center">
            <p className="text-xs text-indigo-300 font-medium">
              &copy; {new Date().getFullYear()} StockCheck360
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}