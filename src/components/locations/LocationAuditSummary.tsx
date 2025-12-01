import { useState, useEffect } from "react";
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
import { Building } from "lucide-react";
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
  const { locations, getLocationSummary } = useInventory();
  const { currentUser } = useUser(); 
  const [internalLocationId, setInternalLocationId] = useState<string>("");
  const { accessibleLocations } = useUserAccess();
  const userAccessibleLocations = accessibleLocations();

  // Use external ID if provided (controlled mode), otherwise use internal state
  const selectedLocation = externalLocationId !== undefined ? externalLocationId : internalLocationId;

  const selectedLocationObj = locations.find(loc => loc.id === selectedLocation);
  
  const locationSummary = selectedLocationObj 
    ? getLocationSummary(selectedLocationObj.name)
    : null;

  return (
    <Card className={`shadow-sm border-gray-200 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <Building className="h-5 w-5 text-indigo-600" />
          <span>Location Audit Summary</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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

          {locationSummary ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-indigo-50 p-4 border border-indigo-100">
                <div className="text-sm text-indigo-600 font-medium">Total Items</div>
                <div className="text-2xl font-bold text-gray-900">{locationSummary.totalItems}</div>
              </div>
              <div className="rounded-lg bg-green-50 p-4 border border-green-100">
                <div className="text-sm text-green-600 font-medium">Audited Items</div>
                <div className="text-2xl font-bold text-gray-900">{locationSummary.auditedItems}</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-4 border border-amber-100">
                <div className="text-sm text-amber-600 font-medium">Pending Items</div>
                <div className="text-2xl font-bold text-gray-900">{locationSummary.pendingItems}</div>
              </div>
              <div className="rounded-lg bg-violet-50 p-4 border border-violet-100">
                <div className="text-sm text-violet-600 font-medium">Match Rate</div>
                <div className="text-2xl font-bold text-gray-900">
                  {locationSummary.auditedItems > 0
                    ? `${Math.round((locationSummary.matched / locationSummary.auditedItems) * 100)}%`
                    : "N/A"}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              Select a location to view its audit summary
            </div>
          )}
          
          {locationSummary && locationSummary.auditedItems > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-gray-600 font-medium">Progress</span>
                <span className="text-indigo-600 font-bold">{locationSummary.totalItems > 0 ? Math.round((locationSummary.auditedItems / locationSummary.totalItems) * 100) : 0}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-in-out"
                  style={{
                    width: `${locationSummary.totalItems > 0 ? (locationSummary.auditedItems / locationSummary.totalItems) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};