import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useInventory } from "@/context/InventoryContext";

/**
 * Custom hook to manage location filtering across the application
 * Handles different logic for admin vs regular users
 */
export const useLocationFilter = () => {
  const { currentUser } = useUser();
  const { accessibleLocations } = useUserAccess();
  const { locations } = useInventory();
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  // Get user's accessible locations
  const userAccessibleLocations = accessibleLocations();

  // Determine which locations to show in dropdown
  const availableLocations = currentUser?.role === "admin" 
    ? locations 
    : userAccessibleLocations;

  // Auto-select location for users with only one accessible location
  useEffect(() => {
    if (currentUser?.role !== "admin" && userAccessibleLocations.length === 1) {
      setSelectedLocation(userAccessibleLocations[0].id);
    }
  }, [currentUser?.role, userAccessibleLocations]);

  // Check if location filter should be shown
  const shouldShowLocationFilter = 
    currentUser?.role === "admin" || userAccessibleLocations.length > 1;

  // Get location name from ID
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
    isAdmin: currentUser?.role === "admin",
    userAccessibleLocations,
  };
};