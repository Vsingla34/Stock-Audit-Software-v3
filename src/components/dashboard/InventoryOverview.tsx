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
  const { accessibleLocations } = useUserAccess();
  const { selectedCompanyId } = useCompany();

  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [hasInitialized, setHasInitialized] = useState(false);

  const isAdminOrSuperAdmin = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const userLocations = useMemo(() => accessibleLocations(), [accessibleLocations]);

  const companyUserLocations = useMemo(() => {
    if (!selectedCompanyId) return userLocations;
    return userLocations.filter((loc) => loc.companyId === selectedCompanyId);
  }, [userLocations, selectedCompanyId]);

  useEffect(() => {
    if (!hasInitialized && currentUser) {
      if (!isAdminOrSuperAdmin && companyUserLocations.length > 0) {
        setSelectedLocation(companyUserLocations[0].id);
      } else if (isAdminOrSuperAdmin) {
        setSelectedLocation("");
      }
      setHasInitialized(true);
    }
  }, [currentUser, companyUserLocations, hasInitialized, isAdminOrSuperAdmin]);

  useEffect(() => {
    if (!currentUser) return;
    if (isAdminOrSuperAdmin) {
      if (
        selectedLocation &&
        !companyUserLocations.some((l) => l.id === selectedLocation)
      ) {
        setSelectedLocation("");
      }
    } else {
      if (
        !selectedLocation ||
        !companyUserLocations.some((l) => l.id === selectedLocation)
      ) {
        setSelectedLocation(companyUserLocations[0]?.id ?? "");
      }
    }
  }, [currentUser, companyUserLocations, selectedLocation, isAdminOrSuperAdmin]);

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

    if (isAdminOrSuperAdmin) {
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
    isAdminOrSuperAdmin
  ]);

  const completionPercentage = useMemo(() => {
    return summary.totalItems > 0
      ? Math.round((summary.auditedItems / summary.totalItems) * 100)
      : 0;
  }, [summary.auditedItems, summary.totalItems]);

  const handleLocationChange = useCallback((value: string) => {
    setSelectedLocation(value === ALL_LOCATIONS_VALUE ? "" : value);
  }, []);

  const selectedLocationName = useMemo(() => {
    if (isAdminOrSuperAdmin && !selectedLocation) {
      return "All Locations";
    }
    const location = companyUserLocations.find((loc) => loc.id === selectedLocation);
    return location?.name || "Select Location";
  }, [isAdminOrSuperAdmin, companyUserLocations, selectedLocation]);

  if (!isAdminOrSuperAdmin && companyUserLocations.length === 0) {
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
        value={selectedLocation || ALL_LOCATIONS_VALUE}
        onValueChange={handleLocationChange}
        disabled={!isAdminOrSuperAdmin && companyUserLocations.length <= 1}
      >
        <SelectTrigger className="border-gray-200 focus:ring-indigo-600 focus:border-indigo-600 w-[200px]">
          <SelectValue placeholder={selectedLocationName} />
        </SelectTrigger>

        <SelectContent>
          {isAdminOrSuperAdmin && (
            <SelectItem value={ALL_LOCATIONS_VALUE}>All Locations</SelectItem>
          )}
          {companyUserLocations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
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
          icon={<BarChart className="h-4 w-4 text-indigo-600" />}
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
          <Progress value={completionPercentage} className="h-2 [&>*]:bg-indigo-600" />
          <div className="flex justify-between mt-1 text-sm text-muted-foreground">
            <span>{summary.auditedItems} audited</span>
            <span>{summary.pendingItems} pending</span>
          </div>
        </Card>
      </div>
    </>
  );
};