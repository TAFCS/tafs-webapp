"use client";
import { useState, useRef } from "react";
import { Camera, Loader2, CheckCircle2, AlertCircle, X, Eye } from "lucide-react";
import api from "@/lib/api";

interface PhotoUploadProps {
  cc?: number; // For student
  guardianId?: number; // For guardian
  type?: "standard" | "blue_bg"; // For student subtypes
  currentUrl?: string;
  label: string;
  onSuccess: (url: string) => void;
}

export function PhotoUpload({ cc, guardianId, type, currentUrl, label, onSuccess }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPG/PNG)");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      let endpoint = "";
      if (cc) {
        endpoint = `/v1/media/student/${cc}/photo/${type || "standard"}`;
      } else if (guardianId) {
        endpoint = `/v1/media/guardian/${guardianId}/photo`;
      }

      const res = await api.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      onSuccess(res.data.url);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</label>
      <div className="relative group w-24 h-32 bg-zinc-100 rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-primary/50">
        {currentUrl ? (
          <>
            <img 
              src={currentUrl.replace(/([^:])\/\//g, '$1/')} 
              alt={label} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button 
                type="button"
                onClick={() => setIsViewerOpen(true)}
                className="p-1.5 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 hover:scale-105 active:scale-95 transition-all shadow-md"
                title="View Full"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 hover:scale-105 active:scale-95 transition-all shadow-md"
                title="Upload Photo"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1 text-zinc-400 hover:text-primary transition-colors"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            <span className="text-[10px] font-bold uppercase">Upload</span>
          </button>
        )}

        {/* Status Overlays */}
        {uploading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute bottom-0 inset-x-0 bg-red-500 text-white text-[8px] p-1 flex items-center gap-1">
            <AlertCircle className="h-2 w-2" />
            <span className="truncate">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X className="h-2 w-2" /></button>
          </div>
        )}
      </div>

      <input 
        ref={fileInputRef}
        type="file" 
        className="hidden" 
        accept="image/*"
        onChange={handleUpload}
      />

      {isViewerOpen && currentUrl && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out" onClick={() => setIsViewerOpen(false)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setIsViewerOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl transition-all border border-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
            <img 
              src={currentUrl.replace(/([^:])\/\//g, '$1/')} 
              alt={label} 
              className="max-w-full max-h-[85vh] object-contain rounded-xl cursor-default"
            />
          </div>
        </div>
      )}
    </div>
  );
}
