import { useMemo } from "react";
import { useInventory } from "@/context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useCompany } from "@/context/CompanyContext";

interface RecentActivityProps {
  selectedLocation?: string;
}

export const RecentActivity = ({ selectedLocation }: RecentActivityProps) => {
  const { auditedItems, locations } = useInventory();
  const { currentUser } = useUser();
  const { accessibleLocations } = useUserAccess();
  const { selectedCompanyId } = useCompany();

 
  const userAccessibleLocations = accessibleLocations();
  const accessibleLocationNames = userAccessibleLocations.map((loc) => loc.name);

  
  const locationByName = useMemo(() => {
    const map = new Map<string, (typeof locations)[number]>();
    locations.forEach((loc) => {
      map.set(loc.name, loc);
    });
    return map;
  }, [locations]);

 
  const filteredItems = auditedItems.filter((item) => {
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

  
  const recentItems = [...filteredItems]
    .sort((a, b) => {
      if (!a.lastAudited || !b.lastAudited) return 0;
      return (
        new Date(b.lastAudited).getTime() - new Date(a.lastAudited).getTime()
      );
    })
    .slice(0, 5);

  if (recentItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No recent audit activity
            {selectedLocation && selectedLocation !== "all" && " for this location"}
            .
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
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
              className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0"
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
                <p className="font-medium truncate">{item.name}</p>
                <p className="text-sm text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">
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
