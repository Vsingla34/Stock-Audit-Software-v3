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

  
  const availableLocations = currentUser?.role === "admin" 
    ? locations 
    : userAccessibleLocations;

  
  useEffect(() => {
    if (currentUser?.role !== "admin" && userAccessibleLocations.length === 1) {
      setSelectedLocation(userAccessibleLocations[0].id);
    }
  }, [currentUser?.role, userAccessibleLocations]);


  const shouldShowLocationFilter = 
    currentUser?.role === "admin" || userAccessibleLocations.length > 1;

  
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