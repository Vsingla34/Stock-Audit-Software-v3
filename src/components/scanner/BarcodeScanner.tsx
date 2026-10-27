import React, { useState, useRef, useEffect, useMemo } from "react";
import { useInventory } from "@/context/InventoryContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Barcode, Scan, Check, MapPin, Keyboard, Camera, X, Loader2, Plus, AlertCircle, PackagePlus, ChevronsUpDown } from "lucide-react";
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// 🔥 OFFLINE FEATURE: Import the new banner
import { SyncStatusBanner } from "@/components/scanner/SyncStatusBanner";

export type ScannerMode = 'camera' | 'hardware';

interface BarcodeScannerProps {
    onResult?: (code: string) => void;
    className?: string;
    /** Picker mode only: start this scanner automatically and hide the Camera/Hardware chooser. */
    preferredMode?: ScannerMode | null;
    /** Picker mode only: called when the user picks Camera or Hardware, so the caller can remember it. */
    onModeChosen?: (mode: ScannerMode) => void;
}

export const BarcodeScanner = ({ onResult, className, preferredMode, onModeChosen }: BarcodeScannerProps) => {
    const [isScanning, setIsScanning] = useState(false);
    const [isHardwareScannerMode, setIsHardwareScannerMode] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [manualBarcode, setManualBarcode] = useState("");
    const [scannedBarcode, setScannedBarcode] = useState("");

    // Sub-Location State
    const [newSubLocation, setNewSubLocation] = useState("");
    const [selectedSubLocation, setSelectedSubLocation] = useState<string>("");

    // Search State
    const [subLocationSearchOpen, setSubLocationSearchOpen] = useState(false);
    const [subLocationSearchQuery, setSubLocationSearchQuery] = useState("");

    // New State for "Item Not Found" Workflow
    const [isNotFoundOpen, setIsNotFoundOpen] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [scannedUnknownBarcode, setScannedUnknownBarcode] = useState("");

    // 🔥 FIX: Category Option State
    const [categoryOption, setCategoryOption] = useState<string>("");

    const [newItem, setNewItem] = useState<{
        sku: string;
        name: string;
        category: string;
        physicalQuantity: number | string;
        customAttributes: Record<string, any>;
    }>({
        sku: "",
        name: "",
        category: "",
        physicalQuantity: 1,
        customAttributes: {}
    });

    const {
        itemMaster,
        auditedItems,
        addItemToAudit,
        locations,
        assignments,
        activeSubLocations,
        fetchSubLocations,
        addSubLocationToDb,
        addSurplusItem,
        fetchGlobalItem,
        findItem
    } = useInventory();

    const { currentUser } = useUser();
    const { selectedAssignmentId } = useCompany();

    const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
    const selectedLocation = currentAssignment?.locationId || "";

    // 🔥 FIX: Extract dynamic columns from master data and ensure Rate/unit_price is included
    const dynamicColumns = useMemo(() => {
        // Only needed by the "Add Surplus Item" dialog; skip the 15k-item scan
        // on every render/scan while it's closed.
        if (!isAddDialogOpen) return ['unit_price'];
        const keys = new Set<string>();
        itemMaster.forEach(item => {
            if (item.customAttributes) {
                Object.keys(item.customAttributes).forEach(k => {
                    // Ignore computed value fields
                    if (!['system_value', 'physical_value'].includes(k.toLowerCase())) {
                        keys.add(k);
                    }
                });
            }
        });
        // Always include unit_price so the Rate field is guaranteed to appear
        keys.add('unit_price');
        return Array.from(keys).sort(); // Sort alphabetically for consistency
    }, [itemMaster, isAddDialogOpen]);

    // 🔥 FIX: Extract unique categories from master data (only when dialog is open)
    const uniqueCategories = useMemo(() => {
        if (!isAddDialogOpen) return [] as string[];
        const cats = new Set<string>();
        itemMaster.forEach(item => {
            if (item.category && item.category !== "-" && item.category.trim() !== "") {
                cats.add(item.category.trim());
            }
        });
        return Array.from(cats).sort();
    }, [itemMaster, isAddDialogOpen]);

    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const isProcessingRef = useRef(false);
    // Live mirror of "not-found / add-item dialog is open" (state is stale inside the camera callback).
    const dialogOpenRef = useRef(false);
    const scannerElementId = "barcode-scanner-element";

    const hardwareInputRef = useRef<HTMLInputElement>(null);
    const isPickerMode = !!onResult;

    // The camera library keeps the callback it was started with. Without these
    // refs it kept using the render from when the camera was started (old
    // sub-location, old item list), so scans could be saved against a stale
    // sub-location. The wrapper always calls the latest handler.
    const onScanSuccessRef = useRef<(code: string) => void>(() => { });
    const selectedLocationRef = useRef(selectedLocation);
    selectedLocationRef.current = selectedLocation;
    const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced Search Effect
    useEffect(() => {
        if (!selectedLocation) return;

        const timer = setTimeout(() => {
            fetchSubLocations(selectedLocation, subLocationSearchQuery);
        }, 300);

        return () => clearTimeout(timer);
    }, [subLocationSearchQuery, selectedLocation]);

    const handleAddSubLocation = async () => {
        const trimmedName = newSubLocation.trim();
        if (!trimmedName) return;
        if (!selectedLocation) {
            toast.error("No active location found");
            return;
        }

        try {
            await addSubLocationToDb(trimmedName, selectedLocation);
            setSelectedSubLocation(trimmedName);
            setNewSubLocation("");
            toast.success(`Sub-location saved: ${trimmedName}`);
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

        if (typeof addItemToAudit !== 'function') return false;

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

            // O(1) indexed lookup (was a linear scan over every item per scan)
            let masterItem = findItem(barcode, locationName);

            if (!masterItem) {
                try {
                    // Instant feedback + a hard time limit: a slow network must not
                    // freeze the scanner (isProcessingRef blocks further scans meanwhile).
                    toast.loading("Checking master data…", { id: "scan-lookup" });
                    const globalItem = await Promise.race([
                        fetchGlobalItem(barcode),
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
                    ]);
                    toast.dismiss("scan-lookup");
                    if (globalItem) {
                        const newItemPayload = {
                            sku: globalItem.sku,
                            name: globalItem.name || "Unnamed Item",
                            category: globalItem.category || "-",
                            physicalQuantity: 1,
                            customAttributes: globalItem.custom_attributes || {}
                        };

                        await addSurplusItem(newItemPayload);

                        toast.success("Item Found in Master", {
                            description: `${newItemPayload.name} added to audit.`,
                            className: "border-blue-500 bg-blue-50"
                        });

                        return true;
                    }
                } catch (err) {
                    toast.dismiss("scan-lookup");
                    console.error("Global lookup failed", err);
                }
            }

            if (!masterItem) {
                const itemInOtherLocation = itemMaster.find(item => item.sku === barcode);
                if (itemInOtherLocation) {
                    toast.error("Item mismatch", { description: `Item exists at ${itemInOtherLocation.location}, not ${locationName}.` });
                } else {
                    setScannedUnknownBarcode(barcode);
                    dialogOpenRef.current = true;
                    setIsNotFoundOpen(true);
                    if (html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
                        html5QrCodeRef.current.pause();
                    }
                }
                return false;
            }

            // findItem already returns the live (audited) row
            const accurateNewTotal = await addItemToAudit(
                masterItem,
                1,
                currentUser?.id,
                (currentUser as any)?.name || currentUser?.email || 'Unknown Auditor',
                selectedSubLocation
            );

            const isMatch = accurateNewTotal === masterItem.systemQuantity;

            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);

            // fixed id => each scan REPLACES the previous toast instead of stacking up
            toast.success("Scan recorded successfully!", {
                id: "scan-recorded",
                duration: 1500,
                description: (
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold">{masterItem.name}</span>
                        <div className="flex flex-col text-xs">
                            <span>Added +1 to {selectedSubLocation}</span>
                            <span>Total All Locs: {accurateNewTotal} / {masterItem.systemQuantity}</span>
                        </div>
                    </div>
                ),
                className: isMatch ? "border-green-500 bg-green-50" : ""
            });

            return true;
        } catch (error: any) {
            console.error("Scan failed:", error);
            toast.error(error.message || "Failed to record scan. Please try again.");
            return false;
        }
    };

    const handleAddSurplus = async () => {
        if (!newItem.sku || !newItem.name) return;
        try {
            const submissionItem = {
                sku: newItem.sku,
                name: newItem.name,
                category: newItem.category,
                physicalQuantity: Number(newItem.physicalQuantity) || 0,
                subLocation: selectedSubLocation, // 🔥 FIX: Passing subLocation automatically
                customAttributes: newItem.customAttributes
            };

            await addSurplusItem(submissionItem);
            toast.success("Surplus item added successfully");
            setIsAddDialogOpen(false);
            dialogOpenRef.current = false;
            setScannedBarcode(newItem.sku);

            setNewItem({ sku: "", name: "", category: "", physicalQuantity: 1, customAttributes: {} });
            setCategoryOption("");

            if (html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.PAUSED) {
                html5QrCodeRef.current.resume();
            }
        } catch (error: any) {
            toast.error("Failed to add surplus item", { description: error.message });
        }
    };

    // The camera decodes the same code many times a second while it stays in
    // frame. Ignore the SAME code for a short window, but accept a DIFFERENT
    // code immediately (the old fixed 700ms lock after every scan made fast
    // scanning feel laggy).
    const SAME_CODE_COOLDOWN_MS = 900;

    const onScanSuccess = async (decodedText: string) => {
        if (isProcessingRef.current) return;
        const now = Date.now();
        if (lastScanRef.current.code === decodedText && now - lastScanRef.current.at < SAME_CODE_COOLDOWN_MS) return;
        lastScanRef.current = { code: decodedText, at: now };
        isProcessingRef.current = true;

        try {
            const success = await handleItemScan(decodedText, selectedLocationRef.current);
            if (success) {
                setScannedBarcode(decodedText);
                // brief "Scanned!" flash; does not block the next scan
                setIsProcessing(true);
                if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
                flashTimerRef.current = setTimeout(() => setIsProcessing(false), 450);
            }
        } catch (e) {
            console.error(e);
        } finally {
            // Only resumes if handleItemScan paused it (item-not-found flow).
            if (!dialogOpenRef.current && html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.PAUSED) {
                try {
                    html5QrCodeRef.current.resume();
                } catch (e) {
                    console.warn("Failed to resume scanner:", e);
                }
            }
            isProcessingRef.current = false;
        }
    };
    onScanSuccessRef.current = onScanSuccess;

    const handleDeclineNotFound = () => {
        dialogOpenRef.current = false;
        setIsNotFoundOpen(false);
        if (html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.PAUSED) {
            html5QrCodeRef.current.resume();
        }
    };

    const handleOpenAddForm = () => {
        setIsNotFoundOpen(false);
        // Reset state and prepopulate SKU
        setNewItem(prev => ({ ...prev, sku: scannedUnknownBarcode, customAttributes: {}, category: "" }));
        setCategoryOption("");
        setIsAddDialogOpen(true);
    };

    useEffect(() => {
        let focusInterval: any;
        if (isHardwareScannerMode && !isAddDialogOpen && !isNotFoundOpen) {
            focusInterval = setInterval(() => {
                const activeElement = document.activeElement;
                const isSearchingSubLoc = activeElement?.getAttribute("cmdk-input") !== null;
                const isUserTyping = (activeElement?.tagName === 'INPUT' && activeElement !== hardwareInputRef.current) || isSearchingSubLoc;

                if (hardwareInputRef.current && activeElement !== hardwareInputRef.current && !isUserTyping) {
                    hardwareInputRef.current.focus();
                }
            }, 300);
        }
        return () => {
            if (focusInterval) clearInterval(focusInterval);
        };
    }, [isHardwareScannerMode, isAddDialogOpen, isNotFoundOpen]);

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
            e.currentTarget.value = "";
        }
    };

    useEffect(() => {
        return () => {
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
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
        onModeChosen?.('hardware');
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
        onModeChosen?.('camera');
        setIsScanning(true);
        setIsHardwareScannerMode(false);
        setIsProcessing(false);
        isProcessingRef.current = false;
        setTimeout(async () => {
            if (html5QrCodeRef.current) {
                try { if (html5QrCodeRef.current.isScanning) await html5QrCodeRef.current.stop(); html5QrCodeRef.current.clear(); } catch (e) { console.warn("Cleanup warning:", e); }
            }
            const html5QrCode = new Html5Qrcode(scannerElementId);
            html5QrCodeRef.current = html5QrCode;
            // Rectangular box suits 1D barcodes; native BarcodeDetector (when the browser has it) is far faster than the JS decoder.
            const config: any = { fps: 20, qrbox: (w: number, h: number) => ({ width: Math.floor(Math.min(w * 0.9, 420)), height: Math.floor(Math.min(h * 0.6, 220)) }), disableFlip: true, experimentalFeatures: { useBarCodeDetectorIfSupported: true }, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39, Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.UPC_A] };
            const startCamera = async (cameraIdOrConfig: string | { facingMode: string }) => { await html5QrCode.start(cameraIdOrConfig, config, (text: string) => onScanSuccessRef.current(text), () => { }); };
            try {
                // Fast path: ask for the rear camera directly (skips device enumeration).
                await startCamera({ facingMode: "environment" });
            } catch (fastError) {
                try {
                    const devices = await Html5Qrcode.getCameras();
                    if (devices && devices.length > 0) {
                        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
                        await startCamera(backCamera ? backCamera.id : devices[0].id);
                    } else { throw fastError; }
                } catch (finalError: any) { setIsScanning(false); toast.error("Camera Failed", { description: "Could not start video stream." }); }
            }
        }, 100);
    };

    const handleStopScanning = async () => {
        try { if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) { await html5QrCodeRef.current.stop(); html5QrCodeRef.current.clear(); } setIsScanning(false); } catch (err) { setIsScanning(false); }
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

    // Remembered choice (picker mode): start straight away, once, without showing the chooser.
    const autoStartedRef = useRef(false);
    useEffect(() => {
        if (!isPickerMode || !preferredMode || autoStartedRef.current) return;
        autoStartedRef.current = true;
        if (preferredMode === 'camera') handleStartScanning();
        else handleStartHardwareScanner();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={className || (isPickerMode ? "" : "flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-6 pb-20")}>
            <style>{`
                #barcode-scanner-element video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                    border-radius: 0.5rem;
                }
            `}</style>

            <div className={isPickerMode ? "" : "order-1 lg:order-1 flex flex-col"}>
                <SyncStatusBanner />

                <Card className="shadow-sm border-space-200">
                    {!isPickerMode && (
                        <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
                            <CardTitle className="flex items-center justify-between text-space-900">
                                <div className="flex items-center gap-2">
                                    <Barcode className="h-5 w-5 text-violet-600" />
                                    <span>Scanner</span>
                                </div>
                                {isScanning && !isProcessing && <span className="text-xs font-normal text-red-500 animate-pulse flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Live</span>}
                                {isProcessing && <span className="text-xs font-normal text-violet-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</span>}
                            </CardTitle>
                        </CardHeader>
                    )}
                    <CardContent className={isPickerMode ? "px-4 pb-4 pt-4 sm:p-6 sm:pt-6" : "p-4 pt-0 sm:p-6 sm:pt-0"}>
                        <div className="space-y-4">
                            {!isPickerMode && (
                                <div className="flex items-center gap-2 mb-2 p-2 bg-space-50 rounded border border-space-200">
                                    <MapPin className="h-4 w-4 text-violet-500" />
                                    <span className="text-sm font-medium text-space-700 truncate">
                                        {locations.find(l => l.id === selectedLocation)?.name || 'Select Assignment...'}
                                    </span>
                                </div>
                            )}

                            {!isPickerMode && (
                                <div className="p-3 bg-violet-50/50 rounded-lg border border-violet-100">
                                    <Label className="text-xs font-semibold text-space-500 uppercase mb-2 block">
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

                                    <Popover open={subLocationSearchOpen} onOpenChange={setSubLocationSearchOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={subLocationSearchOpen}
                                                className="w-full justify-between bg-white text-space-700 font-normal"
                                            >
                                                {selectedSubLocation
                                                    ? selectedSubLocation
                                                    : "Select active sub-location..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] max-w-[calc(100vw-2rem)] p-0">
                                            <Command shouldFilter={false}>
                                                <CommandInput
                                                    placeholder="Search sub-location..."
                                                    value={subLocationSearchQuery}
                                                    onValueChange={setSubLocationSearchQuery}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>No sub-location found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {activeSubLocations.map((sl) => (
                                                            <CommandItem
                                                                key={sl}
                                                                value={sl}
                                                                onSelect={(currentValue) => {
                                                                    setSelectedSubLocation(currentValue);
                                                                    setSubLocationSearchOpen(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        selectedSubLocation === sl ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {sl}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {!selectedSubLocation && <p className="text-xs text-red-500 mt-1 ml-1">* Required to start scanning</p>}
                                </div>
                            )}

                            {isHardwareScannerMode ? (
                                <div>
                                    <div className="w-full aspect-video relative bg-violet-50 rounded-lg overflow-hidden mb-4 flex items-center justify-center border-2 border-violet-200 border-dashed">
                                        <div className="text-center p-4">
                                            <Keyboard className="h-10 w-10 text-violet-500 mx-auto mb-2 animate-bounce" />
                                            <p className="text-violet-900 font-semibold">Hardware Mode</p>
                                            <p className="text-sm text-violet-600">Ready to scan with external device</p>
                                            {scannedBarcode && (
                                                <div className="mt-3 inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-violet-100 shadow-sm">
                                                    <Check className="h-3 w-3 text-green-500" />
                                                    <span className="text-xs font-mono text-space-700">{scannedBarcode}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="destructive" className="w-full h-14 text-[15px] font-bold" onClick={handleStopHardwareScanner}>
                                        <X className="mr-2 h-4 w-4" /> Stop Hardware Scanner
                                    </Button>
                                </div>
                            ) : (
                                <div>
                                    <div
                                        className={`w-full relative rounded-lg overflow-hidden mb-4 border border-space-200 bg-black ${!isScanning ? 'hidden' : 'block'}`}
                                        style={{ minHeight: '250px' }}
                                    >
                                        <div id={scannerElementId} className="w-full h-full" />
                                        {isProcessing && (
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10 pointer-events-none">
                                                <div className="bg-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                                                    <Check className="h-5 w-5 text-green-600" />
                                                    <span className="font-semibold text-space-800">Scanned!</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {!isScanning && (
                                        <div className="w-full aspect-video relative bg-space-100 rounded-lg overflow-hidden mb-4 flex items-center justify-center border border-space-200">
                                            <div className="text-center text-space-400">
                                                <Camera className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">Camera inactive</p>
                                            </div>
                                        </div>
                                    )}

                                    {isScanning ? (
                                        <Button variant="destructive" className="w-full h-14 text-[15px] font-bold" onClick={handleStopScanning}>
                                            <X className="mr-2 h-4 w-4" /> Stop Camera
                                        </Button>
                                    ) : isPickerMode && preferredMode ? (
                                        <div className="space-y-3">
                                            {preferredMode === 'camera' ? (
                                                <Button variant="default" className="w-full h-14 text-[15px] font-bold bg-gradient-primary hover:shadow-glow shadow-glow-sm transition-all" onClick={handleStartScanning}>
                                                    <Scan className="mr-2 h-4 w-4" /> Start Camera
                                                </Button>
                                            ) : (
                                                <Button variant="outline" className="w-full h-14 text-[15px] font-bold border-space-300 text-space-700" onClick={handleStartHardwareScanner}>
                                                    <Keyboard className="mr-2 h-4 w-4" /> Start Hardware Scanner
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button variant="default" className="w-full h-14 text-[15px] font-bold bg-gradient-primary hover:shadow-glow shadow-glow-sm transition-all" onClick={handleStartScanning} disabled={!isPickerMode && (!selectedLocation || !selectedSubLocation)}>
                                                <Scan className="mr-2 h-4 w-4" /> Camera
                                            </Button>
                                            <Button variant="outline" className="w-full h-14 text-[15px] font-bold border-space-300 text-space-700" onClick={handleStartHardwareScanner} disabled={!isPickerMode && (!selectedLocation || !selectedSubLocation)}>
                                                <Keyboard className="mr-2 h-4 w-4" /> Hardware
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {isPickerMode && preferredMode && (
                                <p className="mt-4 text-center text-xs font-medium text-space-500">
                                    Using the {preferredMode === 'camera' ? 'camera' : 'hardware scanner'}. To switch to the {preferredMode === 'camera' ? 'hardware scanner' : 'camera'}, refresh the page.
                                </p>
                            )}

                            {!isPickerMode && (
                                <div className="border-t border-space-100 pt-4">
                                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                                        <Input placeholder="Manual barcode..." value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)} disabled={!selectedLocation} className="h-12 text-[15px] focus:ring-violet-500" />
                                        <Button type="submit" disabled={!selectedLocation || !selectedSubLocation || !manualBarcode.trim()} className="h-12 w-12 shrink-0 bg-gradient-primary hover:shadow-glow shadow-glow-sm transition-all text-white">
                                            <Check className="h-5 w-5" />
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
                <div className="space-y-4 sm:space-y-6 order-2 lg:order-2">
                    {selectedLocation ? (
                        <>
                            <LocationAuditSummary locationId={selectedLocation} hideDropdown={true} />
                            <RecentActivity selectedLocation={selectedLocation} />
                        </>
                    ) : (
                        <Card className="h-full flex items-center justify-center p-6 shadow-sm border-space-200">
                            <div className="text-center text-space-400">
                                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>Please select an active assignment <br /> to start scanning.</p>
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* Workflow Dialogs */}
            <Dialog open={isNotFoundOpen} onOpenChange={setIsNotFoundOpen}>
                <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-[425px] rounded-xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-orange-600">
                            <AlertCircle className="h-5 w-5" />
                            <DialogTitle>Item Not Found</DialogTitle>
                        </div>
                        <DialogDescription className="pt-2 text-space-700">
                            The barcode <span className="font-mono font-bold text-space-900">{scannedUnknownBarcode}</span> was not found in the master data for this location.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-row gap-2 sm:justify-end">
                        <Button variant="outline" onClick={handleDeclineNotFound} className="flex-1 sm:flex-none">
                            Decline
                        </Button>
                        <Button onClick={handleOpenAddForm} className="bg-gradient-primary hover:shadow-glow flex-1 shadow-glow-sm transition-all sm:flex-none">
                            <PackagePlus className="mr-2 h-4 w-4" />
                            Add New Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-[425px] max-h-[85vh] overflow-y-auto rounded-xl">
                    <DialogHeader>
                        <DialogTitle>Add Surplus Item</DialogTitle>
                        <DialogDescription>
                            Found an item missing from the system? Enter its details below.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="scan-sku" className="text-space-500">SKU / Barcode</Label>
                            <Input id="scan-sku" value={newItem.sku} readOnly className="bg-space-50 font-mono" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="scan-name">Item Name</Label>
                            <Input
                                id="scan-name"
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                placeholder="e.g. Wireless Mouse"
                                autoFocus
                            />
                        </div>

                        {/* 🔥 FIX: Category Dropdown implementation */}
                        <div className="grid gap-2">
                            <Label htmlFor="scan-cat">Category</Label>
                            <Select
                                value={categoryOption}
                                onValueChange={(val) => {
                                    setCategoryOption(val);
                                    if (val !== 'Other') {
                                        setNewItem({ ...newItem, category: val });
                                    } else {
                                        setNewItem({ ...newItem, category: "" }); // clear for custom input
                                    }
                                }}
                            >
                                <SelectTrigger id="scan-cat" className="bg-white">
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {uniqueCategories.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                    <SelectItem value="Other">Other (Custom)</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Shows text input only when "Other" is selected */}
                            {categoryOption === 'Other' && (
                                <Input
                                    placeholder="Enter custom category..."
                                    value={newItem.category}
                                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                    className="mt-1"
                                    autoFocus
                                />
                            )}
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

                        {/* Dynamic Fields from Master Data + Rate Field */}
                        {dynamicColumns.map(col => (
                            <div className="grid gap-2" key={col}>
                                <Label htmlFor={`scan-custom-${col}`} className="capitalize text-space-700">
                                    {col === 'unit_price' ? 'Rate / Unit Price' : col.replace(/_/g, ' ')}
                                </Label>
                                <Input
                                    id={`scan-custom-${col}`}
                                    type={col === 'unit_price' ? 'number' : 'text'}
                                    step={col === 'unit_price' ? '0.01' : undefined}
                                    value={newItem.customAttributes[col] || ""}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setNewItem({
                                            ...newItem,
                                            customAttributes: {
                                                ...newItem.customAttributes,
                                                [col]: col === 'unit_price' ? (val ? parseFloat(val) : "") : val
                                            }
                                        });
                                    }}
                                    placeholder={col === 'unit_price' ? '0.00' : `e.g. ${col}`}
                                />
                            </div>
                        ))}

                        <div className="bg-violet-50 p-3 rounded-md border border-violet-100 text-xs text-violet-800">
                            <strong>Note:</strong> System Quantity will be 0.
                            This item will be recorded at <strong>{selectedSubLocation}</strong>.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); handleDeclineNotFound(); }}>Cancel</Button>
                        <Button onClick={handleAddSurplus} disabled={!newItem.name || (categoryOption === 'Other' && !newItem.category)} className="bg-gradient-primary hover:shadow-glow shadow-glow-sm transition-all">
                            Save Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};