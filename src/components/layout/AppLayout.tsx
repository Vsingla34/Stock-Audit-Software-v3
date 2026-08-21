// src/components/layout/AppLayout.tsx
// Updated for dark sidebar design system

import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu, ScanBarcode, FileSpreadsheet, Upload, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useUserAccess } from "@/hooks/useUserAccess";

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

  // No-sidebar routes
  const NO_SIDEBAR_PATHS = ["/login", "/company-selection", "/assignment-selection", "/add-company"];
  if (NO_SIDEBAR_PATHS.includes(location.pathname)) return <>{children}</>;

  return (
    <AppLayoutContext.Provider value={{ isMounted: true, setSidebarVisible }}>
      <div className="min-h-screen flex w-full" style={{ backgroundColor: "#F8FAFC" }}>

        {/* ── Mobile top header ─────────────────────────────────────── */}
        <div
          className="md:hidden sticky top-0 z-30 w-full flex items-center justify-between px-4 py-3 shadow-sm"
          style={{ backgroundColor: "#0F172A" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">SC</span>
            </div>
            <span className="text-sm font-semibold text-slate-100">StockCheck360</span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* ── Desktop sidebar ───────────────────────────────────────── */}
        {controlledSidebar && (
          <>
            <div
              className="hidden md:block h-screen sticky top-0 overflow-hidden shrink-0 w-64"
              style={{ backgroundColor: "#0F172A", borderRight: "1px solid #1E293B" }}
            >
              <Sidebar />
            </div>

            {/* Mobile drawer */}
            <>
              {/* Backdrop */}
              <div
                className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300 ${
                  mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setMobileOpen(false)}
              />
              {/* Drawer */}
              <div
                className={`fixed inset-y-0 left-0 z-50 w-72 md:hidden transform transition-transform duration-300 ease-out shadow-2xl
                            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
                style={{ backgroundColor: "#0F172A" }}
              >
                <Sidebar isMobile onClose={() => setMobileOpen(false)} />
              </div>
            </>
          </>
        )}

        {/* ── Main content ──────────────────────────────────────────── */}
        <main className="flex-1 w-full min-w-0 overflow-x-hidden">
          {/* Top bar — desktop only */}
          <div
            className="hidden md:flex sticky top-0 z-20 items-center justify-between
                       px-6 h-14 border-b"
            style={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0" }}
          >
            {/* Breadcrumb area — pages can inject content here via context if needed */}
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "#7C3AED" }}
              />
              <span className="text-[13px] font-medium text-slate-500">
                {location.pathname === "/" ? "Dashboard"
                  : location.pathname.replace("/", "").replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full bg-emerald-500"
                title="Connected"
              />
              <span className="text-[11px] text-slate-400">Live</span>
            </div>
          </div>

          {/* Page content */}
          <div className="p-4 md:p-6 pb-24 md:pb-8">
            <React.Suspense
              fallback={
                <div className="flex items-center justify-center h-64">
                  <div
                    className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "#7C3AED", borderTopColor: "transparent" }}
                  />
                </div>
              }
            >
              {children}
            </React.Suspense>
          </div>
        </main>

        {/* ── Mobile bottom nav ─────────────────────────────────────── */}
        {isMobile && controlledSidebar && (
          <div
            className="fixed bottom-0 left-0 right-0 z-40 flex border-t"
            style={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", height: "60px" }}
          >
            {[
              { to: "/",        icon: Home,          label: "Home",    show: true },
              { to: "/scanner", icon: ScanBarcode,   label: "Scan",    show: canScan },
              { to: "/reports", icon: FileSpreadsheet,label: "Reports", show: true },
              { to: "/upload",  icon: Upload,        label: "Upload",  show: canUpload },
            ]
              .filter((i) => i.show)
              .map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors
                              ${isActive(item.to)
                                ? "text-violet-600"
                                : "text-slate-400 hover:text-slate-700"}`}
                >
                  <item.icon
                    className={`h-5 w-5 ${isActive(item.to) ? "text-violet-600" : "text-slate-400"}`}
                  />
                  {item.label}
                </Link>
              ))}
          </div>
        )}
      </div>
    </AppLayoutContext.Provider>
  );
};