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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface QuestionnaireFormProps {
  locationId: string;
  assignmentId: number; 
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

export const QuestionnaireForm = ({ locationId, assignmentId, locationName, onComplete }: QuestionnaireFormProps) => {
  const { questions, getAssignmentQuestionnaireAnswers, saveQuestionnaireAnswer, locations } = useInventory();
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
    if (assignmentId) {
      const assignmentAnswers = getAssignmentQuestionnaireAnswers(assignmentId);
      const initialAnswers: AnswerState = {};
      assignmentAnswers.forEach(answer => {
        initialAnswers[answer.questionId] = answer.answer;
      });
      setAnswers(initialAnswers);
    }
  }, [assignmentId, getAssignmentQuestionnaireAnswers]);

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
          assignmentId, 
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
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-6">
          <div className="text-center space-y-1">
            <p className="text-gray-900 font-medium">No questions have been created for this audit.</p>
            <p className="text-sm text-gray-500">
              Ask an administrator to add questions to the questionnaire.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-sm border-gray-200">
      <CardHeader className="border-b border-gray-100 bg-gray-50/50">
        <CardTitle className="flex items-center text-gray-900">
          <ClipboardList className="h-5 w-5 mr-2 text-indigo-600" />
          Audit Questionnaire {locationName && <span className="text-gray-500 font-normal ml-1">for {locationName}</span>}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="w-[40%] pl-6">Question</TableHead>
              <TableHead className="pl-6">Response</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((question) => {
              const isError = showErrors && question.required && !isQuestionAnswered(question);
              const isAutoFilled = getAutoFillType(question.text) !== null;
              
              return (
                <TableRow 
                  key={question.id} 
                  className={`transition-colors ${isError ? 'bg-red-50 hover:bg-red-50' : 'hover:bg-gray-50/50'}`}
                >
                  <TableCell className="align-top font-medium text-gray-900 pl-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span>{question.text}</span>
                        {question.required && <span className="text-red-500">*</span>}
                      </div>
                      
                      {isAutoFilled && (
                        <span className="w-fit text-[10px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          Auto-filled
                        </span>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell className="align-top pl-6 py-4">
                    <QuestionRenderer 
                      question={question}
                      answer={answers[question.id] || (question.type === "multi_select" ? [] : "")}
                      isError={isError}
                      isDisabled={isAutoFilled}
                      onChange={handleAnswerChange}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <CardFooter className="border-t border-gray-100 p-6 bg-gray-50/50">
        <Button onClick={handleSubmit} className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all">
          <Save className="h-4 w-4 mr-2" />
          Save Answers
        </Button>
      </CardFooter>
    </Card>
  );
};