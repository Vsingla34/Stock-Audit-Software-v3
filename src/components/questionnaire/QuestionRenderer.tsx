import { Question, useInventory } from "@/context/InventoryContext";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Loader2, Check, FileIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

interface QuestionRendererProps {
  question: Question;
  answer: string | string[];
  isError: boolean;
  isDisabled?: boolean;
  onChange: (questionId: string, value: string | string[]) => void;
}

export const QuestionRenderer = ({ 
  question, 
  answer, 
  isError, 
  isDisabled = false, 
  onChange 
}: QuestionRendererProps) => {
  const { uploadFile } = useInventory();
  const [isUploading, setIsUploading] = useState(false);
  
  const handleTextChange = (value: string) => {
    onChange(question.id, value);
  };

  const handleSingleSelectChange = (value: string) => {
    onChange(question.id, value);
  };

  const handleMultiSelectChange = (value: string, checked: boolean) => {
    const currentAnswers = (Array.isArray(answer) ? answer : []) as string[];

    if (checked) {
      onChange(question.id, [...currentAnswers, value]);
    } else {
      onChange(question.id, currentAnswers.filter(v => v !== value));
    }
  };

  const handleYesNoChange = (value: string) => {
    onChange(question.id, value);
  };

  // --- File Upload Handler ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optional: 5MB limit check
    if (file.size > 5 * 1024 * 1024) { 
       toast.error("File size must be less than 5MB");
       return;
    }

    setIsUploading(true);
    try {
      // Path format: answers/{question_id}/{timestamp}_{filename}
      // sanitize filename to avoid issues
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `answers/${question.id}/${Date.now()}_${sanitizedName}`;
      
      const url = await uploadFile(file, path);
      onChange(question.id, url); // Save the public URL as the answer
      toast.success("File uploaded successfully");
    } catch (err: any) {
      toast.error("Failed to upload file", {
        description: err.message || "Check your internet connection or permissions."
      });
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="pt-1">
      {isError && (
        <div className="flex items-center gap-2 text-sm text-red-600 mb-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          This question requires an answer
        </div>
      )}

      {/* --- TEXT INPUT --- */}
      {question.type === "text" && (
        isDisabled ? (
           <Input 
             value={(answer as string) || ""}
             disabled
             className="bg-gray-100 text-gray-600 border-gray-200 opacity-100 font-medium"
           />
        ) : (
          <Textarea
            value={(answer as string) || ""}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Enter your answer..."
            className={`${isError ? "border-red-500 focus-visible:ring-red-500" : "border-gray-200 focus-visible:ring-indigo-600"} min-h-[80px]`}
            disabled={isDisabled}
          />
        )
      )}

      {/* --- SINGLE SELECT --- */}
      {question.type === "single_select" && question.options && (
        <RadioGroup
          value={(answer as string) || ""}
          onValueChange={handleSingleSelectChange}
          className="space-y-3"
          disabled={isDisabled}
        >
          {question.options.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <RadioGroupItem 
                value={option.id} 
                id={`${question.id}-${option.id}`} 
                disabled={isDisabled}
                className="border-gray-300 text-indigo-600 focus-visible:ring-indigo-600 data-[state=checked]:border-indigo-600 data-[state=checked]:text-indigo-600"
              />
              <Label htmlFor={`${question.id}-${option.id}`} className={`font-normal ${isDisabled ? "opacity-70" : "text-gray-700"}`}>
                {option.text}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {/* --- MULTI SELECT --- */}
      {question.type === "multi_select" && question.options && (
        <div className="space-y-3">
          {question.options.map((option) => {
            const isChecked = Array.isArray(answer) &&
              (answer as string[]).includes(option.id);

            return (
              <div key={option.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${option.id}`}
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleMultiSelectChange(option.id, checked as boolean)
                  }
                  disabled={isDisabled}
                  className="border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 focus-visible:ring-indigo-600"
                />
                <Label htmlFor={`${question.id}-${option.id}`} className={`font-normal ${isDisabled ? "opacity-70" : "text-gray-700"}`}>
                  {option.text}
                </Label>
              </div>
            );
          })}
        </div>
      )}

      {/* --- YES/NO --- */}
      {question.type === "yes_no" && (
        <RadioGroup
          value={(answer as string) || ""}
          onValueChange={handleYesNoChange}
          className="flex space-x-6"
          disabled={isDisabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem 
              value="yes" 
              id={`${question.id}-yes`} 
              disabled={isDisabled}
              className="border-gray-300 text-indigo-600 focus-visible:ring-indigo-600 data-[state=checked]:border-indigo-600 data-[state=checked]:text-indigo-600"
            />
            <Label htmlFor={`${question.id}-yes`} className={isDisabled ? "opacity-70" : "text-gray-700"}>Yes</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem 
              value="no" 
              id={`${question.id}-no`} 
              disabled={isDisabled} 
              className="border-gray-300 text-indigo-600 focus-visible:ring-indigo-600 data-[state=checked]:border-indigo-600 data-[state=checked]:text-indigo-600"
            />
            <Label htmlFor={`${question.id}-no`} className={isDisabled ? "opacity-70" : "text-gray-700"}>No</Label>
          </div>
        </RadioGroup>
      )}

      {/* --- FILE UPLOAD (New) --- */}
      {question.type === "file" && (
        <div className="space-y-2">
           {isDisabled ? (
             <div className="p-3 border rounded-md bg-gray-50 flex items-center gap-2">
                {answer ? (
                   <a href={answer as string} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline text-sm flex items-center gap-2 hover:text-indigo-800">
                      <FileIcon className="h-4 w-4" /> View Attached File
                   </a>
                ) : <span className="text-gray-400 text-sm">No file uploaded</span>}
             </div>
           ) : (
             <div className="flex flex-col gap-2">
                <Input 
                  type="file" 
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="cursor-pointer file:text-indigo-600 file:font-semibold file:bg-indigo-50 file:border-0 file:mr-4 file:px-4 file:py-2 hover:file:bg-indigo-100"
                />
                
                {isUploading && (
                  <div className="flex items-center gap-2 text-xs text-indigo-600">
                     <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                  </div>
                )}
                
                {!isUploading && answer && (
                  <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                     <Check className="h-3 w-3" /> File attached
                     <a href={answer as string} target="_blank" rel="noopener noreferrer" className="underline ml-1">View</a>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
};