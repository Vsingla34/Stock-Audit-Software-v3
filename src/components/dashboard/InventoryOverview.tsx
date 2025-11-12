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
import { useCompany } from "@/context/CompanyContext";

type Summary = {
  totalItems: number;
  auditedItems: number;
  matched: number;
  discrepancies: number;
  pendingItems: number;
};

const ZERO_SUMMARY: Summary = {
  totalItems: 0,
  auditedItems: 0,
  matched: 0,
  discrepancies: 0,
  pendingItems: 0,
};

// Sentinel for “All Locations” in the Select control
const ALL_LOCATIONS_VALUE = "__ALL__";

function normalizeSummary(raw: Partial<Summary>): Summary {
  const totalItems = raw.totalItems ?? 0;
  const auditedItems = raw.auditedItems ?? 0;
  const matched = raw.matched ?? 0;
  const discrepancies = raw.discrepancies ?? 0;
  const pendingItems = Math.max(totalItems - auditedItems, 0);
  return { totalItems, auditedItems, matched, discrepancies, pendingItems };
}

export const InventoryOverview = () => {
  const { getInventorySummary, locations, getLocationSummary } = useInventory();
  const { currentUser } = useUser();
  const { accessibleLocations, userRole } = useUserAccess();
  const { selectedCompanyId } = useCompany();

  const [selectedLocation, setSelectedLocation] = useState<string>(""); // store "" for All
  const [hasInitialized, setHasInitialized] = useState(false);

  // All locations user has access to (hook returns a function)
  const userLocations = useMemo(() => accessibleLocations(), [accessibleLocations]);

  // Filter user locations by current company
  const companyUserLocations = useMemo(() => {
    if (!selectedCompanyId) return userLocations;
    return userLocations.filter((loc) => loc.companyId === selectedCompanyId);
  }, [userLocations, selectedCompanyId]);

  // Initialize selected location
  useEffect(() => {
    if (!hasInitialized && currentUser) {
      if (currentUser.role !== "admin" && companyUserLocations.length > 0) {
        setSelectedLocation(companyUserLocations[0].id);
      } else if (currentUser.role === "admin") {
        setSelectedLocation(""); // All
      }
      setHasInitialized(true);
    }
  }, [currentUser, companyUserLocations, hasInitialized]);

  // If current selection becomes invalid due to company switch, reset
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === "admin") {
      // admin can always fall back to All
      if (
        selectedLocation &&
        !companyUserLocations.some((l) => l.id === selectedLocation)
      ) {
        setSelectedLocation("");
      }
    } else {
      // non-admin must have a concrete location
      if (
        !selectedLocation ||
        !companyUserLocations.some((l) => l.id === selectedLocation)
      ) {
        setSelectedLocation(companyUserLocations[0]?.id ?? "");
      }
    }
  }, [currentUser, companyUserLocations, selectedLocation]);

  // Compute summary with company filter
  const summary: Summary = useMemo(() => {
    if (!currentUser) return ZERO_SUMMARY;

    if (selectedLocation) {
      const locationObj = locations.find(
        (loc) =>
          loc.id === selectedLocation &&
          (!selectedCompanyId || loc.companyId === selectedCompanyId)
      );
      if (!locationObj) return ZERO_SUMMARY;
      return normalizeSummary(getLocationSummary(locationObj.name));
    }

    // Admin + "all locations" for current company
    if (currentUser.role === "admin") {
      if (!selectedCompanyId) {
        return normalizeSummary(getInventorySummary());
      }

      const companyLocations = locations.filter(
        (loc) => loc.companyId === selectedCompanyId
      );
      if (companyLocations.length === 0) return ZERO_SUMMARY;

      const aggregated = companyLocations.reduce<Summary>(
        (acc, loc) => {
          const s = normalizeSummary(getLocationSummary(loc.name));
          acc.totalItems += s.totalItems;
          acc.auditedItems += s.auditedItems;
          acc.matched += s.matched;
          acc.discrepancies += s.discrepancies;
          return acc;
        },
        { ...ZERO_SUMMARY }
      );

      aggregated.pendingItems = Math.max(
        aggregated.totalItems - aggregated.auditedItems,
        0
      );
      return aggregated;
    }

    if (companyUserLocations.length > 0) {
      const firstLocation = companyUserLocations[0];
      return normalizeSummary(getLocationSummary(firstLocation.name));
    }

    return ZERO_SUMMARY;
  }, [
    currentUser,
    selectedLocation,
    locations,
    selectedCompanyId,
    companyUserLocations,
    getInventorySummary,
    getLocationSummary,
  ]);

  const completionPercentage = useMemo(() => {
    return summary.totalItems > 0
      ? Math.round((summary.auditedItems / summary.totalItems) * 100)
      : 0;
  }, [summary.auditedItems, summary.totalItems]);

  // Map UI value to state: ALL_LOCATIONS_VALUE -> ""
  const handleLocationChange = useCallback((value: string) => {
    setSelectedLocation(value === ALL_LOCATIONS_VALUE ? "" : value);
  }, []);

  const selectedLocationName = useMemo(() => {
    if (currentUser?.role === "admin" && !selectedLocation) {
      return "All Locations";
    }
    const location = companyUserLocations.find((loc) => loc.id === selectedLocation);
    return location?.name || "Select Location";
  }, [currentUser?.role, companyUserLocations, selectedLocation]);

  if (userRole !== "admin" && companyUserLocations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <h1 className="text-black/50 font-semibold text-[1.2rem]">
          Currently You Don't have access
        </h1>
      </div>
    );
  }

  return (
    <>
      <Select
        // Use sentinel for the control value so “All Locations” is selectable again
        value={selectedLocation || ALL_LOCATIONS_VALUE}
        onValueChange={handleLocationChange}
        disabled={currentUser?.role !== "admin" && companyUserLocations.length <= 1}
      >
        <SelectTrigger>
          <SelectValue placeholder={selectedLocationName} />
        </SelectTrigger>

        <SelectContent>
          {currentUser?.role === "admin" && (
            <SelectItem value={ALL_LOCATIONS_VALUE}>All Locations</SelectItem>
          )}
          {companyUserLocations.map((location) => (
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
