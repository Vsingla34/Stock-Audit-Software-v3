import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { InventoryProvider } from "./context/InventoryContext";
import { UserProvider, useUser } from "./context/UserContext";
import { CompanyProvider } from "./context/CompanyContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Scanner from "./pages/Scanner";
import Search from "./pages/Search";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import UploadData from "./pages/Upload";
import Analytics from "./pages/Analytics";
import HistoryPage from "./pages/History";
import UserManagement from "./pages/UserManagement";
import LocationManagement from "./pages/LocationManagement";
import AssignmentSelection from "./pages/AssignmentSelection";
import AdminOverview from "./pages/AdminOverview";
import QuestionnairePage from "./pages/Questionnaire";
import CompanySelection from "./pages/CompanySelection";
import AddCompany from "./pages/AddCompany";
import AssignmentPage from "./pages/Assignment";

const queryClient = new QueryClient();


const ProtectedRoute = ({
  children,
  requiredPermission,
}: {
  children: JSX.Element;
  requiredPermission?: "audit" | "upload" | "manage_users" | "manage_locations" | "view_overview" | "view_analytics";
}) => {
  const { isAuthenticated, loading } = useUser();
  const { 
    canPerformAudits, 
    canUploadData, 
    canManageUsers, 
    canManageLocations, 
    canViewAnalytics,
    isSuperAdmin, 
    isAdmin, 
    isClientUser 
  } = useUserAccess();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission) {
    let hasAccess = false;

    switch (requiredPermission) {
      case "audit":
        hasAccess = canPerformAudits(); // Now includes 'client'
        break;
      case "upload":
        hasAccess = canUploadData();
        break;
      case "manage_users":
        hasAccess = canManageUsers();
        break;
      case "manage_locations":
        hasAccess = canManageLocations();
        break;
      case "view_overview":
        hasAccess = isSuperAdmin() || isAdmin() || isClientUser();
        break;
      case "view_analytics":
        hasAccess = canViewAnalytics(); // Excludes 'auditor'
        break;
      default:
        hasAccess = true;
    }

    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UserProvider>
        <CompanyProvider>
          <InventoryProvider>
            <Toaster />
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assignment-selection"
                element={
                  <ProtectedRoute>
                    <AssignmentSelection />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/company-selection"
                element={
                  <ProtectedRoute>
                    <CompanySelection />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scanner"
                element={
                  <ProtectedRoute requiredPermission="audit">
                    <Scanner />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <ProtectedRoute>
                    <Search />
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
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />
              
              {/* UPDATED: Added requiredPermission for Analytics */}
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute requiredPermission="view_analytics">
                    <Analytics />
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
              <Route
                path="/questionnaire"
                element={
                  <ProtectedRoute>
                    <QuestionnairePage />
                  </ProtectedRoute>
                }
              />

              {/* Admin / Higher Role Routes */}
              <Route
                path="/upload"
                element={
                  <ProtectedRoute requiredPermission="upload">
                    <UploadData />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute requiredPermission="manage_users">
                    <UserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/locations"
                element={
                  <ProtectedRoute requiredPermission="manage_locations">
                    <LocationManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assignments"
                element={
                  <ProtectedRoute requiredPermission="manage_locations">
                    <AssignmentPage/>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin-overview"
                element={
                  <ProtectedRoute requiredPermission="view_overview">
                    <AdminOverview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/add-company"
                element={
                  <ProtectedRoute>
                    <AddCompany />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </InventoryProvider>
        </CompanyProvider>
      </UserProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;