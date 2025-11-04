import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory } from "@/context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileType, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import { useRef, useMemo, useCallback } from "react";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { LocationFilterDropdown } from "@/components/LocationFilterDropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    getLocationQuestionnaireAnswers,
    getQuestionById
  } = useInventory();
  
  const { 
    selectedLocation, 
    setSelectedLocation, 
    availableLocations,
    shouldShowLocationFilter,
    isAdmin,
    getLocationName
  } = useLocationFilter();
  
  const reportRef = useRef(null);
  
  // Memoized filtered data
  const { filteredAuditedItems, filteredItemMaster, summary } = useMemo(() => {
    const locationName = getLocationName(selectedLocation);
    
    if (isAdmin && !locationName) {
      return {
        filteredAuditedItems: auditedItems,
        filteredItemMaster: itemMaster,
        summary: getInventorySummary()
      };
    } else if (locationName) {
      return {
        filteredAuditedItems: auditedItems.filter(item => item.location === locationName),
        filteredItemMaster: itemMaster.filter(item => item.location === locationName),
        summary: getLocationSummary(locationName)
      };
    }
    
    return {
      filteredAuditedItems: isAdmin ? auditedItems : [],
      filteredItemMaster: isAdmin ? itemMaster : [],
      summary: isAdmin ? getInventorySummary() : { totalItems: 0, auditedItems: 0, matched: 0, discrepancies: 0, pendingItems: 0 }
    };
  }, [selectedLocation, auditedItems, itemMaster, isAdmin, getLocationName, getInventorySummary, getLocationSummary]);
  
  // Memoized table data with auditor information
  const tableData = useMemo(() => {
    return filteredItemMaster.map(item => {
      const auditedItem = filteredAuditedItems.find(a => a.id === item.id && a.location === item.location);
      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        location: item.location,
        systemQuantity: item.systemQuantity,
        physicalQuantity: auditedItem?.physicalQuantity || 0,
        variance: auditedItem ? auditedItem.physicalQuantity - item.systemQuantity : -item.systemQuantity,
        status: auditedItem?.status || 'pending',
        lastAudited: auditedItem?.lastAudited || '',
        auditorEntries: auditedItem?.auditorEntries || []
      };
    });
  }, [filteredItemMaster, filteredAuditedItems]);

  const generateCSV = useCallback((data: any[], filename: string) => {
    const headers = Array.from(
      new Set(
        data.flatMap(item => Object.keys(item))
      )
    );

    let csvContent = headers.join(',') + '\n';

    data.forEach(item => {
      const row = headers.map(header => {
        const value = item[header] !== undefined ? String(item[header]) : '';
        return value.includes(',') ? `"${value}"` : value;
      }).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`${filename} downloaded`);
  }, []);

  const downloadReconciliationReport = useCallback(() => {
    // Get all unique auditors from the filtered data
    const allAuditors = new Set<string>();
    tableData.forEach(item => {
      item.auditorEntries.forEach(entry => {
        allAuditors.add(entry.auditorName);
      });
    });
    
    const auditorList = Array.from(allAuditors).sort();
    
    const reportData = tableData.map(item => {
      const baseData: any = {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        location: item.location,
        systemQuantity: item.systemQuantity,
      };
      
      // Add a column for each auditor
      auditorList.forEach(auditorName => {
        const auditorEntry = item.auditorEntries.find(e => e.auditorName === auditorName);
        baseData[auditorName] = auditorEntry ? auditorEntry.quantityFound : 0;
      });
      
      // Add total and variance columns
      baseData.Total = item.physicalQuantity;
      baseData.variance = item.variance;
      baseData.status = item.status;
      baseData.lastAudited = item.lastAudited;
      
      return baseData;
    });
    
    const locationInfo = selectedLocation ? 
      `_${getLocationName(selectedLocation)}` : '';
      
    generateCSV(reportData, `inventory_reconciliation_report${locationInfo}.csv`);
  }, [tableData, selectedLocation, getLocationName, generateCSV]);

  const downloadDiscrepancyReport = useCallback(() => {
    const discrepancies = tableData.filter(item => item.variance !== 0);
    
    // Get all unique auditors from discrepancies
    const allAuditors = new Set<string>();
    discrepancies.forEach(item => {
      item.auditorEntries.forEach(entry => {
        allAuditors.add(entry.auditorName);
      });
    });
    
    const auditorList = Array.from(allAuditors).sort();
    
    const reportData = discrepancies.map(item => {
      const baseData: any = {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        location: item.location,
        systemQuantity: item.systemQuantity,
      };
      
      // Add a column for each auditor
      auditorList.forEach(auditorName => {
        const auditorEntry = item.auditorEntries.find(e => e.auditorName === auditorName);
        baseData[auditorName] = auditorEntry ? auditorEntry.quantityFound : 0;
      });
      
      // Add total and variance columns
      baseData.Total = item.physicalQuantity;
      baseData.variance = item.variance;
      baseData.lastAudited = item.lastAudited;
      
      return baseData;
    });
    
    const locationInfo = selectedLocation ? 
      `_${getLocationName(selectedLocation)}` : '';
      
    generateCSV(reportData, `discrepancy_report${locationInfo}.csv`);
  }, [tableData, selectedLocation, getLocationName, generateCSV]);

  const downloadSummaryReport = useCallback(() => {
    const summaryData = [
      {
        totalItems: summary.totalItems,
        auditedItems: summary.auditedItems,
        pendingItems: summary.pendingItems,
        matchedItems: summary.matched,
        discrepancies: summary.discrepancies,
        auditCompletionPercentage: summary.totalItems > 0 
          ? Math.round((summary.auditedItems / summary.totalItems) * 100) 
          : 0,
        generatedDate: new Date().toISOString(),
        location: selectedLocation ? 
          getLocationName(selectedLocation) : 'All Locations'
      }
    ];
    
    const locationInfo = selectedLocation ? 
      `_${getLocationName(selectedLocation)}` : '';
      
    generateCSV(summaryData, `audit_summary_report${locationInfo}.csv`);
  }, [summary, selectedLocation, getLocationName, generateCSV]);

  const formatQuestionnaireAnswer = useCallback((answer: string | string[], questionType: string) => {
    if (questionType === "yesNo") {
      return answer === "yes" ? "Yes" : "No";
    }
    
    if (Array.isArray(answer)) {
      return answer.join(", ");
    }
    
    return answer;
  }, []);

  const generatePDFReport = useCallback(() => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    const locationName = getLocationName(selectedLocation);
    const reportTitle = locationName 
      ? `Inventory Audit Report - ${locationName}`
      : "Inventory Audit Report - All Locations";
    
    doc.text(reportTitle, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
    doc.setFontSize(14);
    doc.text("Audit Summary", 14, 40);
    
    const summaryTableBody = [
      ["Total Items", summary.totalItems.toString()],
      ["Audited Items", summary.auditedItems.toString()],
      ["Matched Items", summary.matched.toString()],
      ["Discrepancies", summary.discrepancies.toString()],
      ["Completion Rate", `${summary.totalItems > 0 
        ? Math.round((summary.auditedItems / summary.totalItems) * 100) 
        : 0}%`]
    ];
    
    autoTable(doc, {
      startY: 45,
      head: [["Metric", "Value"]],
      body: summaryTableBody,
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246] }
    });
    
    let currentY = (doc as any)['lastAutoTable'] ? (doc as any)['lastAutoTable'].finalY + 10 : 90;
    doc.setFontSize(14);
    doc.text("Observations", 14, currentY);
    
    const observations = [];
    
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
    observations.forEach(obs => {
      doc.setFontSize(11);
      doc.text(`• ${obs}`, 16, observationY);
      observationY += 7;
    });
    
    // Discrepancy details with auditor breakdown
    const discrepancies = tableData
      .filter(item => item.status === "discrepancy")
      .map(item => {
        const auditorBreakdown = item.auditorEntries.length > 0 
          ? item.auditorEntries.map(e => `${e.auditorName}:${e.quantityFound}`).join(', ')
          : 'N/A';
        
        return [
          item.sku,
          item.name,
          item.location,
          item.systemQuantity.toString(),
          item.physicalQuantity.toString(),
          item.variance.toString(),
          
        ];
      });
      
    if (discrepancies.length > 0) {
      const discrepancyY = observationY + 10;
      doc.setFontSize(14);
      doc.text("Discrepancy Details with Auditor Breakdown", 14, discrepancyY);
      
      autoTable(doc, {
        startY: discrepancyY + 5,
        head: [["SKU", "Name", "Location", "System", "Physical", "Variance"]],
        body: discrepancies,
        theme: 'grid',
        headStyles: { fillColor: [249, 115, 22] },
        styles: { fontSize: 8 },
        columnStyles: {
          6: { cellWidth: 40 }
        }
      });
    }
    
    if (selectedLocation) {
      const answers = getLocationQuestionnaireAnswers(selectedLocation);
      
      if (answers.length > 0) {
        const lastTableY = (doc as any)['lastAutoTable'] 
          ? (doc as any)['lastAutoTable'].finalY + 15 
          : observationY + 15;
        
        doc.setFontSize(14);
        doc.text("Audit Questionnaire Responses", 14, lastTableY);
        
        const answerData = answers.map(answer => {
          const question = getQuestionById(answer.questionId);
          if (!question) return null;
          
          return [
            question.text,
            formatQuestionnaireAnswer(answer.answer, question.type),
            answer.answeredBy || 'N/A',
            new Date(answer.answeredOn).toLocaleDateString()
          ];
        }).filter(Boolean);
        
        if (answerData.length > 0) {
          autoTable(doc, {
            startY: lastTableY + 5,
            head: [["Question", "Response", "Answered By", "Date"]],
            body: answerData,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 9 },
            columnStyles: {
              0: { cellWidth: 80 },
              1: { cellWidth: 60 },
            }
          });
        }
        
        const lastPos = (doc as any)['lastAutoTable'] ? (doc as any)['lastAutoTable'].finalY + 20 : doc.internal.pageSize.height - 60;
        
        doc.setFontSize(12);
        doc.text("Auditor Sign-off", 14, lastPos);
        
        doc.setFontSize(10);
        doc.text("Name: _________________________", 14, lastPos + 10);
        doc.text("Signature: _____________________", 14, lastPos + 20);
        doc.text("Date: __________________________", 14, lastPos + 30);
        
        doc.text("Client Sign-off", 120, lastPos + 10);
        doc.text("Name: _________________________", 120, lastPos + 20);
        doc.text("Signature: _____________________", 120, lastPos + 30);
      }
    }
    
    const locationInfo = selectedLocation ? 
      `_${getLocationName(selectedLocation)}` : '';
      
    doc.save(`inventory_audit_report${locationInfo}.pdf`);
    toast.success("PDF Report downloaded");
  }, [selectedLocation, summary, tableData, getLocationName, getLocationQuestionnaireAnswers, getQuestionById, formatQuestionnaireAnswer]);

  return (
    <AppLayout>
      <div>
        {isAdmin || availableLocations.length > 0 ? (
          <div className="space-y-6" ref={reportRef}>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
                <p className="text-muted-foreground">Generate and download inventory audit reports with auditor tracking</p>
              </div>
              
              {shouldShowLocationFilter && (
                <LocationFilterDropdown
                  selectedLocation={selectedLocation}
                  onLocationChange={setSelectedLocation}
                  availableLocations={availableLocations}
                  showAllOption={isAdmin}
                />
              )}
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-indigo-50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                    Reconciliation Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Complete report with auditor breakdown showing who audited each item.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full border-indigo-200 hover:bg-indigo-50" 
                    onClick={downloadReconciliationReport}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-orange-50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-orange-600" />
                    Discrepancy Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Filtered report showing discrepancies with auditor details.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full border-orange-200 hover:bg-orange-50"
                    onClick={downloadDiscrepancyReport}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    Audit Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    High-level summary of the audit with key metrics.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full border-green-200 hover:bg-green-50"
                    onClick={downloadSummaryReport}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileType className="h-5 w-5 text-purple-600" />
                    Complete PDF Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Complete audit report with auditor breakdown in PDF format.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full border-purple-200 hover:bg-purple-50"
                    onClick={generatePDFReport}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </CardContent>
              </Card>
            </div>
            
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Audit Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                    <p className="text-2xl font-bold text-gray-800">{summary.totalItems}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Items Audited</p>
                    <p className="text-2xl font-bold text-blue-600">{summary.auditedItems}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Matched Items</p>
                    <p className="text-2xl font-bold text-green-600">{summary.matched}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Discrepancies</p>
                    <p className="text-2xl font-bold text-red-600">{summary.discrepancies}</p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Audit Completion</span>
                    <span className="text-sm font-medium">
                      {summary.totalItems > 0 
                        ? Math.round((summary.auditedItems / summary.totalItems) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${summary.totalItems > 0 
                        ? Math.round((summary.auditedItems / summary.totalItems) * 100) 
                        : 0}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Detailed Report with Auditor Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>System Qty</TableHead>
                        <TableHead>Physical Qty</TableHead>
                        <TableHead>Variance</TableHead>
                        <TableHead>Auditors</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.length > 0 ? (
                        tableData.map((item) => (
                          <TableRow key={`${item.id}-${item.location}`}>
                            <TableCell>{item.sku}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.location}</TableCell>
                            <TableCell>{item.systemQuantity}</TableCell>
                            <TableCell>{item.physicalQuantity}</TableCell>
                            <TableCell className={item.variance !== 0 ? "text-red-600 font-medium" : ""}>{item.variance}</TableCell>
                            <TableCell className="text-xs">
                              {item.auditorEntries.length > 0 ? (
                                <div className="space-y-1">
                                  {item.auditorEntries.map((entry, idx) => (
                                    <div key={idx} className="flex justify-between">
                                      <span className="text-gray-600">{entry.auditorName}:</span>
                                      <span className="font-medium">{entry.quantityFound}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">Not audited</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                item.status === 'matched' ? 'bg-green-100 text-green-800' : 
                                item.status === 'discrepancy' ? 'bg-red-100 text-red-800' : 
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {item.status === 'matched' ? 'Matched' : 
                                 item.status === 'discrepancy' ? 'Discrepancy' : 
                                 'Pending'}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-4">No data available</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div> 
        ) : (
          <div className="absolute top-2/4 left-2/4 translate-2/4">
            <h1 className="text-black/50 font-semibold text-[1.2rem]">Currently You Don't have access</h1>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Reports;