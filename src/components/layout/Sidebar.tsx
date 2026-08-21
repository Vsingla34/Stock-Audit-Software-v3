// src/components/layout/Sidebar.tsx
import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUserAccess } from "@/hooks/useUserAccess";
import {
  BarChart3, FileSpreadsheet, Home, Search, UserCircle,
  ScanBarcode, LogOut, Upload, ListChecks, History,
  ArrowLeftRight, X, ChevronRight, Building2,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useCompany } from "@/context/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import logo from "../../../public/logo.png";

const companyNameCache: Record<string, string> = {};

interface SidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

// ── Strict, Minimalist Nav Item ───────────────────────────────────────────────
const NavItem = ({
  href, icon: Icon, label, active, onClick, badge,
}: {
  href: string; icon: any; label: string; active: boolean;
  onClick?: () => void; badge?: number;
}) => (
  <Link
    to={href}
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2 mb-0.5 rounded-md text-[13px] font-medium 
                transition-colors duration-150 outline-none
                ${active
                  ? "bg-slate-800/80 text-slate-100"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
  >
    <Icon
      strokeWidth={active ? 2 : 1.5}
      className={`h-[16px] w-[16px] shrink-0
                  ${active ? "text-indigo-400" : "text-slate-500"}`}
    />
    
    <span className="flex-1 truncate tracking-tight">{label}</span>
    
    {badge !== undefined && badge > 0 && (
      <span className="ml-auto min-w-[18px] h-4 flex items-center justify-center rounded-sm
                       bg-slate-700 text-slate-200 text-[10px] font-medium px-1">
        {badge}
      </span>
    )}
  </Link>
);

// ── Main component ────────────────────────────────────────────────────────────
export function Sidebar({ isMobile, onClose }: SidebarProps) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { isAuthenticated, logout, currentUser } = useUser();
  const { accessibleLocations, userRole, userRoleDisplay } = useUserAccess();
  const { selectedCompanyId } = useCompany();

  const [currentCompanyName, setCurrentCompanyName] = useState<string | null>(null);

  const fetchCompanyName = useCallback(async () => {
    if (!selectedCompanyId) { setCurrentCompanyName(null); return; }
    const cached = companyNameCache[selectedCompanyId];
    if (cached) { setCurrentCompanyName(cached); return; }
    try {
      const { data } = await supabase
        .from("companies").select("name").eq("id", selectedCompanyId).single();
      const name = data?.name || null;
      if (name) companyNameCache[selectedCompanyId] = name;
      setCurrentCompanyName(name);
    } catch { setCurrentCompanyName(null); }
  }, [selectedCompanyId]);

  useEffect(() => { fetchCompanyName(); }, [fetchCompanyName]);

  const mainNavigation = useMemo(() => {
    const nav = [{ name: "Dashboard", href: "/", icon: Home }];
    if (userRole !== "client") nav.push({ name: "Search", href: "/search", icon: Search });
    nav.push({ name: "History",  href: "/history",       icon: History });
    if (userRole !== "auditor") nav.push({ name: "Analytics", href: "/analytics", icon: BarChart3 });
    nav.push({ name: "Questionnaire", href: "/questionnaire", icon: ListChecks });
    nav.push({ name: "Profile",  href: "/profile",       icon: UserCircle });
    return nav;
  }, [userRole]);

  const actionNavigation = useMemo(() => {
    const nav: any[] = [];
    if (["super_admin", "admin", "auditor"].includes(userRole))
      nav.push({ name: "Scanner",     href: "/scanner", icon: ScanBarcode });
    nav.push({ name: "Reports",       href: "/reports",  icon: FileSpreadsheet });
    if (["super_admin", "admin", "auditor"].includes(userRole))
      nav.push({ name: "Upload Data", href: "/upload",   icon: Upload });
    return nav;
  }, [userRole]);

  const handleLinkClick = () => { if (isMobile && onClose) onClose(); };
  const handleLogout    = () => { handleLinkClick(); logout(); };

  if (location.pathname === "/login") return null;
  if (!isAuthenticated) return null;

  // Simplified role badges - subtle borders instead of backgrounds
  const roleBadgeClass: Record<string, string> = {
    super_admin: "text-indigo-400 border-indigo-400/30",
    admin:       "text-blue-400 border-blue-400/30",
    auditor:     "text-emerald-400 border-emerald-400/30",
    client:      "text-slate-400 border-slate-400/30",
  };

  return (
    <aside className="relative flex h-full w-full flex-col bg-[#0B0F19] border-r border-slate-800">
      
      {isMobile && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors z-50"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* ── Header / Logo ──────────────────── */}
      <div className="px-5 py-6 border-b border-slate-800/60">
        <div className="bg-white rounded-md px-3 py-2 flex items-center justify-center shadow-sm">
          <img 
            src={logo} 
            alt="StockCheck360" 
            className="w-full h-auto max-w-[160px] object-contain" 
          />
        </div>
      </div>

      {/* ── Navigation Area ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-5">
        <div className="mb-6">
          <p className="px-3 mb-2 text-[11px] font-medium text-slate-500">Workspace</p>
          <nav>
            {mainNavigation.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.name}
                active={location.pathname === item.href}
                onClick={handleLinkClick}
              />
            ))}
          </nav>
        </div>

        <div className="mb-4">
          <p className="px-3 mb-2 text-[11px] font-medium text-slate-500">Actions</p>
          <nav>
            {actionNavigation.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.name}
                active={location.pathname === item.href}
                onClick={handleLinkClick}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* ── Footer / User Profile ──────────────────── */}
      <div className="mt-auto border-t border-slate-800/60 p-4 bg-[#0B0F19]">
        
        {/* Company Context */}
        {currentCompanyName && (
          <div className="mb-3 px-2 py-1.5 rounded border border-slate-800 bg-slate-900/50 flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <p className="text-[11px] text-slate-300 truncate">{currentCompanyName}</p>
          </div>
        )}

        {/* User Details */}
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="h-8 w-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <span className="text-slate-300 text-xs font-medium">
              {currentUser?.name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-slate-200 truncate">{currentUser?.name || "User"}</p>
            <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-px rounded-sm border ${roleBadgeClass[userRole] || roleBadgeClass.auditor}`}>
              {userRoleDisplay()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => { handleLinkClick(); navigate("/assignment-selection"); }}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
            Exit Assignment
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[12px] text-slate-400 hover:text-rose-400 hover:bg-slate-800/50 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}