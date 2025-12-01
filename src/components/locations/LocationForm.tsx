import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompany } from "@/context/CompanyContext";

interface LocationFormProps {
  locations: any[];
  onSave: (location: {
    name: string;
    description?: string;
    active: boolean;
    companyId: string;
  }) => void;
  onCancel: () => void;
}

export const LocationForm = ({
  locations,
  onSave,
  onCancel,
}: LocationFormProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  const { selectedCompanyId } = useCompany();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Location name is required");
      return;
    }

    const companyIdFromSession = sessionStorage.getItem("selectedCompanyId");
    const companyIdFromLocal = localStorage.getItem("selectedCompanyId");

    const companyId =
      selectedCompanyId || companyIdFromSession || companyIdFromLocal;

    if (!companyId) {
      toast.error("No company selected. Please select a company first.");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      active,
      companyId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-6 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-gray-700">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Warehouse A"
            required
            className="border-gray-200 focus-visible:ring-indigo-600"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description" className="text-gray-700">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="border-gray-200 focus-visible:ring-indigo-600"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="active"
          checked={active}
          onCheckedChange={(checked) => setActive(!!checked)}
          className="border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 focus-visible:ring-indigo-600"
        />
        <Label htmlFor="active" className="text-gray-700 font-normal cursor-pointer">Active</Label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button 
          variant="outline" 
          type="button" 
          onClick={onCancel}
          className="border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
        >
          Cancel
        </Button>
        <Button 
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
        >
          Save
        </Button>
      </div>
    </form>
  );
};