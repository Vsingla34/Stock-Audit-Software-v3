// src/components/locations/LocationRow.tsx
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import type { Location } from "@/context/InventoryContext";

interface LocationRowProps {
  location: Location;
  itemCount: number;
  companyName: string | null;
  onEdit: (location: Location) => void;
  onDelete: (id: string) => void;
}

export const LocationRow = ({
  location,
  itemCount,
  companyName,
  onEdit,
  onDelete,
}: LocationRowProps) => {
  return (
    <TableRow>
      <TableCell>{location.name}</TableCell>
      <TableCell>{location.description || "-"}</TableCell>
      <TableCell>{companyName || "-"}</TableCell>
      <TableCell>
        {location.active ? (
          <span className="text-green-600">✓ Active</span>
        ) : (
          <span className="text-red-600">✗ Inactive</span>
        )}
      </TableCell>
      <TableCell>{itemCount}</TableCell>
      <TableCell className="text-right space-x-2">
        <Button variant="ghost" size="icon" onClick={() => onEdit(location)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(location.id)}
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </TableCell>
    </TableRow>
  );
};
