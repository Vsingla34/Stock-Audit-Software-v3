import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory, Question } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileType, FileSpreadsheet, Filter, Table as TableIcon, ArrowUpDown, MessageSquare, CheckCheck, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const Reports = () => {
  const navigate = useNavigate();
  const {
    auditedItems,
    itemMaster,
    questionnaireAnswers,
    questions,
    getQuestionsForLocation,
    locations,
    updateItemRemark,
    assignments,
    finalizeAudit,
    sendFinalizationOtp,
    submitAudit 
  } = useInventory();

  const { currentUser } = useUser();
  const { selectedCompanyId, selectedAssignmentId } = useCompany();
  const [companyName, setCompanyName] = useState<string>("");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("default");

  const [editingRemark, setEditingRemark] = useState<string | null>(null);
  const [tempRemark, setTempRemark] = useState("");

  const reportRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(100);
  
  // OTP States
  const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AUTO-DETECT LOCATION FROM ASSIGNMENT
  const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
  const selectedLocation = currentAssignment?.locationId || "";
  const locationName = locations.find(l => l.id === selectedLocation)?.name || "";

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

  // --- PERMISSION LOGIC ---
  const isAuditor = currentUser?.role === 'auditor';
  const isClient = currentUser?.role === 'client';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const canSubmit = currentAssignment?.status === 'active' && (isAuditor || isAdmin);
  const canFinalize = currentAssignment?.status === 'submitted' && (isClient || isAdmin);

  const handleSubmitClick = async () => {
    if (!selectedAssignmentId) return;
    if (confirm("Are you sure you want to submit this audit report? You will not be able to edit scans after submission.")) {
       setIsSubmitting(true);
       try {
         await submitAudit(selectedAssignmentId);
         toast.success("Audit submitted to client for review.");
       } catch (e: any) {
         toast.error(e.message || "Failed to submit audit.");
       } finally {
         setIsSubmitting(false);
       }
    }
  };

  const handleFinalizeClick = () => {
    setIsOtpDialogOpen(true);
  };
  
  const handleSendOtp = async () => {
    if (!selectedAssignmentId) return;
    setIsSendingOtp(true);
    try {
      const message = await sendFinalizationOtp(selectedAssignmentId);
      toast.success(message);
    } catch (e) {
      toast.error("Failed to send OTP");
    } finally {
      setIsSendingOtp(false);
    }
  };
  
  const handleVerifyAndFinalize = async () => {
    if (!selectedAssignmentId) return;
    if (!otpCode) {
      toast.error("Please enter the verification code");
      return;
    }
    
    setIsVerifyingOtp(true);
    try {
      await finalizeAudit(selectedAssignmentId, otpCode);
      toast.success("Audit Finalized Successfully");
      setIsOtpDialogOpen(false);
      navigate("/history");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Invalid OTP or Failed to finalize");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const isItemActive = (systemQty: number, physicalQty: number) => {
    return systemQty > 0 || physicalQty > 0;
  };

  const { filteredAuditedItems, filteredItemMaster, summary } = useMemo(() => {
    let relevantAuditedItems = auditedItems.filter(item => item.location === locationName);
    let relevantItemMaster = itemMaster.filter(item => item.location === locationName);

    const activeItemMaster = relevantItemMaster.filter(masterItem => {
        const auditedItem = relevantAuditedItems.find(
            a => a.id === masterItem.id && a.location === masterItem.location
        );
        const physicalQty = auditedItem?.physicalQuantity || 0;
        return isItemActive(masterItem.systemQuantity, physicalQty);
    });

    const totalItems = activeItemMaster.length;
    
    const auditedCount = activeItemMaster.filter(masterItem => {
        const auditedItem = relevantAuditedItems.find(
            a => a.id === masterItem.id && a.location === masterItem.location
        );
        return auditedItem && auditedItem.status !== 'pending';
    }).length;

    let matched = 0;
    let discrepancies = 0;

    activeItemMaster.forEach(masterItem => {
        const audited = relevantAuditedItems.find(
            a => a.id === masterItem.id && a.location === masterItem.location
        );
        
        if (audited && audited.status !== 'pending') {
            if (audited.status === 'matched') matched++;
            else if (audited.status === 'discrepancy') discrepancies++;
        }
    });

    const calculatedSummary = {
        totalItems,
        auditedItems: auditedCount,
        matched,
        discrepancies,
        pendingItems: Math.max(0, totalItems - auditedCount)
    };

    return {
      filteredAuditedItems: relevantAuditedItems,
      filteredItemMaster: activeItemMaster,
      summary: calculatedSummary
    };

  }, [selectedLocation, locationName, auditedItems, itemMaster]);

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
        clientRemarks: item.clientRemarks,
        customAttributes: item.customAttributes || {}
      };
    });
  }, [filteredItemMaster, filteredAuditedItems]);

  const parsePrice = useCallback((val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const cleanStr = String(val).replace(/[^0-9.-]+/g, "");
    return parseFloat(cleanStr) || 0;
  }, []);

  const priceKey = useMemo(() => {
     for (const item of baseTableData) {
        if (!item.customAttributes) continue;
        if (item.customAttributes['unit_price'] !== undefined) return 'unit_price';
        const keys = Object.keys(item.customAttributes);
        const found = keys.find(k => ['unit price', 'price', 'rate', 'cost', 'mrp', 'unit cost'].includes(k.toLowerCase()));
        if (found) return found;
     }
     return null;
  }, [baseTableData]);

  const getItemValues = useCallback((item: typeof baseTableData[0]) => {
     if (!priceKey) return { unitPrice: 0, sysValue: 0, phyValue: 0, valueVariance: 0 };

     const attrs = item.customAttributes || {};
     let unitPrice = parsePrice(attrs['unit_price']);
     let sysValue = parsePrice(attrs['system_value']);
     let phyValue = parsePrice(attrs['physical_value']);

     if (unitPrice === 0 && priceKey !== 'unit_price') {
         unitPrice = parsePrice(attrs[priceKey]);
     }
     if (sysValue === 0 && unitPrice > 0) {
         sysValue = unitPrice * item.systemQuantity;
     }
     if (phyValue === 0 && unitPrice > 0) {
         phyValue = unitPrice * (item.physicalQuantity || 0);
     }

     const valueVariance = phyValue - sysValue;

     return { unitPrice, sysValue, phyValue, valueVariance };
  }, [priceKey, parsePrice]);

  const hasPricing = !!priceKey;

  const formatCurrency = (val: any) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "-";
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

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
    // --- NEW: Value Variance Filters ---
    else if (sortOrder === "val-variance-asc") {
      data = [...data].sort((a, b) => getItemValues(a).valueVariance - getItemValues(b).valueVariance);
    } else if (sortOrder === "val-variance-desc") {
      data = [...data].sort((a, b) => getItemValues(b).valueVariance - getItemValues(a).valueVariance);
    }

    return data;
  }, [baseTableData, statusFilter, categoryFilter, sortOrder, getItemValues]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(baseTableData.map(i => i.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [baseTableData]);

  const visibleTableData = useMemo(
    () => filteredTableData.slice(0, visibleCount),
    [filteredTableData, visibleCount]
  );

  const canEditRemarkForItem = (itemLocationName: string) => {
    if (isAdmin) return true;
    if (isClient && currentAssignment?.status === 'submitted') return true;
    return false;
  };

  const handleRemarkStart = (id: string, currentVal: string) => {
    setEditingRemark(id);
    setTempRemark(currentVal || "");
  };

  const handleRemarkSave = async (id: string) => {
    if (tempRemark.trim()) {
      await updateItemRemark(id, tempRemark);
    }
    setEditingRemark(null);
  };

  const formatQuestionnaireAnswer = useCallback((answer: string | string[], question: Question) => {
      let val: any = answer;
      if (typeof val === "string") { try { if (val.trim().startsWith("[") || val.trim().startsWith("{")) { val = JSON.parse(val); } } catch {} }
      if (question.type === 'file') {
         return val ? String(val) : "No File";
      }
      if (question.type === "yes_no") { const v = Array.isArray(val) ? val[0] : val; const s = String(v ?? "").toLowerCase(); if (["yes", "true", "1"].includes(s)) return "Yes"; if (["no", "false", "0"].includes(s)) return "No"; return String(v ?? ""); }
      if ((question.type === "single_select" || question.type === "multi_select") && question.options) { const ids = Array.isArray(val) ? val : [val]; const labels = ids.map((id: string) => { const opt = question.options?.find((o) => o.id === id); return opt ? opt.text : id; }); return labels.join(", "); }
      if (Array.isArray(val)) { return val.join(", "); }
      return String(val);
  }, []);

  const generateCSV = useCallback((data: any[], filename: string) => {
    const headers = Array.from(new Set(data.flatMap((item) => Object.keys(item))));
    let csvContent = headers.join(",") + "\n";
    data.forEach((item) => {
      const row = headers.map((header) => {
          const value = item[header] !== undefined ? String(item[header]) : "";
          return value.includes(",") ? `"${value}"` : value;
        }).join(",");
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
    const reportData = filteredTableData.map((item) => {
      const { unitPrice, sysValue, phyValue, valueVariance } = getItemValues(item);
      const baseObj: any = {
        sku: item.sku,
        name: item.name,
        category: item.category,
        location: item.location,
        systemQuantity: item.systemQuantity,
        physicalQuantity: item.physicalQuantity,
        variance: item.variance,
        status: item.status,
      };
      if (hasPricing) {
         baseObj["Unit Price"] = unitPrice;
         baseObj["System Value"] = sysValue;
         baseObj["Physical Value"] = phyValue;
         baseObj["Value Variance"] = valueVariance;
      }
      baseObj.remarks = item.clientRemarks || "-";
      baseObj.lastAudited = item.lastAudited ? new Date(item.lastAudited).toLocaleString() : "-";
      return baseObj;
    });
    const locationTag = locationName ? `_${locationName}` : "";
    const statusTag = statusFilter !== 'all' ? `_${statusFilter}` : "";
    const categoryTag = categoryFilter !== 'all' ? `_${categoryFilter}` : "";
    const sortTag = sortOrder !== 'default' ? `_${sortOrder}` : "";
    generateCSV(reportData, `filtered_inventory_report${locationTag}${statusTag}${categoryTag}${sortTag}.csv`);
  }, [filteredTableData, locationName, statusFilter, categoryFilter, sortOrder, generateCSV, hasPricing, getItemValues]);

  const downloadReconciliationReport = useCallback(() => {
    const allAuditors = new Set<string>();
    baseTableData.forEach((item) => {
      item.auditorEntries.forEach((entry: any) => { allAuditors.add(entry.auditorName); });
    });
    const reportData = baseTableData.map((item) => {
      const { unitPrice, sysValue, phyValue, valueVariance } = getItemValues(item);
      const baseData: any = {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        location: item.location,
        systemQuantity: item.systemQuantity,
      };
      if (hasPricing) {
         baseData["Unit Price"] = unitPrice;
         baseData["System Value"] = sysValue;
      }
      Array.from(allAuditors).forEach((auditorName) => {
        const auditorEntry = item.auditorEntries.find((e: any) => e.auditorName === auditorName);
        baseData[auditorName] = auditorEntry ? auditorEntry.quantityFound : 0;
      });
      baseData.Total = item.physicalQuantity;
      if (hasPricing) {
          baseData["Physical Value"] = phyValue;
          baseData["Value Variance"] = valueVariance;
      }
      baseData.variance = item.variance;
      baseData.status = item.status;
      baseData.remarks = item.clientRemarks || "-";
      baseData.lastAudited = item.lastAudited;
      return baseData;
    });
    const locationInfo = locationName ? `_${locationName}` : "";
    generateCSV(reportData, `inventory_reconciliation_report${locationInfo}.csv`);
  }, [baseTableData, locationName, generateCSV, hasPricing, getItemValues]);

  const downloadDiscrepancyReport = useCallback(() => {
    const discrepancies = baseTableData.filter((item) => item.variance !== 0);
    const reportData = discrepancies.map((item) => {
        const { unitPrice, sysValue, phyValue, valueVariance } = getItemValues(item);
        const baseObj: any = {
            id: item.id,
            sku: item.sku,
            name: item.name,
            location: item.location,
            systemQuantity: item.systemQuantity,
            physicalQuantity: item.physicalQuantity,
            variance: item.variance,
        };
        if (hasPricing) {
            baseObj["Unit Price"] = unitPrice;
            baseObj["System Value"] = sysValue;
            baseObj["Physical Value"] = phyValue;
            baseObj["Value Variance"] = valueVariance;
        }
        baseObj.remarks = item.clientRemarks || "-";
        baseObj.lastAudited = item.lastAudited;
        return baseObj;
    });
    const locationInfo = locationName ? `_${locationName}` : "";
    generateCSV(reportData, `discrepancy_report${locationInfo}.csv`);
  }, [baseTableData, locationName, generateCSV, hasPricing, getItemValues]);

  const downloadSummaryReport = useCallback(() => {
    const summaryData = [{
      totalItems: summary.totalItems,
      auditedItems: summary.auditedItems,
      pendingItems: summary.pendingItems,
      matchedItems: summary.matched,
      discrepancies: summary.discrepancies,
      auditCompletionPercentage: summary.totalItems > 0 ? Math.round((summary.auditedItems / summary.totalItems) * 100) : 0,
      generatedDate: new Date().toISOString(),
      location: locationName || "All Locations",
    }];
    const locationInfo = locationName ? `_${locationName}` : "";
    generateCSV(summaryData, `audit_summary_report${locationInfo}.csv`);
  }, [summary, locationName, generateCSV]);

  const downloadCombinedExcelReport = useCallback(() => {
    const allAuditors = new Set<string>();
    baseTableData.forEach((item) => { item.auditorEntries.forEach((entry: any) => { allAuditors.add(entry.auditorName); }); });
    const auditorList = Array.from(allAuditors).sort();

    const reconciliationData = baseTableData.map((item) => {
      const { unitPrice, sysValue, phyValue, valueVariance } = getItemValues(item);
      const row: any = {
        SKU: item.sku,
        Name: item.name,
        Category: item.category,
        Location: item.location,
        "System Qty": item.systemQuantity,
      };
      if (hasPricing) {
        row["Unit Price"] = unitPrice;
        row["System Value"] = sysValue;
      }
      auditorList.forEach((auditorName) => {
        const entry = item.auditorEntries.find((e: any) => e.auditorName === auditorName);
        row[auditorName] = entry ? entry.quantityFound : 0;
      });
      row["Physical Qty"] = item.physicalQuantity;
      if (hasPricing) {
        row["Physical Value"] = phyValue;
        row["Value Variance"] = valueVariance;
      }
      row.Variance = item.variance;
      row.Status = item.status;
      row.Remarks = item.clientRemarks || "-";
      row["Last Audited"] = item.lastAudited ? new Date(item.lastAudited).toLocaleString() : "-";
      return row;
    });

    const discrepancyData = baseTableData
      .filter((item) => item.variance !== 0)
      .map((item) => {
        const { unitPrice, sysValue, phyValue, valueVariance } = getItemValues(item);
        const row: any = {
            SKU: item.sku,
            Name: item.name,
            Location: item.location,
            Category: item.category,
            "System Qty": item.systemQuantity,
            "Physical Qty": item.physicalQuantity,
            Variance: item.variance,
        };
        if (hasPricing) {
            row["Unit Price"] = unitPrice;
            row["System Value"] = sysValue;
            row["Physical Value"] = phyValue;
            row["Value Variance"] = valueVariance;
        }
        row.Remarks = item.clientRemarks || "-";
        row["Last Audited"] = item.lastAudited ? new Date(item.lastAudited).toLocaleString() : "-";
        return row;
      });

    const summaryData = [{
      "Company": companyName,
      "Location": locationName || "All Locations",
      "Generated Date": new Date().toLocaleString(),
      "Total Items": summary.totalItems,
      "Audited Items": summary.auditedItems,
      "Matched Items": summary.matched,
      "Discrepancies": summary.discrepancies,
      "Pending Items": summary.pendingItems,
      "Completion Rate": summary.totalItems > 0 ? Math.round((summary.auditedItems / summary.totalItems) * 100) + "%" : "0%",
    }];

    const questionnaireData = questionnaireAnswers.map(ans => {
        const q = questions.find(q => q.id === ans.questionId);
        const loc = locations.find(l => l.id === ans.locationId);
        if (locationName && loc?.name !== locationName) return null;
        return {
            "Location": loc?.name || "Unknown",
            "Question": q?.text || "Unknown Question",
            "Response": formatQuestionnaireAnswer(ans.answer, q!), 
            "Answered By": ans.answeredBy,
            "Date": new Date(ans.answeredOn).toLocaleDateString()
        };
    }).filter(Boolean);

    const wb = XLSX.utils.book_new();
    const wsReconciliation = XLSX.utils.json_to_sheet(reconciliationData);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsDiscrepancy = XLSX.utils.json_to_sheet(discrepancyData);
    const wsQuestionnaire = XLSX.utils.json_to_sheet(questionnaireData);

    XLSX.utils.book_append_sheet(wb, wsReconciliation, "Reconciliation");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Audit Summary");
    XLSX.utils.book_append_sheet(wb, wsDiscrepancy, "Discrepancies");
    XLSX.utils.book_append_sheet(wb, wsQuestionnaire, "Questionnaire");

    const locationInfo = locationName ? `_${locationName}` : "";
    XLSX.writeFile(wb, `complete_audit_data${locationInfo}.xlsx`);
    toast.success("Combined Excel report downloaded");
  }, [baseTableData, summary, locationName, companyName, questionnaireAnswers, questions, locations, formatQuestionnaireAnswer, hasPricing, getItemValues]);

  const generatePDFReport = useCallback(() => {
    const doc = new jsPDF();
    let currentY = 20;

    doc.setFontSize(20); doc.setTextColor(40); doc.text("Inventory Audit Report", 14, currentY);
    currentY += 10;
    doc.setFontSize(11); doc.setTextColor(100); doc.text(`Company: ${companyName || "N/A"}`, 14, currentY);
    currentY += 7;
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
    doc.setFontSize(14); doc.setTextColor(0); doc.text("Audit Summary", 14, currentY);
    const summaryTableBody = [
      ["Total Items", summary.totalItems.toString()],
      ["Audited Items", summary.auditedItems.toString()],
      ["Matched Items", summary.matched.toString()],
      ["Discrepancies", summary.discrepancies.toString()],
      ["Completion Rate", `${summary.totalItems > 0 ? Math.round((summary.auditedItems / summary.totalItems) * 100) : 0}%`],
    ];
    autoTable(doc, { startY: currentY + 4, head: [["Metric", "Value"]], body: summaryTableBody, theme: "grid", headStyles: { fillColor: [79, 70, 229] } });
    currentY = (doc as any)["lastAutoTable"] ? (doc as any)["lastAutoTable"].finalY + 10 : currentY + 60;

    doc.setFontSize(14); doc.text("Observations", 14, currentY);
    const observations: string[] = [];
    if (summary.discrepancies > 0) { observations.push(`There are ${summary.discrepancies} items with quantity discrepancies.`); } else { observations.push("All audited items match their expected quantities."); }
    if (summary.pendingItems > 0) { observations.push(`${summary.pendingItems} items (${Math.round((summary.pendingItems / summary.totalItems) * 100)}%) are still pending audit.`); } else { observations.push("All items have been audited."); }
    currentY += 10;
    observations.forEach((obs) => { doc.setFontSize(11); doc.text(`• ${obs}`, 16, currentY); currentY += 7; });

    const discrepancies = baseTableData.filter((item) => item.status === "discrepancy").map((item) => {
        const { unitPrice, sysValue, phyValue, valueVariance } = getItemValues(item);
        const row = [item.sku, item.name, item.location, item.systemQuantity.toString(), item.physicalQuantity.toString(), item.variance.toString()];
        if (hasPricing) {
            row.push(formatCurrency(valueVariance));
        }
        row.push(item.clientRemarks || "-");
        return row;
    });

    if (discrepancies.length > 0) {
      currentY += 5; 
      doc.setFontSize(14); doc.text("Discrepancy Details", 14, currentY);
      const headRow = ["SKU", "Name", "Location", "Sys", "Phy", "Var"];
      if (hasPricing) headRow.push("Val Var");
      headRow.push("Remarks");
      autoTable(doc, { startY: currentY + 5, head: [headRow], body: discrepancies, theme: "grid", headStyles: { fillColor: [249, 115, 22] }, styles: { fontSize: 8 }, columnStyles: { [headRow.length - 1]: { cellWidth: 30 } } });
      currentY = (doc as any)["lastAutoTable"].finalY + 10;
    } else { currentY += 10; }

    if (selectedLocation && selectedLocation !== "all") {
        const validQuestions = getQuestionsForLocation(selectedLocation);
        const hiddenQuestions = ["company", "location", "location manager", "auditor name", "phone no."];
        const displayQuestions = validQuestions.filter(q => !hiddenQuestions.includes(q.text.trim().toLowerCase()));
        if (displayQuestions.length > 0) {
            if (currentY > doc.internal.pageSize.height - 40) { doc.addPage(); currentY = 20; }
            doc.setFontSize(14); doc.text("Audit Questionnaire Responses", 14, currentY);
            const answerData = displayQuestions.map((question) => {
                const answer = questionnaireAnswers.find((a) => a.questionId === question.id && a.locationId === selectedLocation);
                return [question.text, answer ? formatQuestionnaireAnswer(answer.answer, question) : "-", answer?.answeredBy || "-", answer ? new Date(answer.answeredOn).toLocaleDateString() : "-"];
            });
            autoTable(doc, { startY: currentY + 5, head: [["Question", "Response", "Answered By", "Date"]], body: answerData, theme: "grid", headStyles: { fillColor: [67, 56, 202] }, styles: { fontSize: 9 }, columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 60, overflow: 'linebreak' } }, });
            currentY = (doc as any)["lastAutoTable"].finalY + 10;
        }
        const pageHeight = doc.internal.pageSize.height;
        if (currentY + 50 > pageHeight) { doc.addPage(); currentY = 20; } else { currentY += 10; }
        const auditorName = questionnaireAnswers.find(a => a.locationId === selectedLocation)?.answeredBy || "N/A";
        let storeManagerName = "N/A";
        const questionsForSignOff = getQuestionsForLocation(selectedLocation);
        const managerQuestion = questionsForSignOff.find(q => q.text.trim().toLowerCase() === 'location manager');
        if (managerQuestion) { const managerAnswer = questionnaireAnswers.find((a) => a.questionId === managerQuestion.id && a.locationId === selectedLocation); if (managerAnswer) { storeManagerName = formatQuestionnaireAnswer(managerAnswer.answer, managerQuestion); } }
        const currentDate = new Date().toLocaleDateString();
        doc.setFontSize(12); doc.text("Auditor Sign-off", 14, currentY); doc.setFontSize(10);
        doc.text(`Name: ${auditorName}`, 14, currentY + 10); doc.text("Signature: _____________________", 14, currentY + 20); doc.text(`Date: ${currentDate}`, 14, currentY + 30);
        doc.text("Store Manager Sign-off", 120, currentY); doc.text(`Name: ${storeManagerName}`, 120, currentY + 10); doc.text("Signature: _____________________", 120, currentY + 20); doc.text(`Date: ${currentDate}`, 120, currentY + 30);
    }
    const locationInfo = locationName ? `_${locationName}` : "";
    doc.save(`inventory_audit_report${locationInfo}.pdf`);
    toast.success("PDF Report downloaded");
  }, [selectedLocation, locationName, summary, baseTableData, questionnaireAnswers, getQuestionsForLocation, formatQuestionnaireAnswer, companyName, hasPricing, getItemValues]);

  const handleShowMore = () => { setVisibleCount((prev) => prev + 100); };
  const handleShowAll = () => { setVisibleCount(filteredTableData.length); };
  const showingAll = visibleCount >= filteredTableData.length && filteredTableData.length > 0;

  return (
    <AppLayout>
      <div>
        <div className="space-y-6" ref={reportRef}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reports</h1>
              <p className="text-muted-foreground">Generate and download inventory audit reports with auditor tracking</p>
            </div>
            <div className="flex gap-3 items-center">
                {canSubmit && (
                  <Button onClick={handleSubmitClick} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit to Client
                  </Button>
                )}
                {canFinalize && (
                  <Button onClick={handleFinalizeClick} className="bg-green-600 hover:bg-green-700 text-white">
                    <CheckCheck className="mr-2 h-4 w-4" /> Finalize Audit
                  </Button>
                )}
            </div>
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
                          <SelectItem value="variance-asc">Qty Variance (Low ↑)</SelectItem>
                          <SelectItem value="variance-desc">Qty Variance (High ↓)</SelectItem>
                          <SelectItem value="val-variance-asc">Value Var (Low ↑)</SelectItem>
                          <SelectItem value="val-variance-desc">Value Var (High ↓)</SelectItem>
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

              <div className="rounded-md border border-gray-200 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[100px]">SKU</TableHead>
                      <TableHead className="w-[180px]">Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Category</TableHead>
                      {hasPricing && (
                        <>
                           <TableHead className="text-right w-[100px] bg-indigo-50/50">Price</TableHead>
                           <TableHead className="text-right w-[100px] bg-indigo-50/50">Sys Val</TableHead>
                           <TableHead className="text-right w-[100px] bg-indigo-50/50">Phy Val</TableHead>
                           <TableHead className="text-right w-[100px] bg-indigo-50/50">Val Var</TableHead>
                        </>
                      )}
                      <TableHead className="text-center w-[80px]">Sys</TableHead>
                      <TableHead className="text-center w-[80px]">Phy</TableHead>
                      <TableHead className="text-center w-[80px]">Var</TableHead>
                      <TableHead className="text-center w-[100px]">Status</TableHead>
                      <TableHead className="w-[180px]">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleTableData.length > 0 ? (
                      visibleTableData.map((item) => {
                        const isDiscrepancy = item.status === "discrepancy";
                        const canEdit = canEditRemarkForItem(item.location);
                        const { unitPrice, sysValue, phyValue, valueVariance } = getItemValues(item);
                        
                        return (
                          <TableRow key={`${item.id}-${item.location}`}>
                            <TableCell className="font-medium text-gray-900 text-xs">{item.sku}</TableCell>
                            <TableCell className="truncate max-w-[180px] text-sm" title={item.name}>{item.name}</TableCell>
                            <TableCell className="text-xs">{item.location}</TableCell>
                            <TableCell className="text-xs">{item.category}</TableCell>
                            
                            {hasPricing && (
                                <>
                                  <TableCell className="text-right text-xs font-mono bg-indigo-50/30">
                                      {formatCurrency(unitPrice)}
                                  </TableCell>
                                  <TableCell className="text-right text-xs font-mono bg-indigo-50/30">
                                      {formatCurrency(sysValue)}
                                  </TableCell>
                                  <TableCell className={`text-right text-xs font-mono bg-indigo-50/30 ${item.status === 'discrepancy' ? 'text-red-600 font-bold' : ''}`}>
                                      {formatCurrency(phyValue)}
                                  </TableCell>
                                  <TableCell className={`text-right text-xs font-mono bg-indigo-50/30 font-bold ${valueVariance < 0 ? 'text-red-600' : valueVariance > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                      {formatCurrency(valueVariance)}
                                  </TableCell>
                                </>
                            )}

                            <TableCell className="text-center font-medium">{item.systemQuantity}</TableCell>
                            <TableCell className="text-center font-medium">{item.physicalQuantity}</TableCell>
                            <TableCell className={`text-center font-bold ${item.variance !== 0 ? "text-red-600" : ""}`}>{item.variance}</TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${item.status === "matched" ? "bg-green-100 text-green-800" : item.status === "discrepancy" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                                {item.status === "matched" ? "Matched" : item.status === "discrepancy" ? "Discrepancy" : "Pending"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {editingRemark === item.id ? (
                                <Input 
                                  value={tempRemark} 
                                  onChange={(e) => setTempRemark(e.target.value)}
                                  className="h-7 text-xs"
                                  placeholder="Add remark..."
                                  autoFocus
                                  onBlur={() => handleRemarkSave(item.id)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleRemarkSave(item.id)}
                                />
                              ) : (
                                <div 
                                  className={`text-xs flex items-center gap-1 min-h-[24px] ${canEdit && isDiscrepancy ? "cursor-pointer hover:bg-gray-50 rounded px-1 -ml-1 border border-transparent hover:border-gray-200" : ""}`}
                                  onClick={() => canEdit && isDiscrepancy ? handleRemarkStart(item.id, item.clientRemarks || "") : undefined}
                                >
                                  {item.clientRemarks ? (
                                    <span className="text-gray-700">{item.clientRemarks}</span>
                                  ) : canEdit && isDiscrepancy ? (
                                    <span className="text-muted-foreground italic flex items-center gap-1">
                                      <MessageSquare className="h-3 w-3" /> Add remark
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow><TableCell colSpan={hasPricing ? 13 : 9} className="text-center py-4 text-gray-500">No data available matching filters</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isOtpDialogOpen} onOpenChange={setIsOtpDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Audit Finalization Verification</DialogTitle>
            <DialogDescription>
              To finalize this audit, please verify with the One-Time Password sent to your registered device.
              This action will reset the current inventory counts for this location.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter 6-digit code" 
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                />
                <Button 
                  onClick={handleSendOtp} 
                  disabled={isSendingOtp}
                  variant="secondary"
                >
                  {isSendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOtpDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleVerifyAndFinalize} disabled={isVerifyingOtp}>
              {isVerifyingOtp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Verify & Finalize"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Reports;