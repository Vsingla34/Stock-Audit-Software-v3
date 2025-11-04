import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";
import { Location } from "@/context/InventoryContext";

interface LocationFilterDropdownProps {
  selectedLocation: string;
  onLocationChange: (value: string) => void;
  availableLocations: Location[];
  showAllOption?: boolean;
  className?: string;
}

/**
 * Reusable location filter dropdown component
 * Can be used in any parent component that needs location filtering
 * 
 * @example
 * <LocationFilterDropdown
 *   selectedLocation={selectedLocation}
 *   onLocationChange={setSelectedLocation}
 *   availableLocations={availableLocations}
 * />
 */
export const LocationFilterDropdown: React.FC<LocationFilterDropdownProps> = ({
  selectedLocation,
  onLocationChange,
  availableLocations,
  showAllOption = true,
  className = ""
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedLocation} onValueChange={onLocationChange}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select location" />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && <SelectItem value="all">All Locations</SelectItem>}
          {availableLocations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};