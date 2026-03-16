import { useState, useMemo } from "react";
import { useInventory } from "@/context/InventoryContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building, Boxes, CheckCircle2, AlertCircle, User } from "lucide-react";
import { useUser } from "@/context/UserContext"; 

interface LocationAuditSummaryProps {
  locationId?: string;
  hideDropdown?: boolean;
  className?: string;
}

export const LocationAuditSummary = ({ 
  locationId: externalLocationId, 
  hideDropdown = false,
  className 
}: LocationAuditSummaryProps) => {
  const { locations, itemMaster, auditedItems } = useInventory(); 
  const { currentUser } = useUser(); 
  const [internalLocationId, setInternalLocationId] = useState<string>("");
  const { accessibleLocations } = useUserAccess();
  const userAccessibleLocations = accessibleLocations();

  const selectedLocation = externalLocationId !== undefined ? externalLocationId : internalLocationId;
  const selectedLocationObj = locations.find(loc => loc.id === selectedLocation);
  
 const stats = useMemo(() => {
    if (!selectedLocationObj) return null;

    const locationName = selectedLocationObj.name;
    
    // 🔥 PERFORMANCE FIX: O(N) Hash Map merge
    const itemMap = new Map();

    // 1. Put all master items for this location into the map
    itemMaster.forEach(item => {
        if (item.location === locationName) {
            itemMap.set(item.id, item);
        }
    });

    // 2. Instantly overwrite them with live data, and inject new surplus items
    auditedItems.forEach(liveItem => {
        if (liveItem.location === locationName) {
            itemMap.set(liveItem.id, liveItem);
        }
    });

    const latestItems = Array.from(itemMap.values());

    // 1. Total System Volume
    const totalStock = latestItems.reduce((sum, item) => sum + (Number(item.systemQuantity) || 0), 0);
    
    // 2. Total Physical Volume
    const activeAuditedItems = latestItems.filter(i => i.status && i.status !== 'pending');
    const auditedStock = activeAuditedItems.reduce((sum, item) => sum + (Number(item.physicalQuantity) || 0), 0);
    
    // 3. Matched Physical Volume
    const matchedItems = latestItems.filter(i => i.status === 'matched');
    const matchedStock = matchedItems.reduce((sum, item) => sum + (Number(item.physicalQuantity) || 0), 0);

    // 4. Calculate My Personal Scanned Volume
    const myScannedStock = latestItems.reduce((total, item) => {
        if (!currentUser?.id || !item.auditorEntries) return total;
        
        const myEntries = item.auditorEntries.filter((e: any) => e.auditorId === currentUser.id);
        const mySum = myEntries.reduce((sum: number, entry: any) => sum + (Number(entry.quantityFound) || 0), 0);
        return total + mySum;
    }, 0);

    const pendingStock = Math.max(0, totalStock - auditedStock);
    
    const matchPercentage = totalStock > 0 ? Math.round((matchedStock / totalStock) * 100) : 0;
    const progressPercentage = totalStock > 0 ? Math.round((auditedStock / totalStock) * 100) : 0;

    return {
        totalStock,
        auditedStock,
        pendingStock,
        matchPercentage,
        progressPercentage,
        myScannedStock
    };
  }, [selectedLocationObj, itemMaster, auditedItems, currentUser]);

  return (
    <Card className={`shadow-sm border-gray-200 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-gray-900 text-lg">
          <Building className="h-5 w-5 text-indigo-600" />
          <span>Audit Progress (Qty)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {!hideDropdown && (
            <Select
              value={selectedLocation}
              onValueChange={setInternalLocationId}
            >
              <SelectTrigger className="border-gray-200 focus:ring-indigo-600 focus:border-indigo-600">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              
              <SelectContent>
                {currentUser?.role === "super_admin" || currentUser?.role === "admin" ? (
                  <>
                    <SelectItem value="">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </>
                ) : (
                  userAccessibleLocations.length > 0 ? (
                    userAccessibleLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-locations" disabled>
                      No assigned locations
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          )}

          {stats ? (
            <div className="space-y-4">
                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-indigo-50 p-3 border border-indigo-100 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Boxes className="h-3.5 w-3.5 text-indigo-600" />
                        <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Total Stock Qty</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900">{stats.totalStock.toLocaleString()}</div>
                  </div>
                  
                  <div className="rounded-xl bg-green-50 p-3 border border-green-100 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Audited Qty</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900">{stats.auditedStock.toLocaleString()}</div>
                  </div>

                  <div className="rounded-xl bg-amber-50 p-3 border border-amber-100 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 mb-1">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending Qty</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900">{stats.pendingStock.toLocaleString()}</div>
                  </div>

                  <div className="rounded-xl bg-violet-50 p-3 border border-violet-100 flex flex-col justify-between">
                    <div className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Match Rate (Qty)</div>
                    <div className="text-xl font-bold text-gray-900">{stats.matchPercentage}%</div>
                  </div>

                  {/* 🔥 NEW: My Scans Box (Spans 2 columns to look balanced) */}
                  <div className="col-span-2 rounded-xl bg-cyan-50 p-3 border border-cyan-200 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                        <User className="h-4 w-4 text-cyan-700" />
                        <span className="text-xs font-bold text-cyan-800 uppercase tracking-wide">My Personal Scans</span>
                    </div>
                    <div className="text-2xl font-black text-cyan-900">{stats.myScannedStock.toLocaleString()}</div>
                  </div>
                </div>

                {/* Progress Bar (Quantity Based) */}
                <div>
                  <div className="mb-2 flex justify-between text-xs font-medium">
                    <span className="text-gray-500">Overall Progress (By Volume)</span>
                    <span className="text-indigo-700">{stats.progressPercentage}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 border border-gray-100">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                      style={{ width: `${Math.min(stats.progressPercentage, 100)}%` }}
                    />
                  </div>
                </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              Select a location to view stats
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};