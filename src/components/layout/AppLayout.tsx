import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean; 
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, showSidebar = true }) => {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    // Removed <SidebarProvider> to avoid layout conflicts
    <div className="min-h-screen flex w-full flex-col md:flex-row bg-gray-50">
        
      {/* === MOBILE HEADER (Only visible on small screens) === */}
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

      {/* === SIDEBAR LOGIC === */}
      {showSidebar && (
        <>
          {/* DESKTOP SIDEBAR: Strictly hidden on mobile (hidden md:block) */}
          <div className="hidden md:block h-screen sticky top-0 overflow-hidden shrink-0 w-64 border-r border-indigo-500 bg-indigo-600">
              <Sidebar />
          </div>

          {/* MOBILE SIDEBAR: Overlay Drawer */}
          {/* This entire block is only rendered if we are in mobile mode or if screen is small */}
          <div 
            className={`fixed inset-0 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* The Sidebar Itself */}
            <div className="relative z-50 h-full w-64 shadow-2xl bg-indigo-600">
               <Sidebar isMobile={true} onClose={() => setMobileOpen(false)} />
            </div>
            
            {/* Dark Backdrop - Click to close */}
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
      <main className="flex-1 w-full max-w-[100vw] overflow-x-hidden p-4 md:p-6 min-h-[calc(100vh-60px)] md:min-h-screen">
        {children}
      </main>
    </div>
  );
};