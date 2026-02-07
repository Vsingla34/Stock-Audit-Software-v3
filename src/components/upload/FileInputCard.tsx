import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, X, UploadCloud, Loader2 } from "lucide-react"; // Added Icons
import { Button } from "@/components/ui/button";

interface FileInputCardProps {
  title: string;
  description: string;
  fileInputId?: string; // Made optional to match FileUploader usage
  file: File | null;
  onFileChange: (file: File | null) => void; // Fixed signature to match FileUploader
  onUpload: () => void; // ADDED THIS
  isUploading?: boolean; // ADDED THIS
  disabled?: boolean;
  accept?: string;
  icon?: React.ReactNode;
}

export const FileInputCard: React.FC<FileInputCardProps> = ({
  title,
  description,
  fileInputId = `file-input-${title.replace(/\s+/g, '-').toLowerCase()}`,
  file,
  onFileChange,
  onUpload,
  isUploading = false,
  disabled = false,
  accept = ".csv",
  icon
}) => {
  
  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
  };

  return (
    <Card className={`shadow-sm border-gray-200 transition-opacity ${disabled ? "opacity-60 bg-gray-50" : "bg-white"}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          {icon || <FileSpreadsheet className="h-5 w-5 text-indigo-600" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4"> {/* Increased spacing */}
          <Label htmlFor={fileInputId} className="text-sm text-gray-500 font-normal">
            {description}
          </Label>
          
          <div className="flex items-center gap-2">
            <Input
              id={fileInputId}
              type="file"
              accept={accept}
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              disabled={disabled || isUploading}
              className="flex-1 file:text-indigo-600 file:font-medium file:bg-indigo-50 file:border-0 file:rounded-md file:px-2 file:mr-4 hover:file:bg-indigo-100 cursor-pointer focus-visible:ring-indigo-600 border-gray-200"
            />
            {file && !disabled && !isUploading && (
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
            <div className="text-sm text-indigo-700 bg-indigo-50 p-2.5 rounded-md border border-indigo-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold whitespace-nowrap">Selected:</span> 
                <span className="truncate">{file.name}</span>
              </div>
              <span className="text-indigo-500 text-xs whitespace-nowrap">({(file.size / 1024).toFixed(2)} KB)</span>
            </div>
          )}

          {/* ADDED SUBMIT BUTTON */}
          <Button 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            onClick={onUpload}
            disabled={!file || disabled || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload {title}
              </>
            )}
          </Button>
          
          {disabled && title === "Closing Stock" && (
            <div className="text-sm text-amber-700 bg-amber-50 p-2.5 rounded-md border border-amber-100">
              <strong>Note:</strong> Select an active assignment and ensure Item Master is uploaded.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};