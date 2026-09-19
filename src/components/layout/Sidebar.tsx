// src/components/layout/Sidebar.tsx
// Redesign v2 — Electric Violet + Deep Space. Bold, not boring:
// gradient active states with glow, floating background orbs, real motion.

import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUserAccess } from "@/hooks/useUserAccess";
import {
  BarChart3, FileSpreadsheet, Home, Search, UserCircle,
  ScanBarcode, LogOut, Upload, ListChecks, History,
  ArrowLeftRight, ChevronRight, Building2, Sparkles,
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

// ── Nav item — gradient glow when active ──────────────────────────────────
const NavItem = ({
  href, icon: Icon, label, active, onClick, badge,
}: {
  href: string; icon: any; label: string; active: boolean;
  onClick?: () => void; badge?: number;
}) => (
  <Link
    to={href}
    onClick={onClick}
    className={`group relative flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl text-[13px] font-medium
                transition-all duration-200 overflow-hidden
                ${active
                  ? "text-white shadow-[0_4px_20px_rgba(131,56,255,0.5)]"
                  : "text-space-400 hover:text-space-100 hover:bg-white/[0.06]"
                }`}
    style={active ? {
      background: "linear-gradient(135deg, #8338FF 0%, #6E1FEB 60%, #B0219A 100%)",
    } : undefined}
  >
    {active && (
      <div className="absolute inset-0 opacity-30 animate-pulse-glow"
           style={{ background: "radial-gradient(circle at 30% 50%, rgba(255,255,255,0.4), transparent 70%)" }} />
    )}
    <Icon
      strokeWidth={active ? 2.25 : 1.75}
      className={`h-[17px] w-[17px] shrink-0 relative z-10 transition-transform duration-200
                  ${active ? "scale-110" : "group-hover:scale-105 text-space-500 group-hover:text-violet-300"}`}
    />
    <span className="flex-1 truncate tracking-tight relative z-10">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full
                       bg-white/20 text-white text-[10px] font-bold px-1 relative z-10">
        {badge}
      </span>
    )}
    {active && <ChevronRight className="h-3.5 w-3.5 text-white/70 relative z-10 shrink-0" />}
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

  const roleBadgeClass: Record<string, string> = {
    super_admin: "text-violet-300 border-violet-400/40 bg-violet-500/10",
    admin:       "text-blue-300 border-blue-400/40 bg-blue-500/10",
    auditor:     "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
    client:      "text-amber-300 border-amber-400/40 bg-amber-500/10",
  };

  const initials = (currentUser?.name || "U")
    .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0D0D20 0%, #060612 100%)" }}
    >
      {/* ── Floating decorative orbs ─────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute -top-20 -right-16 w-56 h-56 rounded-full opacity-40 animate-float"
          style={{ background: "radial-gradient(circle, rgba(131,56,255,0.35) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-32 -left-20 w-48 h-48 rounded-full opacity-30 animate-float"
          style={{ background: "radial-gradient(circle, rgba(208,33,154,0.3) 0%, transparent 70%)", animationDelay: "2s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative z-10 flex h-full flex-col">

        {/* ── Header / Logo ──────────────────────────────────────────── */}
        <div className="px-5 py-6">
          <div className="bg-white rounded-xl px-3 py-2.5 flex items-center justify-center shadow-[0_4px_20px_rgba(131,56,255,0.25)]">
            <img
              src={logo}
              alt="StockCheck360"
              className="w-full h-auto max-w-[160px] object-contain"
            />
          </div>
        </div>

        {/* ── User card — glass, glowing avatar ────────────────────────── */}
        <div className="mx-4 mb-5 p-3 rounded-xl glass-card">
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-[13px] text-white shadow-[0_0_16px_rgba(131,56,255,0.6)]"
              style={{ background: "linear-gradient(135deg, #8338FF, #D0219A)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-space-100 truncate">
                {currentUser?.name || "User"}
              </p>
              <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-px rounded-full border ${roleBadgeClass[userRole] || roleBadgeClass.auditor}`}>
                {userRoleDisplay()}
              </span>
            </div>
          </div>
          {currentCompanyName && (
            <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-space-500 shrink-0" />
              <p className="text-[11px] text-space-400 truncate">{currentCompanyName}</p>
            </div>
          )}
        </div>

        {/* ── Navigation ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4">
          <div className="mb-5">
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-space-600 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-violet-500" />
              Workspace
            </p>
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
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-space-600">
              Actions
            </p>
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

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => { handleLinkClick(); navigate("/assignment-selection"); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[12px] font-medium text-space-400 hover:text-space-100 hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
              Exit Assignment
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[12px] font-medium text-space-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}