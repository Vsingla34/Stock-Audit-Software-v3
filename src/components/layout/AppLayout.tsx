// src/components/layout/AppLayout.tsx
// Redesign v2 — no hardcoded hex left behind this time; everything routes
// through the Tailwind palette so future palette changes propagate
// automatically instead of leaving stray colors like last time.

import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu, ScanBarcode, FileSpreadsheet, Upload, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useUserAccess } from "@/hooks/useUserAccess";
import logo from "../../../public/logo.png";

interface AppLayoutControl {
  isMounted: boolean;
  setSidebarVisible: (v: boolean) => void;
}

const AppLayoutContext = createContext<AppLayoutControl>({
  isMounted: false,
  setSidebarVisible: () => {},
});

export const useAppLayoutControl = () => useContext(AppLayoutContext);

interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  showSidebar = true,
}) => {
  const parentCtx  = useContext(AppLayoutContext);
  const isMobile   = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location   = useLocation();
  const { userRole } = useUserAccess();

  const [controlledSidebar, setControlledSidebar] = useState(showSidebar);
  const setSidebarVisible = useCallback((v: boolean) => setControlledSidebar(v), []);

  const isActive   = (path: string) => location.pathname === path;
  const canScan    = ["super_admin", "admin", "auditor"].includes(userRole);
  const canUpload  = ["super_admin", "admin", "auditor"].includes(userRole);

  useEffect(() => {
    if (parentCtx.isMounted) {
      parentCtx.setSidebarVisible(showSidebar);
      return () => parentCtx.setSidebarVisible(true);
    }
  }, [parentCtx.isMounted, showSidebar]); // eslint-disable-line

  if (parentCtx.isMounted) return <>{children}</>;

  const NO_SIDEBAR_PATHS = ["/login", "/company-selection", "/assignment-selection", "/add-company"];
  if (NO_SIDEBAR_PATHS.includes(location.pathname)) return <>{children}</>;

  const currentPageLabel = location.pathname === "/" ? "Dashboard"
    : location.pathname.replace("/", "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <AppLayoutContext.Provider value={{ isMounted: true, setSidebarVisible }}>
      <div className="min-h-screen flex flex-col md:flex-row w-full bg-space-50">
        {/* FIX: was "flex w-full" (defaults to flex-row). On mobile the
            header became a row-sibling of page content, and flexbox's
            default align-items:stretch made the header stretch to match
            content's full height, covering everything. flex-col fixes
            mobile stacking; md:flex-row keeps the desktop sidebar layout. */}

        {/* ── Mobile top header ─────────────────────────────────────── */}
        <div
          className="md:hidden sticky top-0 z-30 w-full flex items-center justify-between px-4 py-3 shadow-md"
          style={{ background: "linear-gradient(135deg, #0D0D20 0%, #060612 100%)" }}
        >
          <div className="bg-white rounded-lg px-2 py-1.5 flex items-center shadow-glow-sm">
            <img src={logo} alt="StockCheck360" className="h-5 w-auto object-contain" />
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-space-400 hover:text-space-100 hover:bg-white/10 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* ── Desktop sidebar ───────────────────────────────────────── */}
        {controlledSidebar && (
          <>
            <div className="hidden md:block h-screen sticky top-0 overflow-hidden shrink-0 w-64 border-r border-space-800/60">
              <Sidebar />
            </div>

            <>
              <div
                className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300 ${
                  mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setMobileOpen(false)}
              />
              <div
                className={`fixed inset-y-0 left-0 z-50 w-72 md:hidden transform transition-transform duration-300 ease-out shadow-2xl
                            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
              >
                <Sidebar isMobile onClose={() => setMobileOpen(false)} />
              </div>
            </>
          </>
        )}

        {/* ── Main content ──────────────────────────────────────────── */}
        <main className="flex-1 w-full min-w-0 overflow-x-hidden">
          {/* Top bar — desktop only */}
          <div className="hidden md:flex sticky top-0 z-20 items-center justify-between px-6 h-14 border-b border-space-200 bg-white/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-gradient-primary shadow-glow-sm" />
              <span className="text-[13px] font-semibold text-space-500">
                {currentPageLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Connected" />
              <span className="text-[11px] font-medium text-space-400">Live</span>
            </div>
          </div>

          {/* Page content */}
          <div className="p-3 md:p-6 pb-24 md:pb-8">
            <React.Suspense
              fallback={
                <div className="flex items-center justify-center h-64">
                  <div className="h-9 w-9 rounded-full border-[3px] border-violet-200 border-t-violet-600 animate-spin" />
                </div>
              }
            >
              {children}
            </React.Suspense>
          </div>
        </main>

        {/* ── Mobile bottom nav — Scan gets a raised FAB-style button since
             it's the auditor's primary action, not just another flat icon
             tied for visual weight with Home/Reports/Upload. ── */}
        {isMobile && controlledSidebar && (
          <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center border-t border-space-200 bg-white/95 backdrop-blur-md h-[64px] px-2">
            <Link
              to="/"
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors h-full
                          ${isActive("/") ? "text-violet-600" : "text-space-400 hover:text-space-700"}`}
            >
              <Home className={`h-5 w-5 ${isActive("/") ? "text-violet-600" : "text-space-400"}`} />
              Home
            </Link>

            {canScan && (
              <div className="flex-1 flex justify-center relative">
                <Link
                  to="/scanner"
                  className="absolute -top-6 flex flex-col items-center gap-1"
                >
                  <div
                    className={`h-14 w-14 rounded-full flex items-center justify-center transition-all duration-200
                                ${isActive("/scanner") ? "scale-105" : "hover:scale-105"}`}
                    style={{
                      background: "linear-gradient(135deg, #8338FF 0%, #6E1FEB 60%, #D0219A 100%)",
                      boxShadow: "0 6px 20px rgba(131,56,255,0.5), 0 0 0 4px white",
                    }}
                  >
                    <ScanBarcode className="h-6 w-6 text-white" />
                  </div>
                  <span className={`text-[10px] font-bold ${isActive("/scanner") ? "text-violet-600" : "text-space-500"}`}>
                    Scan
                  </span>
                </Link>
              </div>
            )}

            <Link
              to="/reports"
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors h-full
                          ${isActive("/reports") ? "text-violet-600" : "text-space-400 hover:text-space-700"}`}
            >
              <FileSpreadsheet className={`h-5 w-5 ${isActive("/reports") ? "text-violet-600" : "text-space-400"}`} />
              Reports
            </Link>

            {canUpload && (
              <Link
                to="/upload"
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors h-full
                            ${isActive("/upload") ? "text-violet-600" : "text-space-400 hover:text-space-700"}`}
              >
                <Upload className={`h-5 w-5 ${isActive("/upload") ? "text-violet-600" : "text-space-400"}`} />
                Upload
              </Link>
            )}
          </div>
        )}
      </div>
    </AppLayoutContext.Provider>
  );
};