import { useInventory, QuestionnaireAnswer } from "@/context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface QuestionnaireResponsesProps {
  locationId: string;
  locationName: string;
}

export const QuestionnaireResponses = ({
  locationId,
  locationName,
}: QuestionnaireResponsesProps) => {
  const { questions, questionnaireAnswers, getQuestionById } = useInventory();

  // Central helper: convert stored answer → human-readable text
  const formatAnswerForDisplay = (answerObj: QuestionnaireAnswer): string => {
    const question = getQuestionById(answerObj.questionId);
    let raw: any = answerObj.answer;

    // If answer is a JSON-stringified array, parse it
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          raw = parsed;
        }
      } catch {
        // keep as string
      }
    }

    if (!question) {
      return Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
    }

    // Yes / No
    if (question.type === "yes_no") {
      const v = Array.isArray(raw) ? raw[0] : raw;
      const s = String(v ?? "").toLowerCase();
      if (["yes", "true", "1"].includes(s)) return "Yes";
      if (["no", "false", "0"].includes(s)) return "No";
      return String(v ?? "");
    }

    // Single select → one option id → label
    if (question.type === "single_select") {
      const optionId = Array.isArray(raw) ? raw[0] : raw;
      const opt = question.options?.find((o) => o.id === optionId);
      return opt?.text ?? String(optionId ?? "");
    }

    // Multi select → array of option ids → labels
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

    // Text question
    return Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
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

      // Title
      doc.setFontSize(18);
      doc.text(`Audit Questionnaire Responses: ${locationName}`, 14, 22);

      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

      let yPos = 40;

      // Responses
      locationAnswers.forEach((answer, index) => {
        const question = getQuestionById(answer.questionId);
        if (!question) return;

        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.setFont(undefined, "bold");
        doc.text(`${index + 1}. ${question.text}`, 14, yPos);
        yPos += 8;

        doc.setFont(undefined, "normal");

        const answerText = formatAnswerForDisplay(answer);
        const lines = doc.splitTextToSize(answerText || "-", 180);
        doc.text(lines, 14, yPos);
        yPos += 6 * lines.length + 10;

        doc.setFontSize(10);
        doc.setTextColor(100);

        const answeredOn = new Date(answer.answeredOn).toLocaleString();
        if (answer.answeredBy) {
          doc.text(
            `Answered by: ${answer.answeredBy} on ${answeredOn}`,
            14,
            yPos
          );
        } else {
          doc.text(`Answered on ${answeredOn}`, 14, yPos);
        }

        yPos += 15;
        doc.setTextColor(0);
      });

      // Sign-off page
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
        {filteredAnswers.length > 0 ? (
          <div className="space-y-6">
            <div className="flex justify-end">
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
                if (!answer) return null;

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
                      <p>{formatAnswerForDisplay(answer) || "-"}</p>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {answer.answeredBy && <>Answered by {answer.answeredBy} on </>}
                      {new Date(answer.answeredOn).toLocaleString()}
                    </div>
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

