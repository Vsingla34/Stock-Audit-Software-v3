// src/App.tsx
import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "./hooks/useUserAccess";
import { useCompany } from "@/context/CompanyContext";
import { FullPageLoader } from "@/components/fullPageLoader/FullPageLoader";

import Index from "./pages/Index";
import Scanner from "./pages/Scanner";
import Search from "./pages/Search";
import Upload from "./pages/Upload";
import Reports from "./pages/Reports";
import Analytics from "./pages/Analytics";
import LocationManagement from "./pages/LocationManagement";
import AdminOverview from "./pages/AdminOverview";
import UserManagement from "./pages/UserManagement";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Questionnaire from "./pages/Questionnaire";
import AddCompany from "./pages/AddCompany";
import CompanySelection from "./pages/CompanySelection";

const ProtectedRoute = ({
  children,
  requiredPermission = null,
}: {
  children: React.ReactNode;
  requiredPermission?: string | null;
}) => {
  const { isAuthenticated } = useUser();
  const { hasPermission } = useUserAccess();
  const { selectedCompanyId } = useCompany();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  const isCompanySelectionRoute = location.pathname === "/company-selection";
  const isAddCompanyRoute = location.pathname === "/add-company";

  if (!selectedCompanyId && !isCompanySelectionRoute && !isAddCompanyRoute) {
    return <Navigate to="/company-selection" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { loading, isAuthenticated } = useUser();

  if (loading) {
    return <FullPageLoader />;
  }

  return (
    <Routes>
      {/* LOGIN: logged-in user goes to company selection */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/company-selection" replace />
          ) : (
            <Login />
          )
        }
      />

      {/* DASHBOARD */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        }
      />

      {/* COMPANY SELECTION PAGE */}
      <Route path="/company-selection" element={<CompanySelection />} />

      {/* OTHER ROUTES (same as before, wrapped in ProtectedRoute) */}
      <Route
        path="/scanner"
        element={
          <ProtectedRoute requiredPermission="conductAudits">
            <Scanner />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute requiredPermission="conductAudits">
            <Search />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute>
            <Upload />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute requiredPermission="manageUsers">
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/locations"
        element={
          <ProtectedRoute>
            <LocationManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-overview"
        element={
          <ProtectedRoute requiredPermission="manageUsers">
            <AdminOverview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute requiredPermission="manageUsers">
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-company"
        element={
          <ProtectedRoute requiredPermission="manageUsers">
            <AddCompany />
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaire"
        element={
          <ProtectedRoute>
            <Questionnaire />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
