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

type Role = "super_admin" | "admin" | "client" | "auditor" | string;

const ProtectedRoute = ({
  children,
  requiredPermission = null,
  allowedRoles,
}: {
  children: React.ReactNode;
  requiredPermission?: string | null;
  // If allowedRoles is provided, user must have one of these roles
  allowedRoles?: Role[];
}) => {
  const { isAuthenticated, currentUser } = useUser();
  const { hasPermission } = useUserAccess();
  const { selectedCompanyId } = useCompany();
  const location = useLocation();

  // 1. Check Authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 2. Check Company Selection (except for specific routes)
  const isCompanySelectionRoute = location.pathname === "/company-selection";
  const isAddCompanyRoute = location.pathname === "/add-company";
  if (!selectedCompanyId && !isCompanySelectionRoute && !isAddCompanyRoute) {
    return <Navigate to="/company-selection" replace />;
  }

  // 3. Check Role
  if (allowedRoles && allowedRoles.length > 0) {
    const role = currentUser?.role as Role | undefined;
    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/" replace />;
    }
  }

  // 4. Check Permission (if specified)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
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
      {/* Public Routes */}
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

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        }
      />

      {/* Company Selection */}
      <Route path="/company-selection" element={<CompanySelection />} />

      {/* Feature Routes */}
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

      {/* Analytics */}
      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "admin", "client"]}>
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
      
      {/* Admin Routes */}
      <Route
        path="/admin-overview"
        element={
          // Updated: Added "client" to allowedRoles and removed requiredPermission="manageUsers"
          <ProtectedRoute allowedRoles={["super_admin", "admin", "client"]}>
            <AdminOverview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "admin"]} requiredPermission="manageUsers">
            <UserManagement />
          </ProtectedRoute>
        }
      />
      
      {/* Super Admin Only */}
      <Route
        path="/add-company"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]} requiredPermission="manageCompanies">
            <AddCompany />
          </ProtectedRoute>
        }
      />
      
      {/* Questionnaire */}
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