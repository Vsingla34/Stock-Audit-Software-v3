import React, { useState, useRef, useEffect } from "react";
import { useInventory, InventoryItem } from "@/context/InventoryContext"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Barcode, Scan, Check, MapPin, Keyboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useUser } from "@/context/UserContext"; 
import { useUserAccess } from "@/hooks/useUserAccess";
import { LocationAuditSummary } from "@/components/locations/LocationAuditSummary";
import { RecentActivity } from "@/components/dashboard/RecentActivity"; // ✅ Import RecentActivity

export const BarcodeScanner = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [isHardwareScannerMode, setIsHardwareScannerMode] = useState(false);
    const [manualBarcode, setManualBarcode] = useState("");
    const [selectedLocation, setSelectedLocation] = useState(""); 
    const [scannedBarcode, setScannedBarcode] = useState(""); 
    const [debugInfo, setDebugInfo] = useState("");
    
    const { itemMaster, auditedItems, updateAuditedItem, locations } = useInventory();
    const { accessibleLocations } = useUserAccess();
    const { currentUser } = useUser();
    const userAccessibleLocations = accessibleLocations();
    
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const hardwareScannerInputRef = useRef<HTMLInputElement>(null);
    const scannerElementId = "barcode-scanner-element";

    const scannedBufferRef = useRef('');
    const lastKeypressTime = useRef(0);

    // Handle item scanning with auditor tracking
    const handleItemScan = async (barcode: string, locationId: string): Promise<boolean> => {
        console.log("=== handleItemScan called ===");
        console.log("Barcode:", barcode);
        console.log("Location ID:", locationId);
        
        if (typeof updateAuditedItem !== 'function') {
            console.error("updateAuditedItem is not available in InventoryContext.");
            toast.error("System Error", {
                description: "Inventory update function missing.",
            });
            return false;
        }

        try {
            let locationName = '';
            
            if (!locationId || locationId === "") {
                 toast.error("Location Required", {
                   description: "Please select a location from the dropdown before scanning.",
                 });
                 return false; 
            }
            
            const locationObj = locations.find(loc => loc.id === locationId);
            locationName = locationObj?.name || '';
            
            if (locationName === '') {
                 toast.error("Invalid Location", {
                   description: "The selected location ID could not be matched to a location name.",
                 });
                 return false;
            }
            
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

            const existingAuditedItem = auditedItems.find(
                item => item.id === masterItem.id && item.location === locationName
            );

            const existingAuditorEntries = existingAuditedItem?.auditorEntries || [];
            const currentAuditorEntry = existingAuditorEntries.find(
                entry => entry.auditorId === currentUser?.id
            );
            
            const currentAuditorQuantity = currentAuditorEntry?.quantityFound || 0;
            const newAuditorQuantity = currentAuditorQuantity + 1;

            const itemToUpdate: InventoryItem = {
                id: masterItem.id,
                sku: masterItem.sku,
                name: masterItem.name,
                category: masterItem.category,
                location: locationName, 
                systemQuantity: masterItem.systemQuantity,
                physicalQuantity: newAuditorQuantity, 
                status: 'pending',
                lastAudited: new Date().toISOString(),
                notes: existingAuditedItem?.notes || masterItem.notes,
            };

            await updateAuditedItem(
                itemToUpdate,
                currentUser?.id,
                currentUser?.email || currentUser?.name || 'Unknown Auditor'
            );

            const updatedItem = itemMaster.find(i => i.id === masterItem.id && i.location === locationName);
            const totalPhysicalQuantity = updatedItem?.physicalQuantity || newAuditorQuantity;

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
            console.error("Scanning failed due to unhandled error:", error);
            toast.error("Scanning Error", {
                description: error.message || "Failed to process the scanned item",
            });
            return false;
        }
    };

    // Hardware scanner logic
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
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

    const onScanSuccess = (decodedText: string, decodedResult: any) => {
        handleItemScan(decodedText, selectedLocation)
            .then(success => {
                if (success) {
                    setScannedBarcode(decodedText);
                }
            })
            .catch(e => console.error("Camera scan error:", e));
    };

    const onScanError = (errorMessage: string) => {
        // Suppress frequent scan errors
    };

    const handleStartHardwareScanner = () => {
        if (!selectedLocation) {
            toast.error("Location required", {
                description: "Please select a specific location before scanning."
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
            (document.activeElement as HTMLElement)?.blur();
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
                description: "Please select a specific location before scanning."
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

        } catch (err: any) {
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
            } catch (fallbackErr: any) {
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

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLocation) {
            toast.error("Location required", {
                description: "Please select a location before submitting."
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
        const handleEscKey = (event: KeyboardEvent) => {
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
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Barcode className="h-5 w-5" />
                        <span>Barcode Scanner</span>
                        {currentUser && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">
                                {currentUser.email || currentUser.name}
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {currentUser?.role === "super_admin" || currentUser?.role === "admin" ? (
                                    <>
                                        {locations.map((location) => (
                                            <SelectItem key={location.id} value={location.id}>
                                                {location.name}
                                            </SelectItem>
                                        ))}
                                    </>
                                    ) : (
                                    userAccessibleLocations.length > 0 ? (
                                        userAccessibleLocations.map((location) => (
                                            <SelectItem key={location.id} value={location.id}>
                                                {location.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="no-locations" disabled>
                                            No assigned locations
                                        </SelectItem>
                                    )
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {selectedLocation && (
                            <div className="text-sm text-muted-foreground bg-gray-50 p-2 rounded">
                                <strong>Selected:</strong> {locations.find(l => l.id === selectedLocation)?.name || 'Error'}
                            </div>
                        )}
                        
                        {isHardwareScannerMode ? (
                            <div>
                                <div className="w-full aspect-video relative bg-blue-50 rounded-lg overflow-hidden mb-4 flex items-center justify-center border-2 border-blue-200 border-dashed">
                                    <div className="text-center">
                                        <Keyboard className="h-12 w-12 text-blue-500 mx-auto mb-2 animate-pulse" />
                                        <p className="text-blue-700 font-medium">Hardware Scanner Active</p>
                                        <p className="text-sm text-blue-600">Auditor: {currentUser?.email || currentUser?.name}</p>
                                        {scannedBarcode && (
                                            <p className="text-xs text-blue-500 mt-2 font-mono bg-blue-100 px-2 py-1 rounded">
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
                                <div className="w-full aspect-video relative rounded-lg overflow-hidden mb-4 border">
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
                                <div className="w-full aspect-video relative bg-gray-100 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
                                    <p className="text-center text-muted-foreground">
                                        Camera preview will appear here when scanning
                                    </p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <Button 
                                        variant="default" 
                                        className="w-full" 
                                        onClick={handleStartScanning}
                                        disabled={!selectedLocation}
                                    >
                                        <Scan className="mr-2 h-4 w-4" />
                                        Camera Scan
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        className="w-full" 
                                        onClick={handleStartHardwareScanner}
                                        disabled={!selectedLocation}
                                    >
                                        <Keyboard className="mr-2 h-4 w-4" />
                                        Hardware Scan
                                    </Button>
                                </div>
                            </div>
                        )}
                        
                        <div className="border-t pt-4">
                            <form onSubmit={handleManualSubmit} className="flex gap-2">
                                <Input
                                    placeholder="Enter barcode manually"
                                    value={manualBarcode}
                                    onChange={(e) => setManualBarcode(e.target.value)}
                                    disabled={!selectedLocation}
                                />
                                <Button type="submit" disabled={!selectedLocation || !manualBarcode.trim()}>
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

            {/* Right Column: Summary + Recent Activity */}
            <div className="space-y-6">
                {selectedLocation ? (
                    <>
                        {/* 1. Stats Dashboard */}
                        <LocationAuditSummary 
                            locationId={selectedLocation} 
                            hideDropdown={true} 
                        />
                        
                        {/* 2. Activity Feed (Recent Scans) */}
                        <RecentActivity selectedLocation={selectedLocation} />
                    </>
                ) : (
                    <Card className="h-full flex items-center justify-center p-6">
                        <div className="text-center text-muted-foreground">
                            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Select a location from the dropdown on the left to view audit summary.</p>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};