import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileInputCardProps {
  title: string;
  description: string;
  fileInputId: string;
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export const FileInputCard: React.FC<FileInputCardProps> = ({
  title,
  description,
  fileInputId,
  file,
  onFileChange,
  disabled = false
}) => {
  const handleRemoveFile = () => {
    const input = document.getElementById(fileInputId) as HTMLInputElement;
    if (input) {
      input.value = '';
      // Trigger change event with empty files
      const event = new Event('change', { bubbles: true });
      input.dispatchEvent(event);
    }
  };

  return (
    <Card className={disabled ? "opacity-60" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor={fileInputId} className="text-sm text-muted-foreground">
            {description}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={fileInputId}
              type="file"
              accept=".csv"
              onChange={onFileChange}
              disabled={disabled}
              className="flex-1"
            />
            {file && !disabled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                className="h-10 w-10"
                type="button"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {file && (
            <div className="text-sm text-muted-foreground bg-green-50 p-2 rounded border border-green-200">
              <strong>Selected:</strong> {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}
          {disabled && (
            <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
              <strong>Note:</strong> Item Master must be uploaded first
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};