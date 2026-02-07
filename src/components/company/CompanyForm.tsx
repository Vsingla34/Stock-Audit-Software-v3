import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,  
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CompanyFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const CompanyForm = ({ onSuccess, onCancel }: CompanyFormProps) => {
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([
          {
            name: companyName.trim(),
            address: companyAddress.trim() || null,
            is_active: isActive
          }
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success("Company created successfully", {
        description: `${companyName} has been added to the system.`
      });

      // Reset form
      setCompanyName("");
      setCompanyAddress("");
      setIsActive(true);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error creating company:", error);
      toast.error("Failed to create company", {
        description: error.message || "An error occurred while creating the company."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Add New Company</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name *</Label>
            <Input
              id="company-name"
              placeholder="Enter company name..."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-address">Company Address</Label>
            <Textarea
              id="company-address"
              placeholder="Enter company address..."
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="min-h-24"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="active-status"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isSubmitting}
            />
            <Label htmlFor="active-status">Active Status</Label>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        {onCancel && (
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        )}
        <Button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="ml-auto"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Add Company
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};