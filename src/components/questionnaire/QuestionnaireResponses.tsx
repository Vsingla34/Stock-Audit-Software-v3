import { useInventory, QuestionnaireAnswer } from "@/context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Download, FileText, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx"; 

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface QuestionnaireResponsesProps {
  locationId: string;
  locationName: string;
}

export const QuestionnaireResponses = ({
  locationId,
  locationName,
}: QuestionnaireResponsesProps) => {
  const { questions, questionnaireAnswers, getQuestionById } = useInventory();

  
  const formatAnswerForDisplay = (answerObj: QuestionnaireAnswer): string => {
    const question = getQuestionById(answerObj.questionId);
    let raw: any = answerObj.answer;

    
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          raw = parsed;
        }
      } catch {
        
      }
    }

    if (!question) {
      return Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
    }


    if (question.type === "yes_no") {
      const v = Array.isArray(raw) ? raw[0] : raw;
      const s = String(v ?? "").toLowerCase();
      if (["yes", "true", "1"].includes(s)) return "Yes";
      if (["no", "false", "0"].includes(s)) return "No";
      return String(v ?? "");
    }

    
    if (question.type === "single_select") {
      const optionId = Array.isArray(raw) ? raw[0] : raw;
      const opt = question.options?.find((o) => o.id === optionId);
      return opt?.text ?? String(optionId ?? "");
    }

    
    if (question.type === "multi_select") {
      const ids = Array.isArray(raw) ? raw : [raw];
      const labels = ids
        .map((id) => {
          const opt = question.options?.find((o) => o.id === id);
          return opt?.text ?? String(id ?? "");
        })
        .filter(Boolean);
      return labels.join(", ");
    }

    
    return Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
  };


  const generateExcel = () => {
    try {
      const filteredAnswers = questionnaireAnswers.filter(
        (answer) => answer.locationId === locationId
      );

      if (filteredAnswers.length === 0 && questions.length === 0) {
        toast.error("No data available to export");
        return;
      }

      
      const excelData = questions.map((question) => {
        const answer = filteredAnswers.find(
          (a) => a.questionId === question.id
        );
        
        const answerText = answer 
          ? formatAnswerForDisplay(answer) 
          : "-";

        const answeredBy = answer?.answeredBy 
          ? `${answer.answeredBy} (${new Date(answer.answeredOn).toLocaleDateString()})` 
          : "-";

        return {
          "Question": question.text,
          "Answer": answerText,
          "Answered By": answeredBy
        };
      });

      
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      
      const colWidths = [
        { wch: 40 }, 
        { wch: 40 }, 
        { wch: 30 }, 
      ];
      worksheet["!cols"] = colWidths;

      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Questionnaire");

      
      const safeName = locationName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `questionnaire_responses_${safeName}.xlsx`;

      
      XLSX.writeFile(workbook, fileName);

      toast.success("Excel file downloaded successfully");
    } catch (error) {
      console.error("Excel generation error:", error);
      toast.error("Failed to generate Excel file");
    }
  };

  
  const generatePDF = () => {
    try {
      const locationAnswers = questionnaireAnswers.filter(
        (answer) => answer.locationId === locationId
      );

      if (locationAnswers.length === 0) {
        toast.error("No responses available for this location");
        return;
      }

      const doc = new jsPDF();

      
      doc.setFontSize(18);
      doc.text(`Audit Questionnaire Responses: ${locationName}`, 14, 22);

      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

      

      
      const head = [['Question', 'Answer', 'Answered By']];

      
      const body = locationAnswers
      .map(answer => {
        const question = getQuestionById(answer.questionId);
        
        
        if (!question) return null;
        
        const questionText = doc.splitTextToSize(question.text, 80);
        const answerText = doc.splitTextToSize(formatAnswerForDisplay(answer) || "-", 70);
        
        const answeredOn = new Date(answer.answeredOn).toLocaleString();
        const answeredBy = answer.answeredBy
          ? `${answer.answeredBy}\n${answeredOn}`
          : `${answeredOn}`;
          
        return [questionText, answerText, answeredBy];
      })
      .filter(row => row !== null);

      
      autoTable(doc, {
        head: head,
        body: body,
        startY: 40, 
        theme: "grid",
        styles: {
          cellPadding: 2,
          fontSize: 10,
          valign: 'middle', 
        },
        headStyles: {
          fillColor: [41, 128, 185], 
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 80 },  
          1: { cellWidth: 70 },   
          2: { cellWidth: 'auto' }, 
        },
      });

      
     
      doc.addPage();
      doc.setFontSize(12);
      doc.text("Approval Sign-off", 14, 20);

      doc.setFontSize(11);
      doc.text("Auditor Signature: _______________________", 14, 40);
      doc.text("Date: _______________________", 14, 50);

      doc.text("Client Signature: _______________________", 14, 70);
      doc.text("Date: _______________________", 14, 80);

      doc.text("Approved By: _______________________", 14, 100);
      doc.text("Role: _______________________", 14, 110);
      doc.text("Date: _______________________", 14, 120);

      doc.save(
        `questionnaire-responses-${locationName
          .replace(/\s+/g, "-")
          .toLowerCase()}.pdf`
      );

      toast.success("PDF generated successfully");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const filteredAnswers = questionnaireAnswers.filter(
    (answer) => answer.locationId === locationId
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Questionnaire Responses for {locationName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.length > 0 ? (
          <div className="space-y-6">
            
            <div className="flex justify-end gap-2">
              <Button onClick={generateExcel} variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button onClick={generatePDF}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>

            <div className="space-y-6">
              {questions.map((question) => {
                const answer = filteredAnswers.find(
                  (a) => a.questionId === question.id
                );
                
               
                
                return (
                  <div
                    key={question.id}
                    className="border rounded-md p-4 space-y-2 bg-slate-50"
                  >
                    <div className="font-medium">{question.text}</div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {question.type === "text"
                        ? "Text response"
                        : question.type === "single_select"
                        ? "Single choice"
                        : question.type === "multi_select"
                        ? "Multiple choice"
                        : "Yes/No question"}
                    </div>

                    <div className="bg-white p-3 rounded border">
                      <p>{answer ? formatAnswerForDisplay(answer) : "-"}</p>
                    </div>

                    {answer && (
                      <div className="text-xs text-muted-foreground">
                        {answer.answeredBy && <>Answered by {answer.answeredBy} on </>}
                        {new Date(answer.answeredOn).toLocaleString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No responses found</AlertTitle>
            <AlertDescription>
              There are no questionnaire responses for this location yet.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};