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
    <Card className={`shadow-sm border-gray-200 transition-opacity ${disabled ? "opacity-60 bg-gray-50" : "bg-white"}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Label htmlFor={fileInputId} className="text-sm text-gray-500 font-normal">
            {description}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={fileInputId}
              type="file"
              accept=".csv"
              onChange={onFileChange}
              disabled={disabled}
              className="flex-1 file:text-indigo-600 file:font-medium file:bg-indigo-50 file:border-0 file:rounded-md file:px-2 file:mr-4 hover:file:bg-indigo-100 cursor-pointer focus-visible:ring-indigo-600 border-gray-200"
            />
            {file && !disabled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                className="h-10 w-10 text-gray-500 hover:text-red-600 hover:bg-red-50"
                type="button"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {file && (
            <div className="text-sm text-indigo-700 bg-indigo-50 p-2.5 rounded-md border border-indigo-100 flex items-center gap-2">
              <span className="font-semibold">Selected:</span> 
              <span>{file.name}</span>
              <span className="text-indigo-500 text-xs">({(file.size / 1024).toFixed(2)} KB)</span>
            </div>
          )}
          
          {disabled && (
            <div className="text-sm text-amber-700 bg-amber-50 p-2.5 rounded-md border border-amber-100">
              <strong>Note:</strong> Item Master must be uploaded first
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};