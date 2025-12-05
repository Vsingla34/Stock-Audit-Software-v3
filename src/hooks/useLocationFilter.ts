import { useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useInventory } from "@/context/InventoryContext";

export const useLocationFilter = () => {
  const { currentUser } = useUser();
  const { accessibleLocations } = useUserAccess();
  const { locations, selectedLocationFilter, setSelectedLocationFilter } = useInventory();

  const userAccessibleLocations = accessibleLocations();

  const isSuperOrAdmin = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const availableLocations = isSuperOrAdmin 
    ? locations 
    : userAccessibleLocations;

  useEffect(() => {
    if (!isSuperOrAdmin && userAccessibleLocations.length === 1) {
      setSelectedLocationFilter(userAccessibleLocations[0].id);
    }
  }, [isSuperOrAdmin, userAccessibleLocations, setSelectedLocationFilter]);

  const shouldShowLocationFilter = 
    isSuperOrAdmin || userAccessibleLocations.length > 1;

  const getLocationName = (locationId: string): string | undefined => {
    if (locationId === "all") return undefined;
    return locations.find(loc => loc.id === locationId)?.name;
  };

  return {
    selectedLocation: selectedLocationFilter,
    setSelectedLocation: setSelectedLocationFilter,
    availableLocations,
    shouldShowLocationFilter,
    getLocationName,
    isAdmin: isSuperOrAdmin,
    userAccessibleLocations,
  };
};