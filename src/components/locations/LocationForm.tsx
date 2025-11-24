// src/components/locations/LocationForm.tsx
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
    <form onSubmit={handleSubmit} className="space-y-3 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Warehouse A"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="active"
          checked={active}
          onCheckedChange={(checked) => setActive(!!checked)}
        />
        <Label htmlFor="active">Active</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
};
