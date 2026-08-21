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
  const accessibleLocationNames = useMemo(() => userAccessibleLocations.map((loc) => loc.name), [userAccessibleLocations]);
  const locationByName = useMemo(() => {
    const map = new Map<string, (typeof locations)[number]>();
    locations.forEach((loc) => { map.set(loc.name, loc); });
    return map;
  }, [locations]);

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
      if (assignmentLocationName && item.location !== assignmentLocationName) return false;
      if (selectedAssignmentId && item.assignmentId && item.assignmentId !== Number(selectedAssignmentId)) return false;
      const itemLocation = locationByName.get(item.location);
      if (!itemLocation) return false;
      if (selectedCompanyId && itemLocation.companyId !== selectedCompanyId) return false;
      const hasAccess = currentUser?.role === "admin" || accessibleLocationNames.includes(item.location);
      if (!hasAccess) return false;
      if (selectedLocation && selectedLocation !== "all") {
        const locationObj = locations.find((loc) => loc.id === selectedLocation);
        return item.location === locationObj?.name;
      }
      return item.auditorEntries?.some(entry => entry.auditorId === currentUser.id);
    });

    let personalTotal = 0;
    const personalEvents: any[] = [];
    filteredItems.forEach(item => {
        const userEntries = item.auditorEntries?.filter(e => e.auditorId === currentUser.id) || [];
        userEntries.forEach(entry => {
            personalTotal += (Number(entry.quantityFound) || 0);
            personalEvents.push({
                id: item.id, sku: item.sku, name: item.name, location: item.location,
                subLocation: entry.subLocation || "General", scannedQuantity: entry.quantityFound,
                timestamp: entry.auditedAt, status: item.status 
            });
        });
    });

    const sortedEvents = personalEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);
    return { items: sortedEvents, myTotalScans: personalTotal };
  }, [auditedItems, locationByName, selectedCompanyId, currentUser, selectedLocation, accessibleLocationNames, locations, selectedAssignmentId, assignments]);

  return (
    <Card className="shadow-sm border border-slate-200 bg-white rounded-2xl h-full flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50 shrink-0">
        <div className="flex items-center justify-between">
            <CardTitle className="text-slate-800 text-[12px] font-bold uppercase tracking-widest">My Recent Activity</CardTitle>
            <div className="flex items-center gap-2 bg-white border border-blue-200 text-blue-700 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                <User className="h-3 w-3" />
                <span>Scans: {userSpecificActivity.myTotalScans.toLocaleString()}</span>
            </div>
        </div>
      </CardHeader>
      
      {/* min-h-0 and flex-1 are crucial for letting ScrollArea take over the remaining height */}
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        {userSpecificActivity.items.length === 0 ? (
            <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center">
                <div className="p-4 bg-slate-100 rounded-full mb-3 border border-slate-200">
                  <User className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-[13px] font-semibold tracking-wide">No scan activity yet.</p>
            </div>
        ) : (
            <ScrollArea className="h-full w-full">
              <div className="space-y-0">
                  {userSpecificActivity.items.map((event, index) => (
                  <div
                      key={`${event.id}-${event.timestamp}-${index}`}
                      className="flex items-start gap-4 p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group cursor-default"
                  >
                      <div className="mt-0.5 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                      {event.status === "matched" ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100">
                          <Check className="h-4 w-4 text-emerald-600" />
                          </div>
                      ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 border border-rose-100">
                          <X className="h-4 w-4 text-rose-600" />
                          </div>
                      )}
                      </div>

                      <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-[13px] tracking-tight truncate group-hover:text-blue-700 transition-colors">{event.name || "Unnamed Item"}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[11px] font-medium text-slate-500 truncate">{event.sku}</span>
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md shadow-sm">{event.subLocation}</span>
                      </div>
                      </div>

                      <div className="text-right flex-shrink-0 ml-2">
                      <p className={`font-black text-[15px] tracking-tight ${event.status === "matched" ? "text-emerald-600" : "text-rose-600"}`}>
                          +{event.scannedQuantity}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 whitespace-nowrap mt-1 uppercase tracking-widest group-hover:text-blue-500 transition-colors">
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