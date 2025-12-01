import { useState } from "react";
import { Question, useInventory } from "@/context/InventoryContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Trash2, Plus, ListCheck, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { QuestionForm } from "./QuestionForm";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const QuestionList = () => {
  const { questions, deleteQuestion, addQuestion } = useInventory();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | undefined>();

  const handleAddClick = () => {
    setSelectedQuestion(undefined);
    setIsAddDialogOpen(true);
  };

  const handleEditClick = (question: Question) => {
    setSelectedQuestion(question);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (question: Question) => {
    setSelectedQuestion(question);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedQuestion) {
      try {
        await deleteQuestion(selectedQuestion.id);
        toast.success("Question deleted successfully");
        setIsDeleteDialogOpen(false);
        setSelectedQuestion(undefined);
      } catch (error: any) {
        toast.error("Failed to delete question", {
          description: error.message || "An unexpected error occurred."
        });
        console.error("Delete question error:", error);
      }
    }
  };

  
  const handleAddDefaults = async () => {
    const defaults = [
      { text: "Company", type: "text" as const, required: true },
      { text: "Location", type: "text" as const, required: true },
      { text: "Location Manager", type: "text" as const, required: true }, 
      { text: "Auditor Name", type: "text" as const, required: true },     
      { text: "Phone No.", type: "text" as const, required: true }
    ];

    let addedCount = 0;

    try {
      for (const def of defaults) {
        
        const exists = questions.some(
          q => q.text.toLowerCase() === def.text.toLowerCase()
        );

        if (!exists) {
          await addQuestion({
            text: def.text,
            type: def.type,
            required: def.required,
            options: []
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        toast.success(`Added ${addedCount} default questions successfully.`);
      } else {
        toast.info("Default questions already exist.");
      }
    } catch (error: any) {
      toast.error("Failed to add default questions", {
        description: error.message
      });
    }
  };

  const getQuestionTypeLabel = (type: Question["type"]) => {
    switch (type) {
      case "text": return "Text";
      case "single_select": return "Single Select";
      case "multi_select": return "Multi Select";
      case "yes_no": return "Yes/No";
      default: return type;
    }
  };

  
  const isAutoItem = (text: string) => {
    const t = text.toLowerCase();
    return ["company", "location", "auditor name"].includes(t);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center text-gray-900">
          <ListCheck className="h-5 w-5 mr-2 text-indigo-600" />
          Audit Questionnaire
        </h2>
        <div className="flex gap-2">
          <Button 
            onClick={handleAddDefaults} 
            variant="outline"
            className="border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Add Default Questions
          </Button>
          <Button 
            onClick={handleAddClick}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <Card className="bg-gray-50 border-dashed border-gray-200">
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <p className="text-gray-500">
                No questions have been created yet.
              </p>
              <div className="flex justify-center gap-2 mt-4">
                <Button 
                  onClick={handleAddDefaults} 
                  variant="outline"
                  className="border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Add Defaults
                </Button>
                <Button 
                  onClick={handleAddClick}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Question
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => {
            const isAuto = isAutoItem(question.text);
            return (
              <Card key={question.id} className="hover:bg-gray-50/80 transition-colors border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-gray-300 text-gray-600 font-normal">{getQuestionTypeLabel(question.type)}</Badge>
                        {question.required && <Badge className="bg-gray-900 hover:bg-gray-800">Required</Badge>}
                        {isAuto && <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200">Auto-Filled</Badge>}
                      </div>
                      <p className="font-medium text-gray-900">{question.text}</p>

                      {(question.type === "single_select" || question.type === "multi_select") && question.options && question.options.length > 0 && (
                        <div className="mt-2 text-sm text-gray-500">
                          <p className="mb-1 text-xs uppercase tracking-wider font-semibold text-gray-400">Options:</p>
                          <ul className="list-disc list-inside space-y-0.5 pl-2">
                            {question.options.map((option) => (
                              <li key={option.id}>{option.text}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleEditClick(question)}
                        className="hover:bg-indigo-50 hover:text-indigo-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDeleteClick(question)}
                        className="hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <QuestionForm
            onSave={() => setIsAddDialogOpen(false)}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <QuestionForm
            question={selectedQuestion}
            onSave={() => setIsEditDialogOpen(false)}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Question</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="border-gray-200">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};