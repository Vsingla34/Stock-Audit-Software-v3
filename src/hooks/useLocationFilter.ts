import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useInventory } from "@/context/InventoryContext";

export const useLocationFilter = () => {
  const { currentUser } = useUser();
  const { accessibleLocations } = useUserAccess();
  const { locations } = useInventory();
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  const userAccessibleLocations = accessibleLocations();

  // FIX: Explicitly include super_admin in the admin check
  const isSuperOrAdmin = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const availableLocations = isSuperOrAdmin 
    ? locations 
    : userAccessibleLocations;

  useEffect(() => {
    // FIX: Use the combined check here
    if (!isSuperOrAdmin && userAccessibleLocations.length === 1) {
      setSelectedLocation(userAccessibleLocations[0].id);
    }
  }, [isSuperOrAdmin, userAccessibleLocations]);

  const shouldShowLocationFilter = 
    isSuperOrAdmin || userAccessibleLocations.length > 1;

  const getLocationName = (locationId: string): string | undefined => {
    if (locationId === "all") return undefined;
    return locations.find(loc => loc.id === locationId)?.name;
  };

  return {
    selectedLocation,
    setSelectedLocation,
    availableLocations,
    shouldShowLocationFilter,
    getLocationName,
    isAdmin: isSuperOrAdmin, // FIX: Return the combined boolean
    userAccessibleLocations,
  };
};