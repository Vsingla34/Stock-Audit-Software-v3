import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";

// PERFORMANCE FIX: App.tsx already mounts QueryClientProvider, TooltipProvider,
// UserProvider, CompanyProvider, InventoryProvider and the Sonner Toaster.
// They used to be mounted a SECOND time here, which meant two InventoryProviders
// (two full 15k-row downloads, two realtime channels, two IndexedDB writers,
// two sync loops) and every toast shown twice. Only the router lives here now.
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      {/* shadcn toaster is used by UserProfile (useToast); Sonner is mounted in App */}
      <Toaster />
    </BrowserRouter>
  </React.StrictMode>
);