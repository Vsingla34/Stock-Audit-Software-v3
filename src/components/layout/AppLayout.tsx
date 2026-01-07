import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/layout/Sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean; 
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, showSidebar = true }) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
       
        {showSidebar && <Sidebar />}
        <main className="flex-1 overflow-x-hidden p-4">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
};