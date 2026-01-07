import { useMemo } from "react";
import { useInventory, Assignment } from "@/context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useCompany } from "@/context/CompanyContext";
import { useLocationFilter } from "@/hooks/useLocationFilter";

export const RecentActivity = () => {
  const { auditedItems, locations, assignments } = useInventory();
  const { currentUser } = useUser();
  const { accessibleLocations } = useUserAccess();
  // FIX: Import selectedAssignmentId to ensure strict filtering
  const { selectedCompanyId, selectedAssignmentId } = useCompany();
  const { selectedLocation } = useLocationFilter();

  const userAccessibleLocations = accessibleLocations();
  const accessibleLocationNames = useMemo(
    () => userAccessibleLocations.map((loc) => loc.name),
    [userAccessibleLocations]
  );

  const locationByName = useMemo(() => {
    const map = new Map<string, (typeof locations)[number]>();
    locations.forEach((loc) => {
      map.set(loc.name, loc);
    });
    return map;
  }, [locations]);

  const filteredItems = useMemo(() => {
    // Determine strict assignment location constraint
    let assignmentLocationName: string | null = null;
    if (selectedAssignmentId) {
       const ass = assignments.find((a: Assignment) => a.id === selectedAssignmentId);
       if (ass) {
          const loc = locations.find(l => l.id === ass.locationId);
          if (loc) assignmentLocationName = loc.name;
       }
    }

    return auditedItems.filter((item) => {
      if (!item.status || item.status === "pending") return false;

      // FIX: If assignment is selected, ONLY show items from that location
      if (assignmentLocationName && item.location !== assignmentLocationName) {
        return false;
      }

      const itemLocation = locationByName.get(item.location);
      if (!itemLocation) return false;

      if (selectedCompanyId && itemLocation.companyId !== selectedCompanyId) {
        return false;
      }

      if (currentUser?.role === "admin") {
        if (selectedLocation && selectedLocation !== "all") {
          const locationObj = locations.find((loc) => loc.id === selectedLocation);
          return item.location === locationObj?.name;
        }
        return true;
      }

      if (selectedLocation && selectedLocation !== "all") {
        const locationObj = locations.find((loc) => loc.id === selectedLocation);
        return (
          item.location === locationObj?.name &&
          accessibleLocationNames.includes(item.location)
        );
      }

      return accessibleLocationNames.includes(item.location);
    });
  }, [
    auditedItems,
    locationByName,
    selectedCompanyId,
    currentUser,
    selectedLocation,
    accessibleLocationNames,
    locations,
    selectedAssignmentId, // Added dependency
    assignments
  ]);

  const recentItems = useMemo(() => {
    return [...filteredItems]
      .sort((a, b) => {
        if (!a.lastAudited || !b.lastAudited) return 0;
        return (
          new Date(b.lastAudited).getTime() - new Date(a.lastAudited).getTime()
        );
      })
      .slice(0, 5);
  }, [filteredItems]);

  if (recentItems.length === 0) {
    return (
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No recent audit activity
            {(selectedLocation && selectedLocation !== "all") || selectedAssignmentId ? " for this location" : ""}
            .
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-gray-900">
          <span>Recent Activity</span>
          {currentUser?.role !== "admin" && userAccessibleLocations.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              Your locations only
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentItems.map((item, index) => (
            <div
              key={`${item.id}-${item.lastAudited}-${index}`}
              className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
            >
              <div className="mt-1">
                {item.status === "matched" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                    <X className="h-4 w-4 text-red-600" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-500">
                  {item.sku} - {item.location}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <p
                  className={`font-medium ${
                    item.status === "matched"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {item.physicalQuantity} / {item.systemQuantity}
                </p>
                <p className="text-xs text-gray-400">
                  {item.lastAudited &&
                    format(new Date(item.lastAudited), "dd MMM, HH:mm")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};