import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUserAccess } from "@/hooks/useUserAccess";
import {
  BarChart3,
  ClipboardEdit,
  FileSpreadsheet,
  Home,
  Search,
  Settings,
  Building,
  Users,
  UserCircle,
  ScanBarcode,
  LogOut,
  Upload,
  ListChecks,
  Building2,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";

export function Sidebar({
  isMobile,
  setMobileOpen,
}: {
  isMobile?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) {
  const location = useLocation();
  const { isAuthenticated, logout, currentUser } = useUser();
  const { accessibleLocations, userRole, userRoleDisplay } = useUserAccess();

  if (location.pathname === "/login") return null;
  if (!isAuthenticated) return null;

  const navigation = useMemo(() => {
    const nav = [{ name: "Dashboard", href: "/", icon: Home }];
    if (["admin", "auditor"].includes(userRole)) {
      nav.push({ name: "Scanner", href: "/scanner", icon: ScanBarcode });
    }
    nav.push(
      { name: "Search", href: "/search", icon: Search },
      { name: "Reports", href: "/reports", icon: FileSpreadsheet },
      { name: "Analytics", href: "/analytics", icon: BarChart3 }
    );
    nav.push({
      name: "Questionnaire",
      href: "/questionnaire",
      icon: ListChecks,
    });
    if (["admin", "auditor"].includes(userRole)) {
      nav.push({ name: "Upload Data", href: "/upload", icon: Upload });
    }
    nav.push({ name: "Locations", href: "/locations", icon: Building });
    if (userRole === "admin") {
      nav.push(
        { name: "Admin Overview", href: "/admin-overview", icon: Settings },
        { name: "User Management", href: "/users", icon: Users },
        { name: "Company", href: "/add-company", icon: Building2 }
      );
    }
    nav.push({ name: "My Profile", href: "/profile", icon: UserCircle });
    return nav;
  }, [userRole]);

  const handleLogout = () => {
    logout();
  };

  const handleLinkClick = () => {
    if (isMobile && setMobileOpen) {
      setMobileOpen(false);
    }
  };

  return (
    <aside className="flex h-full w-64 flex-col overflow-y-auto border-r border-r-accent bg-card px-5 py-8">
      <div className="flex flex-col h-full">
        <div>
          <div className="space-y-1">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
              Inventory Audit App
            </h2>
            <div className="bg-accent/50 rounded-lg p-2 mb-4">
              <p className="text-xs text-muted-foreground mb-1">
                Logged in as:
              </p>
              <p className="font-medium text-sm truncate">{currentUser?.name}</p>
              <p className="text-xs text-muted-foreground">
                {userRoleDisplay()}
              </p>
              {userRole !== "admin" && accessibleLocations.length > 0 && ( // FIXED
                <div className="mt-1 pt-1 border-t border-accent/50">
                  <p className="text-xs text-muted-foreground mb-1">
                    Assigned locations:
                  </p>
                  <div className="max-h-16 overflow-y-auto">
                    {accessibleLocations.map((loc) => ( // FIXED
                      <div key={loc.id} className="text-xs py-0.5 truncate">
                        {loc.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <nav className="flex flex-col space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleLinkClick}
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-primary hover:bg-accent/50"
                  }`}
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto pt-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-4 w-4" />
            <span>Log out</span>
          </Button>
          <div className="mt-4 px-2 text-center">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Inventory Audit System
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}