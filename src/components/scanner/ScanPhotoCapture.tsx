// src/components/scanner/ScanPhotoCapture.tsx
// Fix 4.9 — Photo evidence at point of scan
// Add <ScanPhotoCapture /> after a successful scan to let auditors
// attach an optional photo to that item entry.

import { useRef, useState } from "react";
import { Camera, Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { toast } from "sonner";

interface ScanPhotoCaptureProps {
  itemId: string;
  itemName: string;
  /** Called when a photo has been successfully uploaded */
  onUploaded?: (url: string) => void;
  /** Called when the user dismisses without taking a photo */
  onSkip?: () => void;
}

const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const ScanPhotoCapture = ({
  itemId,
  itemName,
  onUploaded,
  onSkip,
}: ScanPhotoCaptureProps) => {
  const { selectedCompanyId, selectedAssignmentId } = useCompany();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPG, PNG or WEBP photos are accepted.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Photo must be under ${MAX_SIZE_MB} MB.`);
      return;
    }

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      // Path: <companyId>/<assignmentId>/<itemId>/<timestamp>.<ext>
      const ext = file.name.split(".").pop() || "jpg";
      const path = [
        selectedCompanyId,
        selectedAssignmentId || "global",
        itemId,
        `${Date.now()}.${ext}`,
      ].join("/");

      const { error: uploadErr } = await supabase.storage
        .from("audit-attachments")
        .upload(path, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      // Signed URL (bucket is private since Phase 1.6)
      const { data: signedData, error: signErr } = await supabase.storage
        .from("audit-attachments")
        .createSignedUrl(path, 60 * 60);

      if (signErr) throw signErr;

      setUploaded(true);
      toast.success("Photo attached successfully.");
      onUploaded?.(signedData.signedUrl);
    } catch (err: any) {
      console.error("Photo upload failed:", err);
      toast.error("Photo upload failed: " + (err.message || "Unknown error"));
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
      <p className="text-xs font-medium text-indigo-800 mb-2 truncate">
        📸 Attach photo for <span className="font-semibold">{itemName}</span>?
      </p>

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Evidence"
            className="w-full h-32 object-cover rounded-md border border-indigo-200"
          />
          {uploading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-md">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          )}
          {uploaded && (
            <div className="absolute top-1.5 right-1.5 bg-green-500 text-white rounded-full p-0.5">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4" />
            Take Photo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-400 hover:text-gray-600 px-2"
            onClick={onSkip}
            title="Skip"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Hidden file input — uses device camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"   // rear camera on mobile
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};