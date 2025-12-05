import { useInventory } from "@/context/InventoryContext";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { StatCard } from "@/components/dashboard/StatCard";
import { BarChart, FileText, CheckCheck, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function normalizeSummary(raw: Partial<Summary>): Summary {
  const totalItems = raw.totalItems ?? 0;
  const auditedItems = raw.auditedItems ?? 0;
  const matched = raw.matched ?? 0;
  const discrepancies = raw.discrepancies ?? 0;
  const pendingItems = Math.max(totalItems - auditedItems, 0);
  return { totalItems, auditedItems, matched, discrepancies, pendingItems };
}

export const InventoryOverview = () => {
  const { getLocationSummary } = useInventory();
  const { 
    selectedLocation, 
    setSelectedLocation, 
    availableLocations, 
    isAdmin 
  } = useLocationFilter();

  const summary: Summary = useMemo(() => {
    if (selectedLocation && selectedLocation !== "all") {
      const locationObj = availableLocations.find(
        (loc) => loc.id === selectedLocation
      );
      if (!locationObj) return ZERO_SUMMARY;
      return normalizeSummary(getLocationSummary(locationObj.name));
    }

    if (availableLocations.length === 0) return ZERO_SUMMARY;

    const aggregated = availableLocations.reduce<Summary>(
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
  }, [selectedLocation, availableLocations, getLocationSummary]);

  const completionPercentage = useMemo(() => {
    return summary.totalItems > 0
      ? Math.round((summary.auditedItems / summary.totalItems) * 100)
      : 0;
  }, [summary.auditedItems, summary.totalItems]);

  const selectedLocationName = useMemo(() => {
    if (selectedLocation === "all") {
      return "All Locations";
    }
    const location = availableLocations.find((loc) => loc.id === selectedLocation);
    return location?.name || "Select Location";
  }, [selectedLocation, availableLocations]);

  if (!isAdmin && availableLocations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <h1 className="text-black/50 font-semibold text-[1.2rem]">
          Currently You Don't have access
        </h1>
      </div>
    );
  }

  const showAllOption = isAdmin || availableLocations.length > 1;
  const isDropdownDisabled = !isAdmin && availableLocations.length <= 1;

  return (
    <>
      <div className="w-full">
        <Select
          value={selectedLocation}
          onValueChange={setSelectedLocation}
          disabled={isDropdownDisabled}
        >
          <SelectTrigger className="border-gray-200 focus:ring-indigo-600 focus:border-indigo-600 w-[200px]">
            <SelectValue placeholder={selectedLocationName} />
          </SelectTrigger>

          <SelectContent>
            {showAllOption && (
              <SelectItem value="all">All Locations</SelectItem>
            )}
            {availableLocations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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