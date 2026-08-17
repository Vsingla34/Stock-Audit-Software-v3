import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu, ScanBarcode, FileSpreadsheet, Upload, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { useUserAccess } from "@/hooks/useUserAccess";

// ─── Persistent Layout Context ────────────────────────────────────────────────
//
// When App.tsx mounts ONE persistent <AppLayout> outside of <Routes>,
// every page's own <AppLayout> detects it is already mounted and becomes
// transparent (just renders children).  Pages that need showSidebar={false}
// signal that preference upward through this context — no page file needs
// to change.

interface AppLayoutControl {
  /** true when a persistent AppLayout is already mounted above in the tree */
  isMounted: boolean;
  /** Pages call this to override sidebar visibility for their route */
  setSidebarVisible: (v: boolean) => void;
}

const AppLayoutContext = createContext<AppLayoutControl>({
  isMounted: false,
  setSidebarVisible: () => {},
});

export const useAppLayoutControl = () => useContext(AppLayoutContext);

// ─────────────────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  showSidebar = true,
}) => {
  const parentCtx = useContext(AppLayoutContext);

  // Hooks must be called unconditionally
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { userRole } = useUserAccess();

  const isActive = (path: string) => location.pathname === path;
  const canScan   = ["super_admin", "admin", "auditor"].includes(userRole);
  const canUpload = ["super_admin", "admin", "auditor"].includes(userRole);

  // ── Inner AppLayout (transparent mode) ─────────────────────────────────
  // If a persistent AppLayout is already above us in the tree, become
  // transparent: signal sidebar preference and just render children.
  useEffect(() => {
    if (parentCtx.isMounted) {
      parentCtx.setSidebarVisible(showSidebar);
      // Restore default when this page unmounts
      return () => parentCtx.setSidebarVisible(true);
    }
  }, [parentCtx.isMounted, showSidebar]); // eslint-disable-line

  // ── Outer AppLayout state ────────────────────────────────────────────────
  // controlledSidebar is updated by inner page AppLayouts via context
  // (e.g. pages that pass showSidebar={false})
  const [controlledSidebar, setControlledSidebar] = useState(showSidebar);

  const setSidebarVisible = useCallback((v: boolean) => {
    setControlledSidebar(v);
  }, []);

  if (parentCtx.isMounted) {
    return <>{children}</>;
  }

  // ── Outer AppLayout (full render) ────────────────────────────────────────
  // Only reaches here when used as the persistent wrapper in App.tsx.
  // This is what actually renders the sidebar; it is NEVER unmounted.

  // Pages that should have NO sidebar (login, company/assignment selection, add company).
  // On these routes the persistent outer AppLayout renders children directly
  // with no sidebar wrapper — exactly as if AppLayout were not there.
  const NO_SIDEBAR_PATHS = [
    "/login",
    "/company-selection",
    "/assignment-selection",
    "/add-company",
  ];
  if (NO_SIDEBAR_PATHS.includes(location.pathname)) {
    return <>{children}</>;
  }
  // Inner page AppLayouts become transparent (above) so there's no double sidebar.

  return (
    <AppLayoutContext.Provider value={{ isMounted: true, setSidebarVisible }}>
      <div className="min-h-screen flex w-full flex-col md:flex-row bg-gray-50">

        {/* MOBILE TOP HEADER */}
        <div className="md:hidden sticky top-0 z-30 w-full flex items-center justify-between px-4 py-3 bg-indigo-600 text-white shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight">StockCheck360</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="text-white hover:bg-indigo-700 hover:text-white -mr-2"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        {/* SIDEBAR */}
        {controlledSidebar && (
          <>
            {/* Desktop sidebar — sticky, never re-mounts */}
            <div className="hidden md:block h-screen sticky top-0 overflow-hidden shrink-0 w-64 border-r border-indigo-500 bg-indigo-600">
              <Sidebar />
            </div>

            {/* Mobile drawer */}
            <div
              className={`fixed inset-0 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
                mobileOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="relative z-50 h-full w-64 shadow-2xl bg-indigo-600">
                <Sidebar isMobile={true} onClose={() => setMobileOpen(false)} />
              </div>
              <div
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
                  mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setMobileOpen(false)}
              />
            </div>
          </>
        )}

        {/* MAIN CONTENT — Suspense here so sidebar is already painted */}
        <main className="flex-1 w-full max-w-[100vw] overflow-x-hidden p-4 md:p-6 min-h-[calc(100vh-60px)] md:min-h-screen pb-24 md:pb-6">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
              </div>
            }
          >
            {children}
          </React.Suspense>
        </main>

        {/* MOBILE BOTTOM NAV */}
        {isMobile && controlledSidebar && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex justify-around items-center h-16 pb-safe safe-area-inset-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <Link
              to="/"
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive("/") ? "text-indigo-600" : "text-gray-500 hover:text-indigo-500"
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="text-[10px] font-medium">Home</span>
            </Link>

            {canScan && (
              <Link
                to="/scanner"
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive("/scanner") ? "text-indigo-600" : "text-gray-500 hover:text-indigo-500"
                }`}
              >
                <ScanBarcode className="h-5 w-5" />
                <span className="text-[10px] font-medium">Scan</span>
              </Link>
            )}

            <Link
              to="/reports"
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive("/reports") ? "text-indigo-600" : "text-gray-500 hover:text-indigo-500"
              }`}
            >
              <FileSpreadsheet className="h-5 w-5" />
              <span className="text-[10px] font-medium">Reports</span>
            </Link>

            {canUpload && (
              <Link
                to="/upload"
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive("/upload") ? "text-indigo-600" : "text-gray-500 hover:text-indigo-500"
                }`}
              >
                <Upload className="h-5 w-5" />
                <span className="text-[10px] font-medium">Upload</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </AppLayoutContext.Provider>
  );
};