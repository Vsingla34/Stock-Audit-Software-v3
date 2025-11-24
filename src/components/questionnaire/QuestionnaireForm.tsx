import { useEffect, useState } from "react";
import { Question, QuestionnaireAnswer, useInventory } from "@/context/InventoryContext";
import { useUser } from "@/context/UserContext";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClipboardList, Save } from "lucide-react";
import { QuestionRenderer } from "./QuestionRenderer";
import { supabase } from "@/integrations/supabase/client";

interface QuestionnaireFormProps {
  locationId: string;
  locationName?: string;
  onComplete?: () => void;
}

interface AnswerState {
  [questionId: string]: string | string[];
}


const getAutoFillType = (text: string) => {
  const t = text.trim().toLowerCase();
  if (['company', 'company name'].includes(t)) return 'company';
  if (['location', 'location name'].includes(t)) return 'location';
  if (['auditor', 'auditors', 'auditor name'].includes(t)) return 'auditor';
  return null;
};


export const QuestionnaireForm = ({ locationId, locationName, onComplete }: QuestionnaireFormProps) => {
  const { questions, getLocationQuestionnaireAnswers, saveQuestionnaireAnswer, locations } = useInventory();
  const { currentUser } = useUser();
  const { selectedCompanyId } = useCompany();
  
  const [answers, setAnswers] = useState<AnswerState>({});
  const [showErrors, setShowErrors] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");

  const targetLocation = locations.find(l => l.id === locationId);
  const activeCompanyId = targetLocation?.companyId || selectedCompanyId;

  
  useEffect(() => {
    const fetchCompany = async () => {
      if (!activeCompanyId) return;
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('name')
          .eq('id', activeCompanyId)
          .single();
        
        if (!error && data) {
          setCompanyName(data.name);
        }
      } catch (err) {
        console.error("Error fetching company name:", err);
      }
    };
    fetchCompany();
  }, [activeCompanyId]);

  
  useEffect(() => {
    if (locationId) {
      const locationAnswers = getLocationQuestionnaireAnswers(locationId);
      const initialAnswers: AnswerState = {};
      locationAnswers.forEach(answer => {
        initialAnswers[answer.questionId] = answer.answer;
      });
      setAnswers(initialAnswers);
    }
  }, [locationId, getLocationQuestionnaireAnswers]);

  
  useEffect(() => {
    if (!questions.length) return;

    setAnswers(prev => {
      const newAnswers = { ...prev };
      let hasChanges = false;

      questions.forEach(q => {
        const fillType = getAutoFillType(q.text);
        
        if (!fillType) return;

        let autoValue = "";

        if (fillType === 'auditor') {
          autoValue = currentUser?.name || currentUser?.email || "Current User";
        } else if (fillType === 'location') {
          autoValue = locationName || "";
        } else if (fillType === 'company') {
          autoValue = companyName || "";
        }

        if (autoValue && newAnswers[q.id] !== autoValue) {
          newAnswers[q.id] = autoValue;
          hasChanges = true;
        }
      });

      return hasChanges ? newAnswers : prev;
    });
  }, [questions, currentUser, locationName, companyName]); 

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const isQuestionAnswered = (question: Question): boolean => {
    const answer = answers[question.id];
    if (answer === undefined) return false;
    if (Array.isArray(answer)) return answer.length > 0;
    return answer.trim() !== "";
  };

  const getRequiredQuestionsUnanswered = (): Question[] => {
    return questions.filter(q => q.required && !isQuestionAnswered(q));
  };

  const handleSubmit = () => {
    const unansweredRequiredQuestions = getRequiredQuestionsUnanswered();
    
    if (unansweredRequiredQuestions.length > 0) {
      setShowErrors(true);
      toast.error(`Please answer all required questions (${unansweredRequiredQuestions.length} remaining)`);
      return;
    }
    
    questions.forEach(question => {
      const answer = answers[question.id];
      if (answer !== undefined) {
        saveQuestionnaireAnswer({
          questionId: question.id,
          locationId,
          answer,
          answeredBy: currentUser?.name 
        });
      }
    });
    
    toast.success("Questionnaire saved successfully");
    if (onComplete) {
      onComplete();
    }
  };

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-1">
            <p>No questions have been created for this audit.</p>
            <p className="text-sm text-muted-foreground">
              Ask an administrator to add questions to the questionnaire.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <ClipboardList className="h-5 w-5 mr-2" />
          Audit Questionnaire {locationName && `for ${locationName}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {questions.map((question) => {
            const isError = showErrors && question.required && !isQuestionAnswered(question);
            const isAutoFilled = getAutoFillType(question.text) !== null;
            
            return (
              <div key={question.id} className={`space-y-2 ${isError ? 'p-2 border border-red-200 rounded-md bg-red-50' : ''}`}>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{question.text}</span>
                  {question.required && <span className="text-red-500">*</span>}
                  {isAutoFilled && <span className="text-xs text-muted-foreground ml-2">(Auto-filled)</span>}
                </div>
                
                <QuestionRenderer 
                  question={question}
                  answer={answers[question.id] || (question.type === "multi_select" ? [] : "")}
                  isError={isError}
                  isDisabled={isAutoFilled}
                  onChange={handleAnswerChange}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="border-t p-6">
        <Button onClick={handleSubmit} className="ml-auto">
          <Save className="h-4 w-4 mr-2" />
          Save Answers
        </Button>
      </CardFooter>
    </Card>
  );
};