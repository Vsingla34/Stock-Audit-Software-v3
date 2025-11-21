
import { useUser } from "@/context/UserContext";
import { useInventory } from "@/context/InventoryContext";

export const useUserAccess = () => {
  const { currentUser, hasPermission } = useUser();
  const { locations } = useInventory();
  
  // Get locations accessible to the current user
  const accessibleLocations = () => {
    if (!currentUser) return [];
    
    // ✅ Super Admin can access ALL locations
    if (currentUser.role === "super_admin") {
      return locations;
    }
    
    // For Admin, Auditor, and Client: filter by assigned locations
    // Note: Admins are now restricted to locations within their assigned companies
    // (Logic usually handled by ensuring Admins have assigned_locations or assigned_companies populated)
    if (currentUser.assigned_locations?.length) {
      return locations.filter((location) =>
        currentUser.assigned_locations?.includes(location.id)
      );
    }
    
    return [];
  };
  
  // Check if user has access to a specific location
  const canAccessLocation = (locationId: string): boolean => {
    if (!currentUser) return false;
    
    // Super Admin can access everything
    if (currentUser.role === "super_admin") return true;
    
    // Otherwise check if location is in assigned locations
    return currentUser.assigned_locations?.includes(locationId) || false;
  };
  
  // Check if user can perform physical audits
  const canPerformAudits = (): boolean => {
    if (!currentUser) return false;
    return ["super_admin", "admin", "auditor"].includes(currentUser.role);
  };
  
  // Check if user can upload data
  const canUploadData = (): boolean => {
    if (!currentUser) return false;
    
    // Super Admin and Admin can upload Item Master
    if (["super_admin", "admin"].includes(currentUser.role)) return true;
    
    // Auditors can upload closing stock for their assigned locations
    if (currentUser.role === "auditor") return true;
    
    return false;
  };
  
  // Check if user can upload item master data (Super Admin & Admin)
  const canUploadItemMaster = (): boolean => {
    if (!currentUser) return false;
    return ["super_admin", "admin"].includes(currentUser.role);
  };
  
  // Check if user can upload closing stock
  const canUploadClosingStock = (): boolean => {
    if (!currentUser) return false;
    return ["super_admin", "admin", "auditor"].includes(currentUser.role);
  };
  
  // Check if user can view reports
  const canViewReports = (): boolean => {
    if (!currentUser) return false;
    return true; // All authenticated users can view reports
  };
  
  // Check if user is client (view-only)
  const isClientUser = (): boolean => {
    if (!currentUser) return false;
    return currentUser.role === "client";
  };
  
  // Get user role display name
  const userRoleDisplay = (): string => {
    if (!currentUser) return "";
    
    switch (currentUser.role) {
      case "super_admin":
        return "Super Administrator";
      case "admin":
        return "Admin";
      case "auditor":
        return "Inventory Auditor";
      case "client":
        return "Client User";
      default:
        return currentUser.role;
    }
  };

  return {
    accessibleLocations,
    canAccessLocation,
    canPerformAudits,
    canUploadData,
    canUploadItemMaster,
    canUploadClosingStock,
    canViewReports,
    isClientUser,
    userRoleDisplay,
    hasPermission,
    userRole: currentUser?.role,
  };
};
