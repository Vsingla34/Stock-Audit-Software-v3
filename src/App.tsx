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
import AssignmentSelection from "./pages/AssignmentSelection"; 
import Assignment from "./pages/Assignment.tsx";
import History from "./pages/History"; 

type Role = "super_admin" | "admin" | "client" | "auditor" | string;

const ProtectedRoute = ({
  children,
  requiredPermission = null,
  allowedRoles,
}: {
  children: React.ReactNode;
  requiredPermission?: string | null;
  allowedRoles?: Role[];
}) => {
  const { isAuthenticated, currentUser } = useUser();
  const { hasPermission } = useUserAccess();
  const { selectedCompanyId, selectedAssignmentId } = useCompany();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isCompanySelectionRoute = location.pathname === "/company-selection";
  const isAssignmentSelectionRoute = location.pathname === "/assignment-selection";
  const isAddCompanyRoute = location.pathname === "/add-company";
  
  const isAuditor = currentUser?.role === "auditor"; 
  
  // FIX: Allow Auditors to stay on Company Selection (removed the forced redirect)
  
  // If user is auditor, they must select an assignment to have context
  // BUT we must allow them to be on Company Selection or Assignment Selection pages
  if (isAuditor && !selectedAssignmentId && !isAssignmentSelectionRoute && !isCompanySelectionRoute) {
     return <Navigate to="/assignment-selection" replace />;
  }

  // If user is admin/super_admin/client, they must select a company (unless on special pages)
  const canAccessAssignmentsWithoutCompany = 
    location.pathname === "/assignments" && 
    ["super_admin", "admin"].includes(currentUser?.role || "");

  // Logic applies to everyone now, including auditors
  if (!selectedCompanyId && !isCompanySelectionRoute && !isAddCompanyRoute && !canAccessAssignmentsWithoutCompany) {
    return <Navigate to="/company-selection" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const role = currentUser?.role as Role | undefined;
    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/" replace />;
    }
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { loading, isAuthenticated, currentUser } = useUser();

  if (loading) {
    return <FullPageLoader />;
  }

  // Determine landing page based on role
  const getHomeRedirect = () => {
     // FIX: Everyone goes to Company Selection first now
     return "/company-selection";
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={getHomeRedirect()} replace />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        }
      />

      {/* FIX: Added 'auditor' to allowedRoles */}
      <Route 
        path="/company-selection" 
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin', 'client', 'auditor']}>
            <CompanySelection />
          </ProtectedRoute>
        } 
      />
      
      {/* Wrapped in ProtectedRoute to ensure auth */}
      <Route 
        path="/assignment-selection" 
        element={
          <ProtectedRoute>
            <AssignmentSelection />
          </ProtectedRoute>
        } 
      />

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
        path="/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />

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
      
      <Route
        path="/admin-overview"
        element={
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
      
      <Route
        path="/add-company"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]} requiredPermission="manageCompanies">
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
        path="/assignments"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
            <Assignment />
          </ProtectedRoute>
        }
      />

      <Route path="/audit-history" element={<Navigate to="/history" replace />} />
      
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