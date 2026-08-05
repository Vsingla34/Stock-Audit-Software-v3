import { toastError } from "@/lib/handleError";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/context/CompanyContext";
import { useInventory } from "@/context/InventoryContext";
import SupabaseDataService from "@/services/SupabaseDataService";
import { 
  FileText, 
  MoreHorizontal, 
  FileSpreadsheet, 
  FileType, 
  Table as TableIcon,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const History = () => {
  const { selectedCompanyId } = useCompany();
  const { questions } = useInventory(); 
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!selectedCompanyId) return;
      try {
        const { data } = await supabase
          .from("companies")
          .select("name")
          .eq("id", selectedCompanyId)
          .single();
        if (data) setCompanyName(data.name);
      } catch (err) {
        console.error("Error fetching company name", err);
      }
    };
    fetchCompanyName();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadHistory();
    }
  }, [selectedCompanyId]);

  const loadHistory = async () => {
    try {
      const data = await SupabaseDataService.getAuditHistory(selectedCompanyId!);
      setReports(data || []);
    } catch (error) {
      toastError(error, "Failed to load audit history.");
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  // --- HELPER: CSV GENERATOR ---
  const generateCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast.error("No data available for this report");
      return;
    }
    const headers = Array.from(new Set(data.flatMap((item) => Object.keys(item))));
    let csvContent = headers.join(",") + "\n";

    data.forEach((item) => {
      const row = headers
        .map((header) => {
          const value = item[header] !== undefined ? String(item[header]) : "";
          return value.includes(",") ? `"${value}"` : value;
        })
        .join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${filename} downloaded`);
  };

  // --- REPORT 1: RECONCILIATION (CSV) ---
  const downloadReconciliation = (report: any) => {
    const items = report.report_data.items || [];
    
    // 1. Identify all unique auditors in this report
    const allAuditors = new Set<string>();
    items.forEach((item: any) => {
      if (Array.isArray(item.auditor_entries)) {
        item.auditor_entries.forEach((entry: any) => {
          allAuditors.add(entry.auditorName);
        });
      }
    });
    const auditorList = Array.from(allAuditors).sort();

    // 2. Build rows
    const reportData = items.map((item: any) => {
      const row: any = {
        SKU: item.sku,
        Name: item.name,
        Category: item.category,
        Location: report.locations?.name,
        "System Qty": item.system_quantity,
      };

      // Fill auditor columns
      auditorList.forEach((auditorName) => {
        const entry = Array.isArray(item.auditor_entries) 
          ? item.auditor_entries.find((e: any) => e.auditorName === auditorName)
          : null;
        row[auditorName] = entry ? entry.quantityFound : 0;
      });

      row["Physical Qty"] = item.physical_quantity;
      row.Variance = item.variance;
      row.Status = item.status;
      row.Remarks = item.remarks || "-";

      return row;
    });

    generateCSV(reportData, `reconciliation_${report.locations?.name}_${format(new Date(report.finalized_at), "yyyy-MM-dd")}.csv`);
  };

  // --- REPORT 2: DISCREPANCIES (CSV) ---
  const downloadDiscrepancies = (report: any) => {
    const items = report.report_data.items || [];
    const discrepancies = items.filter((item: any) => item.variance !== 0);

    if (discrepancies.length === 0) {
      toast.info("No discrepancies found in this audit.");
      return;
    }

    const reportData = discrepancies.map((item: any) => ({
      SKU: item.sku,
      Name: item.name,
      Category: item.category,
      Location: report.locations?.name,
      "System Qty": item.system_quantity,
      "Physical Qty": item.physical_quantity,
      Variance: item.variance,
      Remarks: item.remarks || "-",
    }));

    generateCSV(reportData, `discrepancies_${report.locations?.name}_${format(new Date(report.finalized_at), "yyyy-MM-dd")}.csv`);
  };

  // --- REPORT 3: SUMMARY (CSV) ---
  const downloadSummary = (report: any) => {
    const summary = report.report_data.summary || {};
    const summaryData = [{
      "Total Items": summary.totalItems,
      "Audited Items": summary.auditedItems,
      "Pending Items": summary.pendingItems,
      "Matched Items": summary.matched,
      "Discrepancies": summary.discrepancies,
      "Completion Rate": summary.totalItems > 0 ? Math.round((summary.auditedItems / summary.totalItems) * 100) + "%" : "0%",
      "Finalized Date": format(new Date(report.finalized_at), "PPpp"),
      "Location": report.locations?.name || "Unknown",
    }];

    generateCSV(summaryData, `summary_${report.locations?.name}_${format(new Date(report.finalized_at), "yyyy-MM-dd")}.csv`);
  };

  // --- REPORT 4: COMBINED EXCEL (XLSX) ---
  const downloadExcel = (report: any) => {
    const items = report.report_data.items || [];
    const summary = report.report_data.summary || {};
    
    // Reconciliation Sheet
    const allAuditors = new Set<string>();
    items.forEach((item: any) => {
        if(Array.isArray(item.auditor_entries)) item.auditor_entries.forEach((e:any) => allAuditors.add(e.auditorName));
    });
    const auditorList = Array.from(allAuditors).sort();

    const reconciliationData = items.map((item: any) => {
      const row: any = {
        SKU: item.sku,
        Name: item.name,
        Category: item.category,
        "System Qty": item.system_quantity,
      };
      auditorList.forEach((aud) => {
        const ent = Array.isArray(item.auditor_entries) ? item.auditor_entries.find((e:any) => e.auditorName === aud) : null;
        row[aud] = ent ? ent.quantityFound : 0;
      });
      row["Physical Qty"] = item.physical_quantity;
      row.Variance = item.variance;
      row.Status = item.status;
      row.Remarks = item.remarks || "-";
      return row;
    });

    // Discrepancy Sheet
    const discrepancyData = items
      .filter((i: any) => i.variance !== 0)
      .map((item: any) => ({
        SKU: item.sku,
        Name: item.name,
        Category: item.category,
        "System Qty": item.system_quantity,
        "Physical Qty": item.physical_quantity,
        Variance: item.variance,
        Remarks: item.remarks || "-"
      }));

    // Summary Sheet
    const summaryData = [{
      "Company": companyName,
      "Location": report.locations?.name,
      "Finalized Date": format(new Date(report.finalized_at), "PPpp"),
      "Total Items": summary.totalItems,
      "Audited Items": summary.auditedItems,
      "Matched": summary.matched,
      "Discrepancies": summary.discrepancies,
      "Completion Rate": summary.totalItems > 0 ? Math.round((summary.auditedItems / summary.totalItems) * 100) + "%" : "0%"
    }];

    const wb = XLSX.utils.book_new();
    const wsRec = XLSX.utils.json_to_sheet(reconciliationData);
    const wsDisc = XLSX.utils.json_to_sheet(discrepancyData);
    const wsSum = XLSX.utils.json_to_sheet(summaryData);

    XLSX.utils.book_append_sheet(wb, wsRec, "Reconciliation");
    XLSX.utils.book_append_sheet(wb, wsDisc, "Discrepancies");
    XLSX.utils.book_append_sheet(wb, wsSum, "Summary");

    XLSX.writeFile(wb, `full_audit_report_${report.locations?.name}.xlsx`);
    toast.success("Excel report downloaded");
  };

  // --- FORMAT HELPER ---
  const formatQuestionnaireAnswer = (answer: string | string[], question: any) => {
    let val: any = answer;
    if (typeof val === "string") { try { if (val.trim().startsWith("[") || val.trim().startsWith("{")) { val = JSON.parse(val); } } catch {} }
    
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
            const opt = question.options?.find((o: any) => o.id === id); 
            return opt ? opt.text : id; 
        }); 
        return labels.join(", "); 
    }
    
    if (Array.isArray(val)) { return val.join(", "); }
    return String(val);
  };

  // --- REPORT 5: COMPLETE PDF ---
  const downloadPDF = (report: any) => {
    try {
      const doc = new jsPDF();
      const data = report.report_data;
      const summary = data.summary || {};
      const locationName = report.locations?.name || "Unknown";
      
      const savedAnswers = data.questionnaire || [];

      // DEDUPLICATION & FILTERING LOGIC
      let validAnswers = savedAnswers;
      
      // 1. If this report belongs to a specific assignment, try to filter answers for that assignment
      // This fixes the issue of answers from other assignments showing up
      if (report.assignment_id) {
          const assignmentSpecific = savedAnswers.filter((a: any) => a.assignmentId === report.assignment_id);
          // Only switch to assignment-specific if we actually found some (for backward compatibility with old reports)
          if (assignmentSpecific.length > 0) {
              validAnswers = assignmentSpecific;
          }
      }

      // 2. Deduplicate by questionId to prevent repeating rows
      const uniqueMap = new Map();
      validAnswers.forEach((ans: any) => {
          uniqueMap.set(ans.questionId, ans);
      });
      const finalAnswers = Array.from(uniqueMap.values());

      // Helper to lookup answers for this report
      const getAnswerText = (questionText: string) => {
          const q = questions.find(q => q.text.trim().toLowerCase() === questionText.trim().toLowerCase());
          if (!q) return "N/A";
          const ans = finalAnswers.find((a: any) => a.questionId === q.id); // Use finalAnswers
          if (!ans) return "N/A";
          return formatQuestionnaireAnswer(ans.answer, q);
      };

      let currentY = 20;
      doc.setFontSize(20); 
      doc.setTextColor(40); 
      doc.text("Inventory Audit Report", 14, currentY);
      
      currentY += 10;
      doc.setFontSize(11); 
      doc.setTextColor(100);
      doc.text(`Company: ${companyName}`, 14, currentY);
      
      currentY += 7;
      doc.text(`Location: ${locationName}`, 14, currentY);
      
      currentY += 7;
      doc.text(`Finalized on: ${format(new Date(report.finalized_at), "PPpp")}`, 14, currentY);

      // EXTRACTED HEADER INFO
      const locManager = getAnswerText("Location Manager");
      const audName = getAnswerText("Auditor Name");
      const phone = getAnswerText("Phone No.");

      if (locManager !== "N/A") { currentY += 7; doc.text(`Location Manager: ${locManager}`, 14, currentY); }
      if (audName !== "N/A") { currentY += 7; doc.text(`Auditor: ${audName}`, 14, currentY); }
      if (phone !== "N/A") { currentY += 7; doc.text(`Phone: ${phone}`, 14, currentY); }

      currentY += 14;
      doc.setFontSize(14); 
      doc.setTextColor(0); 
      doc.text("Audit Summary", 14, currentY);
      
      const summaryBody = [
        ["Total Items", String(summary.totalItems || 0)],
        ["Audited Items", String(summary.auditedItems || 0)],
        ["Matched", String(summary.matched || 0)],
        ["Discrepancies", String(summary.discrepancies || 0)],
        ["Completion Rate", summary.totalItems > 0 ? Math.round((summary.auditedItems / summary.totalItems) * 100) + "%" : "0%"]
      ];
      
      autoTable(doc, {
        startY: currentY + 4,
        head: [["Metric", "Value"]],
        body: summaryBody,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });
      
      currentY = (doc as any)["lastAutoTable"].finalY + 15;

      // --- Observations Section ---
      doc.setFontSize(14); 
      doc.text("Observations", 14, currentY);
      const observations: string[] = [];
      if (summary.discrepancies > 0) { 
        observations.push(`There are ${summary.discrepancies} items with quantity discrepancies.`); 
      } else { 
        observations.push("All audited items match their expected quantities."); 
      }
      if (summary.pendingItems > 0) { 
        observations.push(`${summary.pendingItems} items (${Math.round((summary.pendingItems / summary.totalItems) * 100)}%) are still pending audit.`); 
      } else { 
        observations.push("All items have been audited."); 
      }

      let observationY = currentY + 10;
      observations.forEach((obs) => { 
        doc.setFontSize(11); 
        doc.text(`• ${obs}`, 16, observationY); 
        observationY += 7; 
      });

      currentY = observationY + 5;

      // --- Discrepancies Table ---
      const items = data.items || [];
      const discrepancies = items.filter((i: any) => i.variance !== 0);

      if (discrepancies.length > 0) {
         doc.setFontSize(14);
         doc.text("Discrepancy Details", 14, currentY);
         const discBody = discrepancies.map((i: any) => [
            i.sku,
            i.name,
            String(i.system_quantity),
            String(i.physical_quantity),
            String(i.variance),
            i.remarks || "-"
         ]);

         autoTable(doc, {
            startY: currentY + 5,
            head: [["SKU", "Name", "Sys", "Phy", "Var", "Remarks"]],
            body: discBody,
            theme: 'grid',
            headStyles: { fillColor: [249, 115, 22] },
            styles: { fontSize: 8 },
            columnStyles: { 5: { cellWidth: 40 } }
         });
         currentY = (doc as any)["lastAutoTable"].finalY + 15;
      }

      // --- Questionnaire Table ---
      const hiddenQuestions = ["company", "location", "location manager", "auditor name", "phone no."];
      const answersToDisplay: any[] = [];
      
      // Use finalAnswers (deduplicated) here
      finalAnswers.forEach((ans: any) => {
         const q = questions.find(q => q.id === ans.questionId);
         if (q && !hiddenQuestions.includes(q.text.trim().toLowerCase())) {
             answersToDisplay.push([
                 q.text,
                 formatQuestionnaireAnswer(ans.answer, q),
                 ans.answeredBy || "-",
                 ans.answeredOn ? format(new Date(ans.answeredOn), "PP") : "-"
             ]);
         }
      });

      if (answersToDisplay.length > 0) {
          if (currentY > doc.internal.pageSize.height - 40) { doc.addPage(); currentY = 20; }
          
          doc.setFontSize(14);
          doc.text("Audit Questionnaire Responses", 14, currentY);

          autoTable(doc, {
            startY: currentY + 5,
            head: [["Question", "Response", "Answered By", "Date"]],
            body: answersToDisplay,
            theme: "grid",
            headStyles: { fillColor: [67, 56, 202] },
            styles: { fontSize: 9 },
            columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 60 } }
          });
          currentY = (doc as any)["lastAutoTable"].finalY + 20;
      }

      // --- Sign-off Section ---
      if (currentY + 40 > doc.internal.pageSize.height) {
          doc.addPage();
          currentY = 20;
      }
      
      const auditorSignName = audName !== "N/A" ? audName : (report.auditor_name || "Unknown Auditor");
      const managerSignName = locManager !== "N/A" ? locManager : "________________________";

      doc.setFontSize(12);
      doc.text("Auditor Sign-off", 14, currentY);
      doc.setFontSize(10);
      doc.text(`Name: ${auditorSignName}`, 14, currentY + 10);
      doc.text("Signature: _____________________", 14, currentY + 20);
      doc.text(`Date: ${format(new Date(report.finalized_at), "PP")}`, 14, currentY + 30);

      doc.text("Store Manager Sign-off", 120, currentY);
      doc.text(`Name: ${managerSignName}`, 120, currentY + 10);
      doc.text("Signature: _____________________", 120, currentY + 20);
      doc.text(`Date: ${format(new Date(report.finalized_at), "PP")}`, 120, currentY + 30);
      
      doc.save(`Complete_Audit_Report_${report.locations?.name}.pdf`);
      toast.success("PDF generated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Audit History</h1>
          <p className="text-gray-500">View and download finalized audit reports.</p>
        </div>

        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <FileText className="h-5 w-5 text-indigo-600" />
              Finalized Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                No finalized reports found for this company.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Location</TableHead>
                    <TableHead>Finalized Date</TableHead>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="text-right">Downloads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium text-gray-900">{report.locations?.name}</TableCell>
                      <TableCell>{format(new Date(report.finalized_at), "MMM dd, yyyy HH:mm")}</TableCell>
                      <TableCell>{report.assignments?.scheduled_date ? format(new Date(report.assignments.scheduled_date), "MMM dd, yyyy") : "-"}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {report.report_data?.summary ? (
                          <div className="flex items-center gap-3">
                             <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">Items: {report.report_data.summary.totalItems}</span>
                             {report.report_data.summary.discrepancies > 0 ? (
                                <span className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-medium border border-red-100">Var: {report.report_data.summary.discrepancies}</span>
                             ) : (
                                <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium border border-green-100">Matched</span>
                             )}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Report Options</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem onClick={() => downloadPDF(report)}>
                              <FileType className="mr-2 h-4 w-4 text-violet-600" />
                              <span>Complete PDF</span>
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onClick={() => downloadExcel(report)}>
                              <TableIcon className="mr-2 h-4 w-4 text-green-600" />
                              <span>Combined Excel (XLSX)</span>
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onClick={() => downloadReconciliation(report)}>
                              <FileSpreadsheet className="mr-2 h-4 w-4 text-indigo-600" />
                              <span>Reconciliation (CSV)</span>
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onClick={() => downloadDiscrepancies(report)}>
                              <FileText className="mr-2 h-4 w-4 text-red-600" />
                              <span>Discrepancies Only (CSV)</span>
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onClick={() => downloadSummary(report)}>
                              <FileText className="mr-2 h-4 w-4 text-gray-600" />
                              <span>Summary Stats (CSV)</span>
                            </DropdownMenuItem>
                            
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default History;