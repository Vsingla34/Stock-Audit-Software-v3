import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu, ScanBarcode, FileSpreadsheet, Upload, Home } from "lucide-react"; // Added Icons
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom"; // Added for navigation
import { useUserAccess } from "@/hooks/useUserAccess"; // Added for permission checks

interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean; 
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, showSidebar = true }) => {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { userRole } = useUserAccess(); // Check permissions

  // Helper to check active state
  const isActive = (path: string) => location.pathname === path;

  // Permission Logic
  const canScan = ["super_admin", "admin", "auditor"].includes(userRole);
  const canUpload = ["super_admin", "admin", "auditor"].includes(userRole);

  return (
    <div className="min-h-screen flex w-full flex-col md:flex-row bg-gray-50">
        
      {/* === MOBILE TOP HEADER === */}
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

      {/* === SIDEBAR LOGIC (Desktop & Drawer) === */}
      {showSidebar && (
        <>
          {/* DESKTOP SIDEBAR */}
          <div className="hidden md:block h-screen sticky top-0 overflow-hidden shrink-0 w-64 border-r border-indigo-500 bg-indigo-600">
              <Sidebar />
          </div>

          {/* MOBILE SIDEBAR DRAWER */}
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

      {/* === MAIN CONTENT === */}
      {/* Added 'pb-24' to prevent content from being hidden behind the bottom bar on mobile */}
      <main className="flex-1 w-full max-w-[100vw] overflow-x-hidden p-4 md:p-6 min-h-[calc(100vh-60px)] md:min-h-screen pb-24 md:pb-6">
        {children}
      </main>

      {/* === MOBILE BOTTOM NAVIGATION BAR === */}
      {isMobile && showSidebar && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex justify-around items-center h-16 pb-safe safe-area-inset-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            
            {/* 1. Dashboard (Always visible for context) */}
            <Link 
              to="/" 
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive("/") ? "text-indigo-600" : "text-gray-500 hover:text-indigo-500"
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="text-[10px] font-medium">Home</span>
            </Link>

            {/* 2. Scanner (Role Restricted) */}
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

            {/* 3. Reports (Always visible) */}
            <Link 
              to="/reports" 
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive("/reports") ? "text-indigo-600" : "text-gray-500 hover:text-indigo-500"
              }`}
            >
              <FileSpreadsheet className="h-5 w-5" />
              <span className="text-[10px] font-medium">Reports</span>
            </Link>

            {/* 4. Upload (Role Restricted) */}
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
  );
};