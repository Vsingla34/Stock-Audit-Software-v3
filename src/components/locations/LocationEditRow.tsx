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
    <TableRow className="bg-indigo-50/30">
      <TableCell>
        <Input
          value={location.name}
          onChange={handleChange("name")}
          placeholder="Location name"
          className="border-gray-200 focus-visible:ring-indigo-600 h-9"
        />
      </TableCell>
      <TableCell>
        <Input
          value={location.description || ""}
          onChange={handleChange("description")}
          placeholder="Description"
          className="border-gray-200 focus-visible:ring-indigo-600 h-9"
        />
      </TableCell>
      <TableCell className="text-gray-600">{companyName || "-"}</TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={location.active}
            onCheckedChange={handleActiveChange}
            className="border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
          />
          <span className={`text-sm ${location.active ? "text-indigo-700 font-medium" : "text-gray-500"}`}>
            {location.active ? "Active" : "Inactive"}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-gray-600">{itemCount}</TableCell>
      <TableCell className="text-right space-x-2">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onCancel}
          className="h-8 border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave(location)}
          className="ml-2 h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Save
        </Button>
      </TableCell>
    </TableRow>
  );
};