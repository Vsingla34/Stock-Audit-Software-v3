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
        <div className="flex items-center gap-2 text-sm text-red-600 mb-2">
          <AlertCircle className="h-4 w-4" />
          This question requires an answer
        </div>
      )}

      {question.type === "text" && (
        isDisabled ? (
           
           <Input 
             value={(answer as string) || ""}
             disabled
             className="bg-muted text-muted-foreground opacity-100 font-medium"
           />
        ) : (
          <Textarea
            value={(answer as string) || ""}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Enter your answer..."
            className={isError ? "border-red-500" : ""}
            disabled={isDisabled}
          />
        )
      )}

      {question.type === "single_select" && question.options && (
        <RadioGroup
          value={(answer as string) || ""}
          onValueChange={handleSingleSelectChange}
          className="space-y-2"
          disabled={isDisabled}
        >
          {question.options.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} disabled={isDisabled} />
              <Label htmlFor={`${question.id}-${option.id}`} className={isDisabled ? "opacity-70" : ""}>{option.text}</Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {question.type === "multi_select" && question.options && (
        <div className="space-y-2">
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
                />
                <Label htmlFor={`${question.id}-${option.id}`} className={isDisabled ? "opacity-70" : ""}>{option.text}</Label>
              </div>
            );
          })}
        </div>
      )}

      {question.type === "yes_no" && (
        <RadioGroup
          value={(answer as string) || ""}
          onValueChange={handleYesNoChange}
          className="flex space-x-4"
          disabled={isDisabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id={`${question.id}-yes`} disabled={isDisabled} />
            <Label htmlFor={`${question.id}-yes`} className={isDisabled ? "opacity-70" : ""}>Yes</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id={`${question.id}-no`} disabled={isDisabled} />
            <Label htmlFor={`${question.id}-no`} className={isDisabled ? "opacity-70" : ""}>No</Label>
          </div>
        </RadioGroup>
      )}
    </div>
  );
};