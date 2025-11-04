import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InventoryProvider } from "@/context/InventoryContext";
import { UserProvider } from "@/context/UserContext";
import { BrowserRouter } from "react-router-dom";
import { CompanyProvider } from "@/context/CompanyContext";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <CompanyProvider>
          <UserProvider>
            <InventoryProvider>
              <Toaster />
              <Sonner />
              <App />
            </InventoryProvider>
          </UserProvider>
          </CompanyProvider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);