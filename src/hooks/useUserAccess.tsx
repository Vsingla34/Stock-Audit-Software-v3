import { useUser } from "@/context/UserContext";
import { useInventory } from "@/context/InventoryContext";

export const useUserAccess = () => {
  const { currentUser, hasPermission } = useUser();
  const { locations } = useInventory();
  
  
  const accessibleLocations = () => {
    if (!currentUser) return [];
    
    
    if (currentUser.role === "super_admin" || currentUser.role === "admin") {
      return locations;
    }
    
    
    if (currentUser.assigned_locations?.length) {
      return locations.filter((location) =>
        currentUser.assigned_locations?.includes(location.id)
      );
    }
    
    return [];
  };
  
  
  const canAccessLocation = (locationId: string): boolean => {
    if (!currentUser) return false;
    
    
    if (currentUser.role === "super_admin" || currentUser.role === "admin") return true;
    
    
    return currentUser.assigned_locations?.includes(locationId) || false;
  };
  
  
  const canPerformAudits = (): boolean => {
    if (!currentUser) return false;
    return ["super_admin", "admin", "auditor"].includes(currentUser.role);
  };
  
  
  const canUploadData = (): boolean => {
    if (!currentUser) return false;
    
    
    if (["super_admin", "admin"].includes(currentUser.role)) return true;
    
    
    if (currentUser.role === "auditor") return true;
    
    return false;
  };
  
  
  const canUploadItemMaster = (): boolean => {
    if (!currentUser) return false;
    return ["super_admin", "admin"].includes(currentUser.role);
  };
  

  const canUploadClosingStock = (): boolean => {
    if (!currentUser) return false;
    return ["super_admin", "admin", "auditor"].includes(currentUser.role);
  };
  
  
  const canViewReports = (): boolean => {
    if (!currentUser) return false;
    return true; 
  };
  
  
  const isClientUser = (): boolean => {
    if (!currentUser) return false;
    return currentUser.role === "client";
  };
  
  
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