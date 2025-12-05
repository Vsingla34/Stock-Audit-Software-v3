import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory, Question } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileType, FileSpreadsheet, Filter, Table as TableIcon, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { LocationFilterDropdown } from "@/components/LocationFilterDropdown";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const Reports = () => {
  const {
    auditedItems,
    itemMaster,
    getInventorySummary,
    getLocationSummary,
    questionnaireAnswers,
    getQuestionsForLocation,
  } = useInventory();

  const {
    selectedLocation,
    setSelectedLocation,
    availableLocations,
    shouldShowLocationFilter,
    isAdmin,
    getLocationName,
  } = useLocationFilter();

  const { selectedCompanyId } = useCompany();
  const [companyName, setCompanyName] = useState<string>("");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("default");

  const reportRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(100);

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!selectedCompanyId) return;
      try {
        const { data, error } = await supabase
          .from("companies")
          .select("name")
          .eq("id", selectedCompanyId)
          .single();
        
        if (data && !error) {
          setCompanyName(data.name);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCompanyName();
  }, [selectedCompanyId]);

  const { filteredAuditedItems, filteredItemMaster, summary } = useMemo(() => {
    const locationName = getLocationName(selectedLocation);

    if (locationName) {
      return {
        filteredAuditedItems: auditedItems.filter(
          (item) => item.location === locationName
        ),
        filteredItemMaster: itemMaster.filter(
          (item) => item.location === locationName
        ),
        summary: getLocationSummary(locationName),
      };
    }

    if (isAdmin) {
      return {
        filteredAuditedItems: auditedItems,
        filteredItemMaster: itemMaster,
        summary: getInventorySummary(),
      };
    }

    const accessibleNames = availableLocations.map(l => l.name);
    
    const clientAudited = auditedItems.filter(i => accessibleNames.includes(i.location));
    const clientMaster = itemMaster.filter(i => accessibleNames.includes(i.location));
    
    const clientSummary = availableLocations.reduce((acc, loc) => {
        const s = getLocationSummary(loc.name);
        acc.totalItems += s.totalItems;
        acc.auditedItems += s.auditedItems;
        acc.matched += s.matched;
        acc.discrepancies += s.discrepancies;
        acc.pendingItems += s.pendingItems;
        return acc;
    }, { totalItems: 0, auditedItems: 0, matched: 0, discrepancies: 0, pendingItems: 0 });

    return {
      filteredAuditedItems: clientAudited,
      filteredItemMaster: clientMaster,
      summary: clientSummary
    };

  }, [
    selectedLocation,
    auditedItems,
    itemMaster,
    isAdmin,
    getLocationName,
    getInventorySummary,
    getLocationSummary,
    availableLocations
  ]);

  const baseTableData = useMemo(() => {
    return filteredItemMaster.map((item) => {
      const auditedItem = filteredAuditedItems.find(
        (a) => a.id === item.id && a.location === item.location
      );
      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        location: item.location,
        systemQuantity: item.systemQuantity,
        physicalQuantity: auditedItem?.physicalQuantity || 0,
        variance: auditedItem
          ? auditedItem.physicalQuantity - item.systemQuantity
          : -item.systemQuantity,
        status: auditedItem?.status || "pending",
        lastAudited: auditedItem?.lastAudited || "",
        auditorEntries: auditedItem?.auditorEntries || [],
      };
    });
  }, [filteredItemMaster, filteredAuditedItems]);

  const filteredTableData = useMemo(() => {
    let data = baseTableData.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      return true;
    });

    if (sortOrder === "variance-asc") {
      data = [...data].sort((a, b) => a.variance - b.variance);
    } else if (sortOrder === "variance-desc") {
      data = [...data].sort((a, b) => b.variance - a.variance);
    }

    return data;
  }, [baseTableData, statusFilter, categoryFilter, sortOrder]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(baseTableData.map(i => i.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [baseTableData]);

  const visibleTableData = useMemo(
    () => filteredTableData.slice(0, visibleCount),
    [filteredTableData, visibleCount]
  );

  const generateCSV = useCallback((data: any[], filename: string) => {
    const headers = Array.from(new Set(data.flatMap((item) => Object.keys(item))));
    let csvContent = headers.join(",") + "\n";

    data.forEach((item) => {
      const row = headers
        .map((header) => {
          const value =
            item[header] !== undefined ? String(item[header]) : "";
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
  }, []);

  const downloadFilteredReport = useCallback(() => {
    if (filteredTableData.length === 0) {
      toast.error("No data to export with current filters");
      return;
    }

    const reportData = filteredTableData.map((item) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      location: item.location,
      systemQuantity: item.systemQuantity,
      physicalQuantity: item.physicalQuantity,
      variance: item.variance,
      status: item.status,
      lastAudited: item.lastAudited ? new Date(item.lastAudited).toLocaleString() : "-",
    }));

    const locationTag = selectedLocation ? `_${getLocationName(selectedLocation)}` : "";
    const statusTag = statusFilter !== 'all' ? `_${statusFilter}` : "";
    const categoryTag = categoryFilter !== 'all' ? `_${categoryFilter}` : "";
    const sortTag = sortOrder !== 'default' ? `_${sortOrder}` : "";

    generateCSV(
      reportData,
      `filtered_inventory_report${locationTag}${statusTag}${categoryTag}${sortTag}.csv`
    );
  }, [filteredTableData, selectedLocation, getLocationName, statusFilter, categoryFilter, sortOrder, generateCSV]);

  const downloadReconciliationReport = useCallback(() => {
    const allAuditors = new Set<string>();
    baseTableData.forEach((item) => {
      item.auditorEntries.forEach((entry: any) => {
        allAuditors.add(entry.auditorName);
      });
    });

    const reportData = baseTableData.map((item) => {
      const baseData: any = {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        location: item.location,
        systemQuantity: item.systemQuantity,
      };

      Array.from(allAuditors).forEach((auditorName) => {
        const auditorEntry = item.auditorEntries.find(
          (e: any) => e.auditorName === auditorName
        );
        baseData[auditorName] = auditorEntry ? auditorEntry.quantityFound : 0;
      });

      baseData.Total = item.physicalQuantity;
      baseData.variance = item.variance;
      baseData.status = item.status;
      baseData.lastAudited = item.lastAudited;

      return baseData;
    });

    const locationInfo = selectedLocation ? `_${getLocationName(selectedLocation)}` : "";
    generateCSV(reportData, `inventory_reconciliation_report${locationInfo}.csv`);
  }, [baseTableData, selectedLocation, getLocationName, generateCSV]);

  const downloadDiscrepancyReport = useCallback(() => {
    const discrepancies = baseTableData.filter((item) => item.variance !== 0);
    const reportData = discrepancies.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        location: item.location,
        systemQuantity: item.systemQuantity,
        physicalQuantity: item.physicalQuantity,
        variance: item.variance,
        lastAudited: item.lastAudited,
    }));
    const locationInfo = selectedLocation ? `_${getLocationName(selectedLocation)}` : "";
    generateCSV(reportData, `discrepancy_report${locationInfo}.csv`);
  }, [baseTableData, selectedLocation, getLocationName, generateCSV]);

  const downloadSummaryReport = useCallback(() => {
    const summaryData = [{
      totalItems: summary.totalItems,
      auditedItems: summary.auditedItems,
      pendingItems: summary.pendingItems,
      matchedItems: summary.matched,
      discrepancies: summary.discrepancies,
      auditCompletionPercentage: summary.totalItems > 0 ? Math.round((summary.auditedItems / summary.totalItems) * 100) : 0,
      generatedDate: new Date().toISOString(),
      location: selectedLocation ? getLocationName(selectedLocation) : "All Locations",
    }];
    const locationInfo = selectedLocation ? `_${getLocationName(selectedLocation)}` : "";
    generateCSV(summaryData, `audit_summary_report${locationInfo}.csv`);
  }, [summary, selectedLocation, getLocationName, generateCSV]);

  const downloadCombinedExcelReport = useCallback(() => {
    const allAuditors = new Set<string>();
    baseTableData.forEach((item) => {
      item.auditorEntries.forEach((entry: any) => {
        allAuditors.add(entry.auditorName);
      });
    });
    const auditorList = Array.from(allAuditors).sort();

    const reconciliationData = baseTableData.map((item) => {
      const row: any = {
        SKU: item.sku,
        Name: item.name,
        Category: item.category,
        Location: item.location,
        "System Qty": item.systemQuantity,
      };
      auditorList.forEach((auditorName) => {
        const entry = item.auditorEntries.find((e: any) => e.auditorName === auditorName);
        row[auditorName] = entry ? entry.quantityFound : 0;
      });
      row["Physical Qty"] = item.physicalQuantity;
      row.Variance = item.variance;
      row.Status = item.status;
      row["Last Audited"] = item.lastAudited ? new Date(item.lastAudited).toLocaleString() : "-";
      return row;
    });

    const discrepancyData = baseTableData
      .filter((item) => item.variance !== 0)
      .map((item) => ({
        SKU: item.sku,
        Name: item.name,
        Location: item.location,
        Category: item.category,
        "System Qty": item.systemQuantity,
        "Physical Qty": item.physicalQuantity,
        Variance: item.variance,
        "Last Audited": item.lastAudited ? new Date(item.lastAudited).toLocaleString() : "-",
      }));

    const summaryData = [{
      "Company": companyName,
      "Location": selectedLocation ? getLocationName(selectedLocation) : "All Locations",
      "Generated Date": new Date().toLocaleString(),
      "Total Items": summary.totalItems,
      "Audited Items": summary.auditedItems,
      "Matched Items": summary.matched,
      "Discrepancies": summary.discrepancies,
      "Pending Items": summary.pendingItems,
      "Completion Rate": summary.totalItems > 0 ? Math.round((summary.auditedItems / summary.totalItems) * 100) + "%" : "0%",
    }];

    const wb = XLSX.utils.book_new();

    const wsReconciliation = XLSX.utils.json_to_sheet(reconciliationData);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsDiscrepancy = XLSX.utils.json_to_sheet(discrepancyData);

    XLSX.utils.book_append_sheet(wb, wsReconciliation, "Reconciliation");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Audit Summary");
    XLSX.utils.book_append_sheet(wb, wsDiscrepancy, "Discrepancies");

    const locationInfo = selectedLocation ? `_${getLocationName(selectedLocation)}` : "";
    XLSX.writeFile(wb, `complete_audit_data${locationInfo}.xlsx`);
    toast.success("Combined Excel report downloaded");
  }, [baseTableData, summary, selectedLocation, getLocationName, companyName]);

  const formatQuestionnaireAnswer = useCallback((answer: string | string[], question: Question) => {
      let val: any = answer;
      if (typeof val === "string") { try { if (val.trim().startsWith("[") || val.trim().startsWith("{")) { val = JSON.parse(val); } } catch {} }
      if (question.type === "yes_no") { const v = Array.isArray(val) ? val[0] : val; const s = String(v ?? "").toLowerCase(); if (["yes", "true", "1"].includes(s)) return "Yes"; if (["no", "false", "0"].includes(s)) return "No"; return String(v ?? ""); }
      if ((question.type === "single_select" || question.type === "multi_select") && question.options) { const ids = Array.isArray(val) ? val : [val]; const labels = ids.map((id: string) => { const opt = question.options?.find((o) => o.id === id); return opt ? opt.text : id; }); return labels.join(", "); }
      if (Array.isArray(val)) { return val.join(", "); }
      return String(val);
  }, []);

  const generatePDFReport = useCallback(() => {
    const doc = new jsPDF();
    
    let currentY = 20;
    doc.setFontSize(20); 
    doc.setTextColor(40); 
    doc.text("Inventory Audit Report", 14, currentY);
    
    currentY += 10;
    doc.setFontSize(11); 
    doc.setTextColor(100);
    doc.text(`Company: ${companyName || "N/A"}`, 14, currentY);
    
    currentY += 7;
    const locationName = getLocationName(selectedLocation);
    const locationText = locationName ? `Location: ${locationName}` : "Location: All Locations";
    doc.text(locationText, 14, currentY);
    
    currentY += 7;
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, currentY);

    if (selectedLocation && selectedLocation !== "all") {
        const questionsForLoc = getQuestionsForLocation(selectedLocation);
        
        const getAnswerText = (questionText: string) => {
            const q = questionsForLoc.find(xq => xq.text.trim().toLowerCase() === questionText.toLowerCase());
            if (!q) return "N/A";
            const ans = questionnaireAnswers.find(a => a.questionId === q.id && a.locationId === selectedLocation);
            return ans ? formatQuestionnaireAnswer(ans.answer, q) : "N/A";
        };

        const locManager = getAnswerText("Location Manager");
        const audName = getAnswerText("Auditor Name");
        const phone = getAnswerText("Phone No.");

        currentY += 7;
        doc.text(`Location Manager: ${locManager}`, 14, currentY);
        currentY += 7;
        doc.text(`Auditor: ${audName}`, 14, currentY);
        currentY += 7;
        doc.text(`Phone: ${phone}`, 14, currentY);
    }

    currentY += 14;
    doc.setFontSize(14); 
    doc.setTextColor(0); 
    doc.text("Audit Summary", 14, currentY);
    
    const summaryTableBody = [
      ["Total Items", summary.totalItems.toString()],
      ["Audited Items", summary.auditedItems.toString()],
      ["Matched Items", summary.matched.toString()],
      ["Discrepancies", summary.discrepancies.toString()],
      ["Completion Rate", `${summary.totalItems > 0 ? Math.round((summary.auditedItems / summary.totalItems) * 100) : 0}%`],
    ];
    
    autoTable(doc, { 
        startY: currentY + 4, 
        head: [["Metric", "Value"]], 
        body: summaryTableBody, 
        theme: "grid", 
        headStyles: { fillColor: [79, 70, 229] } 
    });

    currentY = (doc as any)["lastAutoTable"] ? (doc as any)["lastAutoTable"].finalY + 10 : currentY + 60;

    doc.setFontSize(14); 
    doc.text("Observations", 14, currentY);
    
    const observations: string[] = [];
    if (summary.discrepancies > 0) { observations.push(`There are ${summary.discrepancies} items with quantity discrepancies.`); } else { observations.push("All audited items match their expected quantities."); }
    if (summary.pendingItems > 0) { observations.push(`${summary.pendingItems} items (${Math.round((summary.pendingItems / summary.totalItems) * 100)}%) are still pending audit.`); } else { observations.push("All items have been audited."); }
    
    let observationY = currentY + 10;
    observations.forEach((obs) => { doc.setFontSize(11); doc.text(`• ${obs}`, 16, observationY); observationY += 7; });

    const discrepancies = baseTableData.filter((item) => item.status === "discrepancy").map((item) => {
        return [item.sku, item.name, item.location, item.systemQuantity.toString(), item.physicalQuantity.toString(), item.variance.toString()];
    });

    if (discrepancies.length > 0) {
      const discrepancyY = observationY + 10;
      doc.setFontSize(14); doc.text("Discrepancy Details", 14, discrepancyY);
      autoTable(doc, { startY: discrepancyY + 5, head: [["SKU", "Name", "Location", "System", "Physical", "Variance"]], body: discrepancies, theme: "grid", headStyles: { fillColor: [249, 115, 22] }, styles: { fontSize: 8 }, columnStyles: { 6: { cellWidth: 40 } } });
    }

    if (selectedLocation && selectedLocation !== "all") {
        const validQuestions = getQuestionsForLocation(selectedLocation);
        
        const hiddenQuestions = ["company", "location", "location manager", "auditor name", "phone no."];
        const displayQuestions = validQuestions.filter(q => !hiddenQuestions.includes(q.text.trim().toLowerCase()));

        if (displayQuestions.length > 0) {
            let questionnaireY = (doc as any)["lastAutoTable"] ? (doc as any)["lastAutoTable"].finalY + 15 : observationY + 15;
            if (questionnaireY > doc.internal.pageSize.height - 40) { doc.addPage(); questionnaireY = 20; }
            
            doc.setFontSize(14); doc.text("Audit Questionnaire Responses", 14, questionnaireY);
            
            const answerData = displayQuestions.map((question) => {
                const answer = questionnaireAnswers.find((a) => a.questionId === question.id && a.locationId === selectedLocation);
                return [question.text, answer ? formatQuestionnaireAnswer(answer.answer, question) : "-", answer?.answeredBy || "-", answer ? new Date(answer.answeredOn).toLocaleDateString() : "-"];
            });
            
            autoTable(doc, { startY: questionnaireY + 5, head: [["Question", "Response", "Answered By", "Date"]], body: answerData, theme: "grid", headStyles: { fillColor: [67, 56, 202] }, styles: { fontSize: 9 }, columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 60 } } });
        }

        const lastPos = (doc as any)["lastAutoTable"] ? (doc as any)["lastAutoTable"].finalY + 20 : doc.internal.pageSize.height - 60;
        const pageHeight = doc.internal.pageSize.height;
        let signOffY = lastPos;
        if (signOffY + 60 > pageHeight) { doc.addPage(); signOffY = 20; }

        const auditorName = questionnaireAnswers.find(a => a.locationId === selectedLocation)?.answeredBy || "N/A";
        let storeManagerName = "N/A";
        const questionsForSignOff = getQuestionsForLocation(selectedLocation);
        const managerQuestion = questionsForSignOff.find(q => q.text.trim().toLowerCase() === 'location manager');
        if (managerQuestion) { const managerAnswer = questionnaireAnswers.find((a) => a.questionId === managerQuestion.id && a.locationId === selectedLocation); if (managerAnswer) { storeManagerName = formatQuestionnaireAnswer(managerAnswer.answer, managerQuestion); } }
        const currentDate = new Date().toLocaleDateString();

        doc.setFontSize(12);
        doc.text("Auditor Sign-off", 14, signOffY);
        doc.setFontSize(10);
        doc.text(`Name: ${auditorName}`, 14, signOffY + 10);
        doc.text("Signature: _____________________", 14, signOffY + 20);
        doc.text(`Date: ${currentDate}`, 14, signOffY + 30);

        doc.text("Store Manager Sign-off", 120, signOffY);
        doc.text(`Name: ${storeManagerName}`, 120, signOffY + 10);
        doc.text("Signature: _____________________", 120, signOffY + 20);
        doc.text(`Date: ${currentDate}`, 120, signOffY + 30);
    }

    const locationInfo = selectedLocation ? `_${getLocationName(selectedLocation)}` : "";
    doc.save(`inventory_audit_report${locationInfo}.pdf`);
    toast.success("PDF Report downloaded");
  }, [selectedLocation, summary, baseTableData, getLocationName, questionnaireAnswers, getQuestionsForLocation, formatQuestionnaireAnswer, companyName]);

  const handleShowMore = () => { setVisibleCount((prev) => prev + 100); };
  const handleShowAll = () => { setVisibleCount(filteredTableData.length); };
  const showingAll = visibleCount >= filteredTableData.length && filteredTableData.length > 0;

  return (
    <AppLayout>
      <div>
        {isAdmin || availableLocations.length > 0 ? (
          <div className="space-y-6" ref={reportRef}>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reports</h1>
                <p className="text-muted-foreground">Generate and download inventory audit reports with auditor tracking</p>
              </div>
              {shouldShowLocationFilter && (
                <LocationFilterDropdown
                  selectedLocation={selectedLocation}
                  onLocationChange={(value) => { setSelectedLocation(value); setVisibleCount(100); }}
                  availableLocations={availableLocations}
                  showAllOption={isAdmin || availableLocations.length > 1}
                />
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Card className="bg-gradient-to-br from-indigo-50 to-white shadow-sm border-indigo-100">
                <CardHeader><CardTitle className="flex items-center gap-2 text-gray-900"><FileSpreadsheet className="h-5 w-5 text-indigo-600" />Reconciliation</CardTitle></CardHeader>
                <CardContent className="space-y-2"><p className="text-sm text-gray-500">Complete report with auditor breakdown.</p><Button variant="outline" className="w-full bg-white hover:bg-indigo-50 border-indigo-200 text-indigo-700 hover:text-indigo-800" onClick={downloadReconciliationReport}><Download className="mr-2 h-4 w-4" />Download CSV</Button></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-50 to-white shadow-sm border-red-100">
                <CardHeader><CardTitle className="flex items-center gap-2 text-gray-900"><FileText className="h-5 w-5 text-red-600" />Discrepancies</CardTitle></CardHeader>
                <CardContent className="space-y-2"><p className="text-sm text-gray-500">Filtered report showing only variances.</p><Button variant="outline" className="w-full bg-white hover:bg-red-50 border-red-200 text-red-700 hover:text-red-800" onClick={downloadDiscrepancyReport}><Download className="mr-2 h-4 w-4" />Download CSV</Button></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-white shadow-sm border-green-100">
                <CardHeader><CardTitle className="flex items-center gap-2 text-gray-900"><FileText className="h-5 w-5 text-green-600" />Audit Summary</CardTitle></CardHeader>
                <CardContent className="space-y-2"><p className="text-sm text-gray-500">High-level summary of the audit metrics.</p><Button variant="outline" className="w-full bg-white hover:bg-green-50 border-green-200 text-green-700 hover:text-green-800" onClick={downloadSummaryReport}><Download className="mr-2 h-4 w-4" />Download CSV</Button></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-slate-50 to-white shadow-sm border-slate-100">
                <CardHeader><CardTitle className="flex items-center gap-2 text-gray-900"><TableIcon className="h-5 w-5 text-slate-600" />Combined Excel</CardTitle></CardHeader>
                <CardContent className="space-y-2"><p className="text-sm text-gray-500">All reports combined in one Excel file.</p><Button variant="outline" className="w-full bg-white hover:bg-indigo-50 border-slate-200 text-slate-700 hover:text-indigo-700" onClick={downloadCombinedExcelReport}><Download className="mr-2 h-4 w-4" />Download XLSX</Button></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-violet-50 to-white shadow-sm border-violet-100">
                <CardHeader><CardTitle className="flex items-center gap-2 text-gray-900"><FileType className="h-5 w-5 text-violet-600" />Complete PDF</CardTitle></CardHeader>
                <CardContent className="space-y-2"><p className="text-sm text-gray-500">Formal printable audit report.</p><Button variant="outline" className="w-full bg-white hover:bg-violet-50 border-violet-200 text-violet-700 hover:text-violet-800" onClick={generatePDFReport}><Download className="mr-2 h-4 w-4" />Download PDF</Button></CardContent>
              </Card>
            </div>

            <Card className="bg-white shadow-sm border-gray-200">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className="text-gray-900">Detailed Report with Filters</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    
                    <div className="w-[150px]">
                      <Select value={statusFilter} onValueChange={(val) => {
                        setStatusFilter(val);
                        if (val !== "discrepancy") setSortOrder("default");
                      }}>
                        <SelectTrigger className="focus:ring-indigo-600 border-gray-200"><div className="flex items-center gap-2"><Filter className="h-4 w-4" /><SelectValue placeholder="Status" /></div></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="matched">Matched</SelectItem>
                          <SelectItem value="discrepancy">Discrepancy</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-[180px]">
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="focus:ring-indigo-600 border-gray-200"><div className="flex items-center gap-2"><Filter className="h-4 w-4" /><SelectValue placeholder="Category" /></div></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {uniqueCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {statusFilter === "discrepancy" && (
                      <div className="w-[180px]">
                        <Select value={sortOrder} onValueChange={setSortOrder}>
                          <SelectTrigger className="focus:ring-indigo-600 border-gray-200">
                            <div className="flex items-center gap-2">
                              <ArrowUpDown className="h-4 w-4" />
                              <SelectValue placeholder="Sort Variance" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default Sort</SelectItem>
                            <SelectItem value="variance-asc">Variance (Low ↑)</SelectItem>
                            <SelectItem value="variance-desc">Variance (High ↓)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={downloadFilteredReport}>
                      <Download className="mr-2 h-4 w-4" />
                      Export Filtered
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2 text-sm text-gray-500">
                  <span>Showing <span className="font-medium text-gray-900">{visibleTableData.length}</span> of <span className="font-medium text-gray-900">{filteredTableData.length}</span> items</span>
                  {filteredTableData.length > 0 && !showingAll && (<div className="flex gap-2"><Button size="sm" variant="outline" className="hover:text-indigo-600" onClick={handleShowMore}>Show next 100</Button><Button size="sm" variant="ghost" className="hover:text-indigo-600" onClick={handleShowAll}>Show all</Button></div>)}
                </div>

                <div className="rounded-md border border-gray-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>SKU</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>System Qty</TableHead>
                        <TableHead>Physical Qty</TableHead>
                        <TableHead>Variance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleTableData.length > 0 ? (
                        visibleTableData.map((item) => (
                          <TableRow key={`${item.id}-${item.location}`}>
                            <TableCell className="font-medium text-gray-900">{item.sku}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.location}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.systemQuantity}</TableCell>
                            <TableCell>{item.physicalQuantity}</TableCell>
                            <TableCell className={item.variance !== 0 ? "text-red-600 font-bold" : ""}>{item.variance}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === "matched" ? "bg-green-100 text-green-800" : item.status === "discrepancy" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                                {item.status === "matched" ? "Matched" : item.status === "discrepancy" ? "Discrepancy" : "Pending"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow><TableCell colSpan={8} className="text-center py-4 text-gray-500">No data available matching filters</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[50vh]"><h1 className="text-gray-400 font-semibold text-xl">Currently You Don't have access</h1></div>
        )}
      </div>
    </AppLayout>
  );
};

export default Reports;