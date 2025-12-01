import { Question } from "@/context/InventoryContext";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

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

  return (
    <div className="pt-1">
      {isError && (
        <div className="flex items-center gap-2 text-sm text-red-600 mb-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          This question requires an answer
        </div>
      )}

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
    </div>
  );
};