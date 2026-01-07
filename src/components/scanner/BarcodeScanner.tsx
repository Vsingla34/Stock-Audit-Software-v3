import React, { useState, useRef, useEffect } from "react";
import { useInventory, InventoryItem } from "@/context/InventoryContext"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Barcode, Scan, Check, MapPin, Keyboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useUser } from "@/context/UserContext"; 
import { useUserAccess } from "@/hooks/useUserAccess";
import { LocationAuditSummary } from "@/components/locations/LocationAuditSummary";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { useCompany } from "@/context/CompanyContext";

export const BarcodeScanner = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [isHardwareScannerMode, setIsHardwareScannerMode] = useState(false);
    const [manualBarcode, setManualBarcode] = useState("");
    const [scannedBarcode, setScannedBarcode] = useState(""); 
    const [debugInfo, setDebugInfo] = useState("");
    
    const { itemMaster, auditedItems, updateAuditedItem, locations, assignments } = useInventory();
    const { accessibleLocations } = useUserAccess();
    const { currentUser } = useUser();
    const { selectedAssignmentId } = useCompany();

    // AUTO-DETECT LOCATION FROM ASSIGNMENT
    const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
    const selectedLocation = currentAssignment?.locationId || "";
    
    const html5QrCodeRef = useRef(null);
    const hardwareScannerInputRef = useRef(null);
    const scannerElementId = "barcode-scanner-element";

    const scannedBufferRef = useRef('');
    const lastKeypressTime = useRef(0);

    // Handle item scanning with auditor tracking
    const handleItemScan = async (barcode, locationId) => {
        console.log("=== handleItemScan called ===");
        
        if (typeof updateAuditedItem !== 'function') {
            console.error("updateAuditedItem is not available.");
            return false;
        }

        try {
            let locationName = '';
            
            if (!locationId || locationId === "") {
                 toast.error("Location Required", { description: "No active assignment location found." });
                 return false; 
            }
            
            const locationObj = locations.find(loc => loc.id === locationId);
            locationName = locationObj?.name || '';
            
            if (locationName === '') {
                 toast.error("Invalid Location", { description: "Location name mismatch." });
                 return false;
            }
            
            // 1. Find the Master Item (Global Definition)
            const masterItem = itemMaster.find(item => 
                (item.sku === barcode) && item.location === locationName
            );
            
            if (!masterItem) {
                const itemInOtherLocation = itemMaster.find(item => item.sku === barcode);
                if (itemInOtherLocation) {
                    toast.error("Item not found at this location", {
                        description: `Item ${barcode} exists at ${itemInOtherLocation.location}, but not at ${locationName}.`,
                    });
                } else {
                    toast.error("Item not found", {
                        description: `No item found with barcode ${barcode} in master data.`,
                    });
                }
                return false;
            }

            // 2. Find Existing Audit Entry for this Assignment
            // FIX: Match by SKU/Location instead of ID, because ID changes when forked to assignment
            const existingAuditedItem = auditedItems.find(
                item => item.sku === masterItem.sku && item.location === locationName
            );

            // Use the existing entry's ID if available, otherwise fallback to Master (InventoryContext will handle the fork)
            const targetItem = existingAuditedItem || masterItem;

            const existingAuditorEntries = targetItem.auditorEntries || [];
            const currentAuditorEntry = existingAuditorEntries.find(
                entry => entry.auditorId === currentUser?.id
            );
            
            const currentAuditorQuantity = currentAuditorEntry?.quantityFound || 0;
            const newAuditorQuantity = currentAuditorQuantity + 1;

            const itemToUpdate = {
                ...targetItem, // Preserve all props including correct ID if it exists
                physicalQuantity: newAuditorQuantity, 
                status: 'pending' as const,
                lastAudited: new Date().toISOString(),
                notes: targetItem.notes || masterItem.notes,
            };

            await updateAuditedItem(
                itemToUpdate,
                currentUser?.id,
                currentUser?.email || currentUser?.name || 'Unknown Auditor'
            );

            // Calculate display totals
            const totalPhysicalQuantity = (targetItem.physicalQuantity || 0) + 1; // Approximate immediate update
            const quantityInfo = currentAuditorQuantity > 0 
                ? `Your count: ${currentAuditorQuantity} → ${newAuditorQuantity} (Total: ${totalPhysicalQuantity}/${masterItem.systemQuantity})`
                : `Your count: ${newAuditorQuantity} (Total: ${totalPhysicalQuantity}/${masterItem.systemQuantity})`;

            const status = totalPhysicalQuantity === masterItem.systemQuantity ? 'matched' : 'discrepancy';

            if (status === "matched") {
                toast.success("Item scanned - Matched!", {
                    description: `${masterItem.name} ${quantityInfo} at ${locationName}`,
                });
            } else {
                toast.warning("Item scanned - Discrepancy detected!", {
                    description: `${masterItem.name} ${quantityInfo} at ${locationName}`,
                });
            }

            return true;
        } catch (error: any) {
            console.error("Scanning failed:", error);
            toast.error("Scanning Error", { description: error.message });
            return false;
        }
    };

    // Hardware scanner logic
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!isHardwareScannerMode || !selectedLocation) {
                return;
            }

            const currentTime = Date.now();
            const timeSinceLastKey = currentTime - lastKeypressTime.current;
            lastKeypressTime.current = currentTime;

            if (timeSinceLastKey > 100) {
                scannedBufferRef.current = '';
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                
                const barcode = scannedBufferRef.current.trim();
                
                if (barcode) {
                    handleItemScan(barcode, selectedLocation)
                        .then(success => {
                            if (success) {
                                setScannedBarcode(barcode);
                            }
                        })
                        .catch(e => console.error("Hardware scan error:", e));
                } else {
                    console.warn("Empty buffer on Enter");
                    toast.error("Empty scan", {
                        description: "No barcode data received"
                    });
                }
                
                scannedBufferRef.current = '';
                return;
            }

            if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                scannedBufferRef.current += event.key;
            }
        };

        if (isHardwareScannerMode) {
            document.addEventListener('keydown', handleKeyDown, true);
            
            const focusInterval = setInterval(() => {
                if (hardwareScannerInputRef.current && document.activeElement !== hardwareScannerInputRef.current) {
                    hardwareScannerInputRef.current.focus();
                }
            }, 100);

            return () => {
                document.removeEventListener('keydown', handleKeyDown, true);
                clearInterval(focusInterval);
            };
        }
    }, [isHardwareScannerMode, selectedLocation, itemMaster, auditedItems, locations, currentUser]);

    useEffect(() => {
        if (isHardwareScannerMode && scannedBufferRef.current) {
            const timeout = setTimeout(() => {
                if (scannedBufferRef.current) {
                    scannedBufferRef.current = '';
                }
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [scannedBarcode, isHardwareScannerMode]);

    useEffect(() => {
        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(console.error);
            }
        };
    }, []);

    const onScanSuccess = (decodedText, decodedResult) => {
        handleItemScan(decodedText, selectedLocation)
            .then(success => {
                if (success) {
                    setScannedBarcode(decodedText);
                }
            })
            .catch(e => console.error("Camera scan error:", e));
    };

    const onScanError = (errorMessage) => {
        // Suppress frequent scan errors
    };

    const handleStartHardwareScanner = () => {
        if (!selectedLocation) {
            toast.error("Location required", {
                description: "No active assignment location found."
            });
            return;
        }
        
        setIsHardwareScannerMode(true);
        scannedBufferRef.current = '';
        lastKeypressTime.current = 0;
        
        toast.success("Hardware scanner activated", {
            description: `Scanning as ${currentUser?.email || currentUser?.name}. Press ESC to stop.`
        });
        
        setTimeout(() => {
            (document.activeElement)?.blur();
            hardwareScannerInputRef.current?.focus();
        }, 100);
    };

    const handleStopHardwareScanner = () => {
        setIsHardwareScannerMode(false);
        scannedBufferRef.current = '';
        setDebugInfo('');
        toast.info("Hardware scanner stopped");
    };

    const handleStartScanning = async () => {
        if (!selectedLocation) {
            toast.error("Location required", {
                description: "No active assignment location found."
            });
            return;
        }

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 }, 
            aspectRatio: 1.777778, 
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
            ]
        };

        try {
            html5QrCodeRef.current = new Html5Qrcode(scannerElementId);

            await html5QrCodeRef.current.start(
                { facingMode: "environment" },
                config,
                onScanSuccess,
                onScanError
            );

            setIsScanning(true);
            toast.success("Camera scanner started", {
                description: `Scanning as ${currentUser?.email || currentUser?.name}`
            });

        } catch (err) {
            console.error("Error starting scanner:", err);
            
            try {
                if (!html5QrCodeRef.current) {
                    html5QrCodeRef.current = new Html5Qrcode(scannerElementId);
                }
                
                await html5QrCodeRef.current.start(
                    { facingMode: "user" },
                    config,
                    onScanSuccess,
                    onScanError
                );
                setIsScanning(true);
                toast.success("Camera scanner started", {
                    description: "Using front camera"
                });
            } catch (fallbackErr) {
                toast.error("Camera not available", {
                    description: "Try using hardware scanner mode or manual entry instead."
                });
                html5QrCodeRef.current = null;
            }
        }
    };

    const handleStopScanning = async () => {
        try {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
            }
            setIsScanning(false);
            toast.info("Camera scanner stopped");
        } catch (err) {
            console.error("Error stopping scanner:", err);
            setIsScanning(false);
        }
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!selectedLocation) {
            toast.error("Location required", {
                description: "No active assignment location found."
            });
            return;
        }
        
        if (manualBarcode.trim()) {
            handleItemScan(manualBarcode.trim(), selectedLocation)
                .then(success => {
                    if (success) {
                        setScannedBarcode(manualBarcode.trim());
                        setManualBarcode("");
                    }
                })
                .catch(e => console.error("Manual submit error:", e));
        }
    };

    useEffect(() => {
        const handleEscKey = (event) => {
            if (event.key === 'Escape' && isHardwareScannerMode) {
                handleStopHardwareScanner();
            }
        };

        window.addEventListener('keydown', handleEscKey);
        return () => {
            window.removeEventListener('keydown', handleEscKey);
        };
    }, [isHardwareScannerMode]);

    return (
        <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900">
                        <Barcode className="h-5 w-5" />
                        <span>Barcode Scanner</span>
                        {currentUser && (
                            <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full ml-2">
                                {currentUser.email || currentUser.name}
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                            <MapPin className="h-4 w-4 text-indigo-500" />
                            <span className="text-sm font-medium text-gray-700">
                                Location: {locations.find(l => l.id === selectedLocation)?.name || 'Loading...'}
                            </span>
                        </div>
                        
                        {isHardwareScannerMode ? (
                            <div>
                                <div className="w-full aspect-video relative bg-indigo-50 rounded-lg overflow-hidden mb-4 flex items-center justify-center border-2 border-indigo-200 border-dashed">
                                    <div className="text-center">
                                        <Keyboard className="h-12 w-12 text-indigo-500 mx-auto mb-2 animate-pulse" />
                                        <p className="text-indigo-700 font-medium">Hardware Scanner Active</p>
                                        <p className="text-sm text-indigo-600">Auditor: {currentUser?.email || currentUser?.name}</p>
                                        {scannedBarcode && (
                                            <p className="text-xs text-indigo-500 mt-2 font-mono bg-indigo-100 px-2 py-1 rounded">
                                                Last: {scannedBarcode}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Button 
                                    variant="destructive" 
                                    className="w-full" 
                                    onClick={handleStopHardwareScanner}
                                >
                                    Stop Hardware Scanner (ESC)
                                </Button>
                            </div>
                        ) : isScanning ? (
                            <div>
                                <div className="w-full aspect-video relative rounded-lg overflow-hidden mb-4 border border-gray-200">
                                    <div id={scannerElementId} className="w-full h-full" />
                                </div>
                                <Button 
                                    variant="destructive" 
                                    className="w-full" 
                                    onClick={handleStopScanning}
                                >
                                    Stop Camera Scanning
                                </Button>
                            </div>
                        ) : (
                            <div>
                                <div className="w-full aspect-video relative bg-gray-100 rounded-lg overflow-hidden mb-4 flex items-center justify-center border border-gray-200">
                                    <p className="text-center text-gray-500">
                                        Camera preview will appear here when scanning
                                    </p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <Button 
                                        variant="default" 
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" 
                                        onClick={handleStartScanning}
                                        disabled={!selectedLocation}
                                    >
                                        <Scan className="mr-2 h-4 w-4" />
                                        Camera Scan
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        className="w-full bg-white hover:bg-indigo-50 border border-gray-200 text-gray-700 hover:text-indigo-700 shadow-sm" 
                                        onClick={handleStartHardwareScanner}
                                        disabled={!selectedLocation}
                                    >
                                        <Keyboard className="mr-2 h-4 w-4" />
                                        Hardware Scan
                                    </Button>
                                </div>
                            </div>
                        )}
                        
                        <div className="border-t border-gray-100 pt-4">
                            <form onSubmit={handleManualSubmit} className="flex gap-2">
                                <Input
                                    placeholder="Enter barcode manually"
                                    value={manualBarcode}
                                    onChange={(e) => setManualBarcode(e.target.value)}
                                    disabled={!selectedLocation}
                                    className="focus:ring-indigo-600 focus:border-indigo-600"
                                />
                                <Button 
                                    type="submit" 
                                    disabled={!selectedLocation || !manualBarcode.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    <Check className="h-4 w-4" />
                                </Button>
                            </form>
                        </div>
                        
                        <input
                            ref={hardwareScannerInputRef}
                            type="text"
                            style={{ 
                                position: 'absolute', 
                                left: '-9999px', 
                                opacity: 0,
                                width: '1px',
                                height: '1px'
                            }}
                            tabIndex={-1}
                            autoComplete="off"
                            aria-hidden="true"
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                {selectedLocation ? (
                    <>
                        <LocationAuditSummary 
                            locationId={selectedLocation} 
                            hideDropdown={true} 
                        />
                        <RecentActivity selectedLocation={selectedLocation} />
                    </>
                ) : (
                    <Card className="h-full flex items-center justify-center p-6 shadow-sm border-gray-200">
                        <div className="text-center text-gray-400">
                            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Loading active assignment...</p>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};