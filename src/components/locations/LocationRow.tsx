// src/components/locations/LocationRow.tsx
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import type { Location } from "@/context/InventoryContext";

type Props = {
  location: Location;
  companyName: string;
  itemCount: number;
  // When user clicks edit, parent will call startEditing(location)
  startEditing?: (loc: Location) => void;
  onEdit?: (loc: Location) => void;      // kept for compatibility
  onDelete?: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
};

export const LocationRow = ({
  location,
  companyName,
  itemCount,
  startEditing,
  onDelete,
  canEdit,
  canDelete,
}: Props) => {
  const handleEditClick = () => {
    if (!canEdit) return;
    // Prefer startEditing to enter edit mode row
    if (startEditing) startEditing(location);
  };

  const handleDeleteClick = () => {
    if (!canDelete) return;
    if (onDelete) onDelete(location.id);
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{location.name}</TableCell>
      <TableCell className="text-muted-foreground">
        {location.description || "-"}
      </TableCell>
      <TableCell>{companyName}</TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            location.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
          }`}
        >
          {location.active ? "Active" : "Inactive"}
        </span>
      </TableCell>
      <TableCell>{itemCount}</TableCell>

      <TableCell className="text-right">
        <div className="inline-flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditClick}
            disabled={!canEdit}
            aria-disabled={!canEdit}
            className={!canEdit ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}
            title={canEdit ? "Edit location" : "Edit disabled for your role"}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteClick}
            disabled={!canDelete}
            aria-disabled={!canDelete}
            className={!canDelete ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}
            title={canDelete ? "Delete location" : "Delete disabled for your role"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
