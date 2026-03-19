import { useInventory, Question } from "@/context/InventoryContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileIcon, ExternalLink } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useLocationFilter } from "@/hooks/useLocationFilter";

export const QuestionnaireResponses = () => {
  const { 
    questionnaireAnswers, 
    questions, 
    locations,
    selectedLocationFilter 
  } = useInventory();
  
  const { selectedLocation } = useLocationFilter();
  const activeFilter = selectedLocation || selectedLocationFilter;

  const filteredAnswers = questionnaireAnswers.filter((answer) => {
    if (!activeFilter || activeFilter === "all") return true;
    return answer.locationId === activeFilter;
  });

  if (filteredAnswers.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
        No questionnaire responses found for this selection.
      </div>
    );
  }

  // 🔥 FIX: Properly handle the new JSON File object
  const formatAnswer = (answer: string | string[], question?: Question, forExcel = false) => {
    if (!question) return String(answer);

    let val: any = answer;
    if (typeof val === "string") {
      try {
        if (val.trim().startsWith("[") || val.trim().startsWith("{")) {
          val = JSON.parse(val);
        }
      } catch {}
    }

    // --- CASE: FILE UPLOAD ---
    if (question.type === "file") {
      let url = "";
      let context = "";

      // Check if it successfully parsed into our new {url, context} object
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
         url = val.url || "";
         context = val.context || "";
      } else {
         // Fallback for old data that was just a direct URL string
         url = val ? String(val) : "";
      }

      if (!url) return "No File";
      
      if (forExcel) {
         return context ? `${url} (Context: ${context})` : url; 
      }
      
      return (
        <div className="flex flex-col gap-1">
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline font-medium"
          >
            <FileIcon className="h-3 w-3" /> View File <ExternalLink className="h-3 w-3" />
          </a>
          {context && (
            <span className="text-xs text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100 max-w-xs break-words">
              {context}
            </span>
          )}
        </div>
      );
    }

    if (question.type === "yes_no") {
      const v = Array.isArray(val) ? val[0] : val;
      const s = String(v ?? "").toLowerCase();
      if (["yes", "true", "1"].includes(s)) return "Yes";
      if (["no", "false", "0"].includes(s)) return "No";
      return String(v ?? "");
    }

    if ((question.type === "single_select" || question.type === "multi_select") && question.options) {
      const ids = Array.isArray(val) ? val : [val];
      const labels = ids.map((id: string) => {
        const opt = question.options?.find((o) => o.id === id);
        return opt ? opt.text : id;
      });
      return labels.join(", ");
    }

    if (Array.isArray(val)) {
      return val.join(", ");
    }

    return String(val);
  };

  const handleExport = () => {
    try {
      const exportData = filteredAnswers.map((ans) => {
        const question = questions.find((q) => q.id === ans.questionId);
        const location = locations.find((l) => l.id === ans.locationId);
        
        return {
          "Date": new Date(ans.answeredOn).toLocaleDateString(),
          "Time": new Date(ans.answeredOn).toLocaleTimeString(),
          "Location": location?.name || "Unknown Location",
          "Question": question?.text || "Deleted Question",
          "Answer": formatAnswer(ans.answer, question, true), 
          "Answered By": ans.answeredBy || "Unknown User"
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const wscols = [
        { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 50 }, { wch: 20 }, 
      ];
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, "Questionnaire Responses");
      const fileName = `Questionnaire_Responses_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Questionnaire responses exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export responses");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Responses</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          onClick={handleExport}
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Location</TableHead>
                <TableHead className="w-[40%]">Question</TableHead>
                <TableHead>Answer & Files</TableHead>
                <TableHead>Auditor</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAnswers.map((ans) => {
                const question = questions.find((q) => q.id === ans.questionId);
                const location = locations.find((l) => l.id === ans.locationId);

                return (
                  <TableRow key={`${ans.questionId}-${ans.locationId}-${ans.answeredOn}`}>
                    <TableCell className="font-medium">
                      {location?.name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {question?.text || <span className="text-gray-400 italic">Question Deleted</span>}
                      {question?.required && <span className="text-red-500 ml-1">*</span>}
                    </TableCell>
                    <TableCell>
                      {formatAnswer(ans.answer, question, false)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {ans.answeredBy || "-"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-gray-400">
                      {new Date(ans.answeredOn).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};