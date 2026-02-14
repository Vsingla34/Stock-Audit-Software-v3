import React, { useState, useRef, useEffect } from "react";
import { useInventory } from "@/context/InventoryContext"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Barcode, Scan, Check, MapPin, Keyboard, Camera, X, Loader2, Plus, AlertCircle, PackagePlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from "html5-qrcode";
import { useUser } from "@/context/UserContext"; 
import { LocationAuditSummary } from "@/components/locations/LocationAuditSummary";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { useCompany } from "@/context/CompanyContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BarcodeScannerProps {
    onResult?: (code: string) => void;
    className?: string;
}

export const BarcodeScanner = ({ onResult, className }: BarcodeScannerProps) => {
    const [isScanning, setIsScanning] = useState(false);
    const [isHardwareScannerMode, setIsHardwareScannerMode] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); 
    const [manualBarcode, setManualBarcode] = useState("");
    const [scannedBarcode, setScannedBarcode] = useState(""); 
    
    // Sub-Location State
    const [newSubLocation, setNewSubLocation] = useState("");
    const [selectedSubLocation, setSelectedSubLocation] = useState<string>("");

    // New State for "Item Not Found" Workflow
    const [isNotFoundOpen, setIsNotFoundOpen] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [scannedUnknownBarcode, setScannedUnknownBarcode] = useState("");
    const [newItem, setNewItem] = useState({
        sku: "",
        name: "",
        category: "",
        physicalQuantity: 1 as number | string // Allow string for empty input state
    });

    const { 
        itemMaster, 
        auditedItems, 
        updateAuditedItem, 
        locations, 
        assignments,
        activeSubLocations, 
        fetchSubLocations, 
        addSubLocationToDb,
        addSurplusItem 
    } = useInventory();

    const { currentUser } = useUser();
    const { selectedAssignmentId } = useCompany();

    const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
    const selectedLocation = currentAssignment?.locationId || "";
    
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const isProcessingRef = useRef(false); 
    const scannerElementId = "barcode-scanner-element";

    // Ref for the hidden input that captures hardware scanner data
    const hardwareInputRef = useRef<HTMLInputElement>(null);

    const isPickerMode = !!onResult;

    useEffect(() => {
        if (selectedLocation) {
            fetchSubLocations(selectedLocation).catch(console.error);
            setSelectedSubLocation("");
        }
    }, [selectedLocation]);

    const handleAddSubLocation = async () => {
        if (!newSubLocation.trim()) return;
        if (!selectedLocation) {
            toast.error("No active location found");
            return;
        }

        try {
            await addSubLocationToDb(newSubLocation.trim(), selectedLocation);
            setSelectedSubLocation(newSubLocation.trim());
            setNewSubLocation("");
            toast.success(`Sub-location saved: ${newSubLocation.trim()}`);
        } catch (error) {
            toast.error("Failed to save sub-location");
        }
    };

    const handleItemScan = async (barcode: string, locationId: string) => {
        if (onResult) {
            onResult(barcode);
            toast.success("Barcode scanned");
            return true;
        }

        if (typeof updateAuditedItem !== 'function') return false;

        try {
            if (!locationId) {
                 toast.error("Location Required", { description: "No active assignment location found." });
                 return false; 
            }

            if (!selectedSubLocation) {
                 toast.error("Sub-Location Required", { description: "Please select a Box, Row, or Rack." });
                 return false;
            }

            const locationObj = locations.find(loc => loc.id === locationId);
            const locationName = locationObj?.name || '';
            
            const masterItem = itemMaster.find(item => (item.sku === barcode) && item.location === locationName);
            
            if (!masterItem) {
                const itemInOtherLocation = itemMaster.find(item => item.sku === barcode);
                if (itemInOtherLocation) {
                    toast.error("Item mismatch", { description: `Item exists at ${itemInOtherLocation.location}, not ${locationName}.` });
                } else {
                    setScannedUnknownBarcode(barcode);
                    setIsNotFoundOpen(true);
                    if (isScanning && html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
                        html5QrCodeRef.current.pause();
                    }
                }
                return false;
            }

            const existingAuditedItem = auditedItems.find(item => item.sku === masterItem.sku && item.location === locationName);
            const targetItem = existingAuditedItem || masterItem;

            const existingAuditorEntries = targetItem.auditorEntries || [];
            const currentEntry = existingAuditorEntries.find(e => e.auditorId === currentUser?.id && e.subLocation === selectedSubLocation);
            const currentQuantity = currentEntry?.quantityFound || 0;
            const newQuantity = currentQuantity + 1;

            const itemToUpdate = {
                ...targetItem,
                physicalQuantity: newQuantity, 
                status: 'pending' as const,
                lastAudited: new Date().toISOString(),
                notes: targetItem.notes || masterItem.notes,
            };

            await updateAuditedItem(
                itemToUpdate,
                currentUser?.id,
                currentUser?.email || currentUser?.name || 'Unknown Auditor',
                selectedSubLocation
            );

            const otherEntriesSum = existingAuditorEntries
                .filter(e => !(e.auditorId === currentUser?.id && e.subLocation === selectedSubLocation))
                .reduce((sum, e) => sum + e.quantityFound, 0);
            
            const totalPhysicalQuantity = otherEntriesSum + newQuantity;
            const isMatch = totalPhysicalQuantity === masterItem.systemQuantity;

            toast(isMatch ? "Matched!" : "Item Scanned", {
                description: (
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold">{masterItem.name}</span>
                        <div className="flex flex-col text-xs">
                           <span>Count in {selectedSubLocation}: {newQuantity}</span>
                           <span>Total All Locs: {totalPhysicalQuantity} / {masterItem.systemQuantity}</span>
                        </div>
                    </div>
                ),
                className: isMatch ? "border-green-500 bg-green-50" : ""
            });

            return true;
        } catch (error: any) {
            console.error("Scanning failed:", error);
            toast.error("Scanning Error", { description: error.message });
            return false;
        }
    };

    const handleAddSurplus = async () => {
        if (!newItem.sku || !newItem.name) return;
        try {
            // FIX: Ensure quantity is a valid number before submission
            const submissionItem = {
                ...newItem,
                physicalQuantity: Number(newItem.physicalQuantity) || 0
            };
            
            await addSurplusItem(submissionItem);
            toast.success("Surplus item added successfully");
            setIsAddDialogOpen(false);
            setScannedBarcode(newItem.sku);
            setNewItem({ sku: "", name: "", category: "", physicalQuantity: 1 });
            
            if (isScanning && html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.PAUSED) {
                html5QrCodeRef.current.resume();
            }
        } catch (error: any) {
            toast.error("Failed to add surplus item", { description: error.message });
        }
    };

    const onScanSuccess = async (decodedText: string) => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        setIsProcessing(true);

        try {
            if (html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
                html5QrCodeRef.current.pause();
            }
        } catch (e) {
            console.warn("Failed to pause scanner:", e);
        }

        try {
            const success = await handleItemScan(decodedText, selectedLocation);
            if (success) setScannedBarcode(decodedText);
        } catch (e) {
            console.error(e);
        } finally {
            setTimeout(() => {
                if (!isNotFoundOpen && !isAddDialogOpen && html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.PAUSED) {
                    try {
                        html5QrCodeRef.current.resume();
                    } catch (e) {
                        console.warn("Failed to resume scanner:", e);
                    }
                }
                isProcessingRef.current = false;
                setIsProcessing(false);
            }, 1500);
        }
    };

    const handleDeclineNotFound = () => {
        setIsNotFoundOpen(false);
        if (isScanning && html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.PAUSED) {
            html5QrCodeRef.current.resume();
        }
    };

    const handleOpenAddForm = () => {
        setIsNotFoundOpen(false);
        setNewItem(prev => ({ ...prev, sku: scannedUnknownBarcode }));
        setIsAddDialogOpen(true);
    };

    // Hardware Scanner Logic using a focused hidden input
    useEffect(() => {
        let focusInterval: any;
        
        // FIX: Stop aggressive focusing if a dialog is open or user is typing manually
        if (isHardwareScannerMode && !isAddDialogOpen && !isNotFoundOpen) {
            // Keep focusing the hidden input so it captures OTG scanner data
            focusInterval = setInterval(() => {
                // Check if user is focused on another valid input (like manual barcode entry or sublocation input)
                const activeElement = document.activeElement;
                const isUserTyping = activeElement?.tagName === 'INPUT' && activeElement !== hardwareInputRef.current;

                if (hardwareInputRef.current && activeElement !== hardwareInputRef.current && !isUserTyping) {
                    hardwareInputRef.current.focus();
                }
            }, 300);
        }
        return () => {
            if (focusInterval) clearInterval(focusInterval);
        };
    }, [isHardwareScannerMode, isAddDialogOpen, isNotFoundOpen]); // Added dependencies

    const handleHardwareInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const barcode = e.currentTarget.value.trim();
            
            if (barcode) {
                handleItemScan(barcode, selectedLocation).then(success => { 
                    if (success) setScannedBarcode(barcode); 
                });
            } else {
                toast.error("Empty scan - Try scanning again");
            }
            
            // Clear input for next scan
            e.currentTarget.value = "";
        }
    };

    useEffect(() => {
        return () => {
            isProcessingRef.current = false; 
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().then(() => html5QrCodeRef.current?.clear()).catch(console.error);
            }
        };
    }, []);

    const handleStartHardwareScanner = () => {
        if (!isPickerMode && !selectedLocation) { toast.error("Location required"); return; }
        if (!isPickerMode && !selectedSubLocation) { toast.error("Select Sub-Location first"); return; }
        
        setIsHardwareScannerMode(true);
        handleStopScanning(); 
        toast.success("Hardware scanner activated");
        setTimeout(() => hardwareInputRef.current?.focus(), 100);
    };

    const handleStopHardwareScanner = () => {
        setIsHardwareScannerMode(false);
    };

    const handleStartScanning = async () => {
        if (!isPickerMode && !selectedLocation) { toast.error("Location required"); return; }
        if (!isPickerMode && !selectedSubLocation) { toast.error("Select Sub-Location first"); return; }

        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            toast.error("Protocol Error", { description: "Camera access requires HTTPS or localhost." });
            return;
        }

        setIsScanning(true);
        setIsHardwareScannerMode(false);
        setIsProcessing(false);
        isProcessingRef.current = false;

        setTimeout(async () => {
            if (html5QrCodeRef.current) {
                try {
                    if (html5QrCodeRef.current.isScanning) {
                        await html5QrCodeRef.current.stop();
                    }
                    html5QrCodeRef.current.clear();
                } catch (e) { console.warn("Cleanup warning:", e); }
            }

            const html5QrCode = new Html5Qrcode(scannerElementId);
            html5QrCodeRef.current = html5QrCode;

            const config = {
                fps: 10,
                aspectRatio: 1.0, 
                qrbox: 250, 
                disableFlip: false, 
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.UPC_A,
                ]
            };

            const startCamera = async (cameraIdOrConfig: string | { facingMode: string }) => {
                await html5QrCode.start(cameraIdOrConfig, config, onScanSuccess, () => {});
            };

            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length > 0) {
                     const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
                     await startCamera(backCamera ? backCamera.id : devices[0].id);
                } else {
                    await startCamera({ facingMode: "environment" });
                }
            } catch (finalError: any) {
                 setIsScanning(false);
                 toast.error("Camera Failed", { description: "Could not start video stream." });
            }
        }, 300);
    };

    const handleStopScanning = async () => {
        try {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
            }
            setIsScanning(false);
        } catch (err) {
            setIsScanning(false);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isPickerMode && !selectedLocation) { toast.error("Location required"); return; }
        if (!isPickerMode && !selectedSubLocation) { toast.error("Select Sub-Location first"); return; }
        if (manualBarcode.trim()) {
            handleItemScan(manualBarcode.trim(), selectedLocation).then(success => {
                if (success) { setScannedBarcode(manualBarcode.trim()); setManualBarcode(""); }
            });
        }
    };

    return (
        <div className={className || (isPickerMode ? "" : "flex flex-col lg:grid lg:grid-cols-2 gap-6 pb-20")}>
            <style>{`
                #barcode-scanner-element video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                    border-radius: 0.5rem;
                }
            `}</style>

            <div className={isPickerMode ? "" : "order-1 lg:order-1"}>
                <Card className="shadow-sm border-gray-200">
                    {!isPickerMode && (
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-gray-900">
                            <div className="flex items-center gap-2">
                                <Barcode className="h-5 w-5 text-indigo-600" />
                                <span>Scanner</span>
                            </div>
                            {isScanning && !isProcessing && <span className="text-xs font-normal text-red-500 animate-pulse flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/> Live</span>}
                            {isProcessing && <span className="text-xs font-normal text-indigo-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> Processing</span>}
                        </CardTitle>
                    </CardHeader>
                    )}
                    <CardContent className={isPickerMode ? "pt-6" : ""}>
                        <div className="space-y-4">
                            {!isPickerMode && (
                                <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                                    <MapPin className="h-4 w-4 text-indigo-500" />
                                    <span className="text-sm font-medium text-gray-700 truncate">
                                        {locations.find(l => l.id === selectedLocation)?.name || 'Select Assignment...'}
                                    </span>
                                </div>
                            )}

                            {!isPickerMode && (
                                <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                    <Label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                                         Audit Sub-Location (Box / Row / Rack)
                                    </Label>
                                    <div className="flex gap-2 mb-2">
                                        <Input 
                                            placeholder="Add Sub-Location (e.g. Box 5)" 
                                            value={newSubLocation}
                                            onChange={(e) => setNewSubLocation(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubLocation()}
                                            className="bg-white"
                                        />
                                        <Button variant="outline" onClick={handleAddSubLocation} size="icon">
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    
                                    <Select value={selectedSubLocation} onValueChange={setSelectedSubLocation}>
                                        <SelectTrigger className="w-full bg-white">
                                            <SelectValue placeholder="Select active sub-location..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {activeSubLocations.length === 0 ? (
                                                <SelectItem value="default" disabled>Add a sub-location above</SelectItem>
                                            ) : (
                                                activeSubLocations.map((sl) => (
                                                    <SelectItem key={sl} value={sl}>{sl}</SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {!selectedSubLocation && <p className="text-xs text-red-500 mt-1 ml-1">* Required to start scanning</p>}
                                </div>
                            )}
                            
                            {isHardwareScannerMode ? (
                                <div>
                                    <div className="w-full aspect-video relative bg-indigo-50 rounded-lg overflow-hidden mb-4 flex items-center justify-center border-2 border-indigo-200 border-dashed">
                                        <div className="text-center p-4">
                                            <Keyboard className="h-10 w-10 text-indigo-500 mx-auto mb-2 animate-bounce" />
                                            <p className="text-indigo-900 font-semibold">Hardware Mode</p>
                                            <p className="text-sm text-indigo-600">Ready to scan with external device</p>
                                            {scannedBarcode && (
                                                <div className="mt-3 inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
                                                    <Check className="h-3 w-3 text-green-500" />
                                                    <span className="text-xs font-mono text-gray-700">{scannedBarcode}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="destructive" className="w-full" onClick={handleStopHardwareScanner}>
                                        <X className="mr-2 h-4 w-4" /> Stop Hardware Scanner
                                    </Button>
                                </div>
                            ) : (
                                <div>
                                    <div 
                                        className={`w-full relative rounded-lg overflow-hidden mb-4 border border-gray-200 bg-black ${!isScanning ? 'hidden' : 'block'}`}
                                        style={{ minHeight: '250px' }} 
                                    >
                                        <div id={scannerElementId} className="w-full h-full" />
                                        {isProcessing && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 backdrop-blur-[2px]">
                                                <div className="bg-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                                                    <Check className="h-5 w-5 text-green-600" />
                                                    <span className="font-semibold text-gray-800">Scanned!</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {!isScanning && (
                                        <div className="w-full aspect-video relative bg-gray-100 rounded-lg overflow-hidden mb-4 flex items-center justify-center border border-gray-200">
                                            <div className="text-center text-gray-400">
                                                <Camera className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">Camera inactive</p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {isScanning ? (
                                        <Button variant="destructive" className="w-full" onClick={handleStopScanning}>
                                            <X className="mr-2 h-4 w-4" /> Stop Camera
                                        </Button>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button variant="default" className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleStartScanning} disabled={!isPickerMode && (!selectedLocation || !selectedSubLocation)}>
                                                <Scan className="mr-2 h-4 w-4" /> Camera
                                            </Button>
                                            <Button variant="outline" className="w-full border-gray-300 text-gray-700" onClick={handleStartHardwareScanner} disabled={!isPickerMode && (!selectedLocation || !selectedSubLocation)}>
                                                <Keyboard className="mr-2 h-4 w-4" /> Hardware
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {!isPickerMode && (
                                <div className="border-t border-gray-100 pt-4">
                                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                                        <Input placeholder="Manual barcode..." value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)} disabled={!selectedLocation} className="focus:ring-indigo-600" />
                                        <Button type="submit" disabled={!selectedLocation || !selectedSubLocation || !manualBarcode.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                            <Check className="h-4 w-4" />
                                        </Button>
                                    </form>
                                </div>
                            )}

                            {/* ROBUST HIDDEN INPUT FOR OTG SCANNERS */}
                            <input 
                                ref={hardwareInputRef} 
                                type="text" 
                                className="absolute opacity-0 pointer-events-none" 
                                style={{ position: 'absolute', left: '-9999px' }}
                                onKeyDown={handleHardwareInputKeyDown}
                                tabIndex={-1} 
                                autoComplete="off" 
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {!isPickerMode && (
                <div className="space-y-6 order-2 lg:order-2">
                    {selectedLocation ? (
                        <>
                            <LocationAuditSummary locationId={selectedLocation} hideDropdown={true} />
                            <RecentActivity selectedLocation={selectedLocation} />
                        </>
                    ) : (
                        <Card className="h-full flex items-center justify-center p-6 shadow-sm border-gray-200">
                            <div className="text-center text-gray-400">
                                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>Please select an active assignment <br/> to start scanning.</p>
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* Workflow Dialogs */}
            <Dialog open={isNotFoundOpen} onOpenChange={setIsNotFoundOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-orange-600">
                            <AlertCircle className="h-5 w-5" />
                            <DialogTitle>Item Not Found</DialogTitle>
                        </div>
                        <DialogDescription className="pt-2 text-gray-700">
                            The barcode <span className="font-mono font-bold text-gray-900">{scannedUnknownBarcode}</span> was not found in the master data for this location.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-row gap-2 sm:justify-end">
                        <Button variant="outline" onClick={handleDeclineNotFound} className="flex-1 sm:flex-none">
                            Decline
                        </Button>
                        <Button onClick={handleOpenAddForm} className="bg-indigo-600 hover:bg-indigo-700 flex-1 sm:flex-none">
                            <PackagePlus className="mr-2 h-4 w-4" />
                            Add New Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add Surplus Item</DialogTitle>
                        <DialogDescription>
                            Found an item missing from the system? Enter its details below.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="scan-sku" className="text-gray-500">SKU / Barcode</Label>
                            <Input id="scan-sku" value={newItem.sku} readOnly className="bg-gray-50 font-mono" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="scan-name">Item Name</Label>
                            <Input 
                                id="scan-name" 
                                value={newItem.name} 
                                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                                placeholder="e.g. Wireless Mouse"
                                autoFocus
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="scan-cat">Category</Label>
                            <Input 
                                id="scan-cat" 
                                value={newItem.category} 
                                onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                                placeholder="e.g. Electronics"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="scan-qty">Physical Quantity Found</Label>
                            <Input 
                                id="scan-qty" 
                                type="number"
                                min="1"
                                value={newItem.physicalQuantity} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setNewItem({
                                        ...newItem,
                                        physicalQuantity: val === "" ? "" : parseInt(val)
                                    });
                                }}
                            />
                        </div>
                        <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100 text-xs text-indigo-800">
                            <strong>Note:</strong> System Quantity will be 0. 
                            This item will be recorded at <strong>{selectedSubLocation}</strong>.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddSurplus} disabled={!newItem.name} className="bg-indigo-600 hover:bg-indigo-700">
                            Save Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};