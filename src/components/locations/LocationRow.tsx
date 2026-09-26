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
      <TableCell className="p-2 md:p-4 sticky left-0 z-10 bg-indigo-50/30 md:static align-top">
        <Input
          value={location.name}
          onChange={handleChange("name")}
          placeholder="Location name"
          className="border-gray-200 focus-visible:ring-indigo-600 h-9 w-[110px] md:w-auto text-xs md:text-sm"
        />
        {/* Mobile-only: description + company inline since those columns are hidden below md */}
        <div className="md:hidden mt-2 space-y-1.5">
          <Input
            value={location.description || ""}
            onChange={handleChange("description")}
            placeholder="Description"
            className="border-gray-200 focus-visible:ring-indigo-600 h-8 text-xs w-full"
          />
          <p className="text-[10px] text-gray-500">{companyName || "-"}</p>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Input
          value={location.description || ""}
          onChange={handleChange("description")}
          placeholder="Description"
          className="border-gray-200 focus-visible:ring-indigo-600 h-9"
        />
      </TableCell>
      <TableCell className="hidden md:table-cell text-gray-600">{companyName || "-"}</TableCell>
      <TableCell className="p-2 md:p-4 align-top">
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={location.active}
            onCheckedChange={handleActiveChange}
            className="border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
          />
          <span className={`text-xs md:text-sm ${location.active ? "text-indigo-700 font-medium" : "text-gray-500"}`}>
            {location.active ? "Active" : "Inactive"}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-gray-600 text-xs md:text-sm p-2 md:p-4 align-top">{itemCount}</TableCell>
      <TableCell className="text-right p-2 md:p-4 align-top">
        <div className="flex flex-col md:inline-flex md:flex-row gap-1.5 md:gap-2 md:space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            className="h-8 border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 text-xs px-2 md:px-3"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(location)}
            className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2 md:px-3 md:ml-0"
          >
            Save
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};