import { useMemo } from "react";
import { useInventory, Assignment } from "@/context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, User } from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useCompany } from "@/context/CompanyContext";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { ScrollArea } from "@/components/ui/scroll-area"; 

export const RecentActivity = () => {
  const { auditedItems, locations, assignments } = useInventory();
  const { currentUser } = useUser();
  const { accessibleLocations } = useUserAccess();
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

  // 🔥 FIX: Filter items specifically looking for entries made by the current user
  const userSpecificActivity = useMemo(() => {
    if (!currentUser?.id) return { items: [], myTotalScans: 0 };

    let assignmentLocationName: string | null = null;
    if (selectedAssignmentId) {
       const ass = assignments.find((a: Assignment) => a.id === Number(selectedAssignmentId));
       if (ass) {
          const loc = locations.find(l => l.id === ass.locationId);
          if (loc) assignmentLocationName = loc.name;
       }
    }

    const filteredItems = auditedItems.filter((item) => {
      if (!item.status || item.status === "pending") return false;

      if (assignmentLocationName && item.location !== assignmentLocationName) {
        return false;
      }
      
      if (selectedAssignmentId && item.assignmentId && item.assignmentId !== Number(selectedAssignmentId)) {
        return false;
      }

      const itemLocation = locationByName.get(item.location);
      if (!itemLocation) return false;

      if (selectedCompanyId && itemLocation.companyId !== selectedCompanyId) {
        return false;
      }

      const hasAccess = 
        currentUser?.role === "admin" || 
        accessibleLocationNames.includes(item.location);

      if (!hasAccess) return false;

      if (selectedLocation && selectedLocation !== "all") {
        const locationObj = locations.find((loc) => loc.id === selectedLocation);
        return item.location === locationObj?.name;
      }

      // Check if the current user actually scanned this item
      const hasUserEntry = item.auditorEntries?.some(entry => entry.auditorId === currentUser.id);
      
      return hasUserEntry;
    });

    // Calculate personal totals and extract specific scan events
    let personalTotal = 0;
    const personalEvents: any[] = [];

    filteredItems.forEach(item => {
        // Find all entries made by this user on this item
        const userEntries = item.auditorEntries?.filter(e => e.auditorId === currentUser.id) || [];
        
        userEntries.forEach(entry => {
            personalTotal += (Number(entry.quantityFound) || 0);
            
            // Reconstruct a specific "event" for the timeline
            personalEvents.push({
                id: item.id,
                sku: item.sku,
                name: item.name,
                location: item.location,
                subLocation: entry.subLocation || "General",
                scannedQuantity: entry.quantityFound,
                timestamp: entry.auditedAt,
                // Status is based on the final total of the item vs system
                status: item.status 
            });
        });
    });

    // Sort events by timestamp (newest first)
    const sortedEvents = personalEvents.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateB - dateA;
    }).slice(0, 15); // Show last 15 scans

    return {
        items: sortedEvents,
        myTotalScans: personalTotal
    };
  }, [
    auditedItems,
    locationByName,
    selectedCompanyId,
    currentUser,
    selectedLocation,
    accessibleLocationNames,
    locations,
    selectedAssignmentId, 
    assignments
  ]);

  return (
    <Card className="shadow-sm border-gray-200 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/30 shrink-0">
        <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900 text-base">My Recent Activity</CardTitle>
            <div className="flex items-center gap-1.5 bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full text-xs font-semibold">
                <User className="h-3.5 w-3.5" />
                <span>My Scans: {userSpecificActivity.myTotalScans.toLocaleString()}</span>
            </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 min-h-0">
        {userSpecificActivity.items.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 flex flex-col items-center justify-center">
                <User className="h-8 w-8 text-gray-300 mb-2" />
                <p>You haven't scanned any items yet.</p>
            </div>
        ) : (
            <ScrollArea className="h-[400px] lg:h-[calc(100%-10px)]">
            <div className="space-y-0">
                {userSpecificActivity.items.map((event, index) => (
                <div
                    key={`${event.id}-${event.timestamp}-${index}`}
                    className="flex items-start gap-3 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                    <div className="mt-1 shrink-0">
                    {event.status === "matched" ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                        <Check className="h-4 w-4 text-green-600" />
                        </div>
                    ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                        <X className="h-4 w-4 text-amber-600" />
                        </div>
                    )}
                    </div>

                    <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{event.name || "Unnamed Item"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 truncate">{event.sku}</span>
                        <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 rounded-sm">{event.subLocation}</span>
                    </div>
                    </div>

                    <div className="text-right flex-shrink-0 ml-2">
                    <p className={`font-bold text-sm ${event.status === "matched" ? "text-green-600" : "text-amber-600"}`}>
                        +{event.scannedQuantity}
                    </p>
                    <p className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
                        {event.timestamp ? format(new Date(event.timestamp), "HH:mm") : "Just now"}
                    </p>
                    </div>
                </div>
                ))}
            </div>
            </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};