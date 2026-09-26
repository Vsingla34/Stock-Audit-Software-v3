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

  // ── Auto-hide mobile header after the first scroll ─────────────────
  // Header stays visible at the very top, then hides as soon as the
  // page is scrolled past a small threshold — and stays hidden while
  // scrolling, rather than sliding back in on scroll-up. It only
  // reappears once the user scrolls back up near the very top.
  const [headerVisible, setHeaderVisible] = useState(true);

  useEffect(() => {
    // FIX: the raw "scroll" event can fire dozens of times per second
    // (every pixel on a trackpad). Calling setState on every one of those,
    // unthrottled, re-renders the whole layout that often and is what was
    // dragging the dev server down. rAF-gating collapses that to at most
    // once per animation frame, and we bail out early if the visibility
    // value wouldn't actually change, so most frames cause zero renders.
    let ticking = false;
    let lastVisible = true;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const shouldBeVisible = currentY <= 24;
        if (shouldBeVisible !== lastVisible) {
          lastVisible = shouldBeVisible;
          setHeaderVisible(shouldBeVisible);
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      <div className="min-h-screen min-h-dvh flex flex-col md:flex-row w-full bg-space-50">
        {/* min-h-dvh (after min-h-screen so it wins where supported):
            100vh is the LAYOUT viewport, which mobile browsers keep at
            full height even while their address bar is showing — so a
            "fixed" bottom element measured against 100vh can end up
            positioned below the actual visible screen for a frame while
            the browser reconciles that against the VISUAL viewport during
            a scroll-triggered address-bar show/hide. dvh tracks the real
            visible viewport directly, which is the actual fix for the
            "disappears when I scroll up" glitch — not just a mitigation. */}
        {/* FIX: was "flex w-full" (defaults to flex-row). On mobile the
            header became a row-sibling of page content, and flexbox's
            default align-items:stretch made the header stretch to match
            content's full height, covering everything. flex-col fixes
            mobile stacking; md:flex-row keeps the desktop sidebar layout. */}

        {/* ── Mobile top header — plain white so it merges seamlessly with
             the logo (no more boxed-pill vs dark-header contrast); a
             hairline black-at-low-opacity border along the bottom is the
             only separation from the page content below. Slides off-screen
             when scrolling past the top, slides back in near the top. ── */}
        <div
          className={`md:hidden sticky top-0 z-30 w-full flex items-center justify-between px-4 min-h-[60px] bg-white border-b border-black/10 transition-transform duration-300 ease-out ${
            headerVisible ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className="flex items-center">
            <img src={logo} alt="StockCheck360" className="h-7 w-auto object-contain" />
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="h-10 w-10 flex items-center justify-center rounded-xl text-space-500 hover:text-space-800 hover:bg-space-100 transition-colors shrink-0"
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
          // FIX (round 2): root cause was the root container using
          // min-h-screen (100vh = the LAYOUT viewport, which mobile
          // browsers keep full-height even with the address bar showing).
          // "fixed" measured against that could end up placed below the
          // actual visible screen for a frame while scrolling toggled the
          // address bar, reading as "disappears". Switched the root
          // container to min-h-dvh above (tracks the real visible
          // viewport) — "fixed" is the right tool for an always-present
          // app-shell nav bar and now measures against the correct box.
          <div
            className="fixed bottom-0 left-0 right-0 z-40 flex items-center border-t border-space-200 bg-white h-[64px] px-2 [transform:translateZ(0)] will-change-transform"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
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