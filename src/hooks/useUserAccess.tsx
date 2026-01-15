import { useUser } from "@/context/UserContext";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";

export const useUserAccess = () => {
  const { currentUser } = useUser();
  const { locations, assignments } = useInventory(); 
  const { selectedCompanyId } = useCompany();

  const userRole = currentUser?.role || "client";

  const userRoleDisplay = () => {
    switch (userRole) {
      case "super_admin": return "Super Admin";
      case "admin": return "Admin";
      case "auditor": return "Auditor";
      case "client": return "Client";
      default: return "User";
    }
  };

  const accessibleLocations = () => {
    if (!currentUser) return [];

    if (userRole === "super_admin") {
      if (selectedCompanyId) {
        return locations.filter(l => l.companyId === selectedCompanyId);
      }
      return locations;
    }

    if (userRole === "admin" || userRole === "client") {
      const myCompanies = currentUser.assigned_companies || [];
      let allowed = locations.filter(l => l.companyId && myCompanies.includes(l.companyId));
      if (selectedCompanyId) {
        allowed = allowed.filter(l => l.companyId === selectedCompanyId);
      }
      return allowed;
    }

    if (userRole === "auditor") {
      const myAssignments = assignments.filter(a => {
        const auditorIds = (a as any).auditorIds || []; 
        if (Array.isArray(auditorIds)) {
            return auditorIds.includes(currentUser.id);
        }
        return (a.auditorId === currentUser.id);
      });

      const myLocationIds = myAssignments.map(a => a.locationId);
      let allowed = locations.filter(l => myLocationIds.includes(l.id));

      if (selectedCompanyId) {
         allowed = allowed.filter(l => l.companyId === selectedCompanyId);
      }
      return allowed;
    }

    return [];
  };

  // --- IDENTITY HELPERS ---
  const isSuperAdmin = () => userRole === "super_admin";
  const isAdmin = () => userRole === "admin";
  const isAuditor = () => userRole === "auditor";
  const isClientUser = () => userRole === "client";

  // --- PERMISSION HELPERS ---
  
  // FIX: Removed 'client' - they cannot scan anymore
  const canPerformAudits = () => ["super_admin", "admin", "auditor"].includes(userRole);
  
  const canViewAnalytics = () => ["super_admin", "admin", "client"].includes(userRole);
  
  // FIX: New permission for finalizing reports (Spectator role)
  const canFinalizeReports = () => ["super_admin", "admin", "client"].includes(userRole);

  const canUploadData = () => ["super_admin", "admin", "auditor"].includes(userRole);
  const canUploadItemMaster = () => ["super_admin", "admin"].includes(userRole);
  const canUploadClosingStock = () => ["super_admin", "admin", "auditor"].includes(userRole);
  const canModifyInventory = () => ["super_admin", "admin", "auditor"].includes(userRole);
  const canDeleteInventory = () => ["super_admin", "admin"].includes(userRole);
  const canManageUsers = () => ["super_admin", "admin"].includes(userRole);
  const canManageLocations = () => ["super_admin", "admin"].includes(userRole);

  return {
    userRole,
    userRoleDisplay,
    accessibleLocations,
    
    // Roles
    isSuperAdmin,
    isAdmin,
    isAuditor,
    isClientUser,

    // Permissions
    canPerformAudits,
    canViewAnalytics,
    canFinalizeReports, // Exported
    canUploadData,
    canUploadItemMaster,
    canUploadClosingStock,
    canModifyInventory,
    canDeleteInventory,
    canManageUsers,
    canManageLocations
  };
};