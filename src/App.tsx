import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { InventoryProvider } from "./context/InventoryContext";
import { AppLayout } from "./components/layout/AppLayout";
import { UserProvider, useUser } from "./context/UserContext";
import { CompanyProvider } from "./context/CompanyContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { lazy, Suspense, useEffect } from "react";

// Fix 3.2: Lazy-load all pages — each becomes a separate JS chunk.
// Heavy libs (jsPDF, xlsx, recharts, html2canvas) only download
// when the user actually navigates to the page that needs them.
//
// Login stays static — it's the entry point and must load immediately.
import Login from "./pages/Login";

const Index              = lazy(() => import("./pages/Index"));
const Scanner            = lazy(() => import("./pages/Scanner"));
const Search             = lazy(() => import("./pages/Search"));
const Reports            = lazy(() => import("./pages/Reports"));
const Profile            = lazy(() => import("./pages/Profile"));
const UploadData         = lazy(() => import("./pages/Upload"));
const Analytics          = lazy(() => import("./pages/Analytics"));
const HistoryPage        = lazy(() => import("./pages/History"));
const UserManagement     = lazy(() => import("./pages/UserManagement"));
const LocationManagement = lazy(() => import("./pages/LocationManagement"));
const AssignmentSelection= lazy(() => import("./pages/AssignmentSelection"));
const AdminOverview      = lazy(() => import("./pages/AdminOverview"));
const QuestionnairePage  = lazy(() => import("./pages/Questionnaire"));
const CompanySelection   = lazy(() => import("./pages/CompanySelection"));
const AddCompany         = lazy(() => import("./pages/AddCompany"));
const AssignmentPage     = lazy(() => import("./pages/Assignment"));
const NotFound           = lazy(() => import("./pages/NotFound"));

// PageLoader: full-screen spinner for the very first page load
const PageLoader = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
  </div>
);

// usePreloadPages: silently downloads all page chunks 2 s after initial render.
// After that, every sidebar navigation is instant — no Suspense triggered.
function usePreloadPages() {
  useEffect(() => {
    const timer = setTimeout(() => {
      import("./pages/Index");
      import("./pages/Scanner");
      import("./pages/Search");
      import("./pages/Reports");
      import("./pages/Analytics");
      import("./pages/Upload");
      import("./pages/History");
      import("./pages/Profile");
      import("./pages/AdminOverview");
      import("./pages/UserManagement");
      import("./pages/LocationManagement");
      import("./pages/Assignment");
      import("./pages/Questionnaire");
      import("./pages/CompanySelection");
      import("./pages/AssignmentSelection");
      import("./pages/AddCompany");
      import("./pages/NotFound");
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
}

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
    return <PageLoader />;
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

const App = () => {
  usePreloadPages(); // Silently prefetch all page chunks after initial load
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UserProvider>
        <CompanyProvider>
          <InventoryProvider>
            <Toaster />
            {/* Single persistent AppLayout — sidebar mounts ONCE and never re-mounts.
                All page-level <AppLayout> wrappers detect this context and become
                transparent (they just render children). This eliminates sidebar flicker. */}
            <AppLayout>
            {/* Outer Suspense — fallback rarely shown since AppLayout has inner Suspense */}
            <Suspense fallback={<PageLoader />}>
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
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </AppLayout>
          </InventoryProvider>
        </CompanyProvider>
      </UserProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;