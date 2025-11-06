// src/components/locations/LocationEditRow.tsx
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { Location } from "@/context/InventoryContext";

interface LocationEditRowProps {
  location: Location;
  itemCount: number;
  companyName: string | null;
  onSave: (location: Location) => void;
  onCancel: () => void;
}

export const LocationEditRow = ({
  location,
  itemCount,
  companyName,
  onSave,
  onCancel,
}: LocationEditRowProps) => {
  const handleChange =
    (field: keyof Location) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onSave({ ...location, [field]: e.target.value });
    };

  const handleActiveChange = (checked: boolean | "indeterminate") => {
    onSave({ ...location, active: !!checked });
  };

  return (
    <TableRow>
      <TableCell>
        <Input
          value={location.name}
          onChange={handleChange("name")}
          placeholder="Location name"
        />
      </TableCell>
      <TableCell>
        <Input
          value={location.description || ""}
          onChange={handleChange("description")}
          placeholder="Description"
        />
      </TableCell>
      <TableCell>{companyName || "-"}</TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={location.active}
            onCheckedChange={handleActiveChange}
          />
          <span className="text-sm">{location.active ? "Active" : "Inactive"}</span>
        </div>
      </TableCell>
      <TableCell>{itemCount}</TableCell>
      <TableCell className="text-right space-x-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave(location)}
          className="ml-2"
        >
          Save
        </Button>
      </TableCell>
    </TableRow>
  );
};
