import { useInventory } from "@/context/InventoryContext";
import { StatCard } from "@/components/dashboard/StatCard";
import { BarChart, FileText, CheckCheck, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useUser } from "@/context/UserContext"; 
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const InventoryOverview = () => {
  const { getInventorySummary, locations, getLocationSummary } = useInventory();
  const { currentUser } = useUser(); 
  const { accessibleLocations, userRole } = useUserAccess();
  
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [hasInitialized, setHasInitialized] = useState(false);
  
  const userLocations = useMemo(() => accessibleLocations(), [accessibleLocations]);

  // Initialize location for non-admin users
  useEffect(() => {
    if (!hasInitialized && currentUser) {
      if (currentUser.role !== "admin" && userLocations.length > 0) {
        // Auto-select first location for non-admin users
        setSelectedLocation(userLocations[0].id);
      } else if (currentUser.role === "admin") {
        // Admin sees all locations by default
        setSelectedLocation("");
      }
      setHasInitialized(true);
    }
  }, [currentUser, userLocations, hasInitialized]);

  // Memoized summary calculation
  const summary = useMemo(() => {
    if (currentUser?.role === "admin" && !selectedLocation) {
      return getInventorySummary();
    } else if (selectedLocation) {
      const locationObj = locations.find(loc => loc.id === selectedLocation);
      if (locationObj) {
        return getLocationSummary(locationObj.name);
      }
    }
    
    // Fallback for non-admin without location selected
    if (currentUser?.role !== "admin" && userLocations.length > 0) {
      const firstLocation = userLocations[0];
      return getLocationSummary(firstLocation.name);
    }
    
    return { totalItems: 0, auditedItems: 0, matched: 0, discrepancies: 0, pendingItems: 0 };
  }, [selectedLocation, locations, currentUser?.role, userLocations, getInventorySummary, getLocationSummary]);

  const completionPercentage = useMemo(() => {
    return summary.totalItems > 0 
      ? Math.round((summary.auditedItems / summary.totalItems) * 100) 
      : 0;
  }, [summary.auditedItems, summary.totalItems]);

  const handleLocationChange = useCallback((value: string) => {
    setSelectedLocation(value);
  }, []);

  const selectedLocationName = useMemo(() => {
    if (currentUser?.role === "admin" && !selectedLocation) {
      return "All Locations";
    }
    const location = userLocations.find(loc => loc.id === selectedLocation);
    return location?.name || "Select Location";
  }, [currentUser?.role, userLocations, selectedLocation]);

  if (userRole !== "admin" && userLocations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <h1 className="text-black/50 font-semibold text-[1.2rem]">Currently You Don't have access</h1>
      </div>
    );
  }

  return (
    <>
      <Select
        value={selectedLocation}
        onValueChange={handleLocationChange}
        disabled={currentUser?.role !== "admin" && userLocations.length <= 1}
      >
        <SelectTrigger>
          <SelectValue placeholder={selectedLocationName} />
        </SelectTrigger>
        
        <SelectContent>
          {currentUser?.role === "admin" && (
            <SelectItem value="">All Locations</SelectItem>
          )}
          {userLocations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Inventory Items"
          value={summary.totalItems}
          description="Total items in inventory"
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        
        <StatCard
          title="Audit Progress"
          value={`${completionPercentage}%`}
          description={`${summary.auditedItems} of ${summary.totalItems} items audited`}
          icon={<BarChart className="h-4 w-4 text-muted-foreground" />}
        />

        <StatCard
          title="Matched Items"
          value={summary.matched}
          description="Items with matching quantities"
          icon={<CheckCheck className="h-4 w-4 text-green-500" />}
          valueClassName="text-green-600"
        />

        <StatCard
          title="Discrepancies"
          value={summary.discrepancies}
          description="Items with quantity discrepancies"
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
          valueClassName="text-red-600"
        />

        <Card className="md:col-span-2 lg:col-span-4 p-4">
          <h3 className="text-lg font-medium mb-2">Audit Progress</h3>
          <Progress value={completionPercentage} className="h-2" />
          <div className="flex justify-between mt-1 text-sm text-muted-foreground">
            <span>{summary.auditedItems} audited</span>
            <span>{summary.pendingItems} pending</span>
          </div>
        </Card>
      </div>
    </>
  );
};