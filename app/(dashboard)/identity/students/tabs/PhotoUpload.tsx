"use client";
import { useState, useRef } from "react";
import { Camera, Loader2, CheckCircle2, AlertCircle, X, Eye, Trash2, User } from "lucide-react";
import api from "@/lib/api";

interface PhotoUploadProps {
  cc?: number; // For student
  guardianId?: number; // For guardian
  employeeId?: number; // For employee
  type?: "standard" | "blue_bg"; // For student subtypes
  currentUrl?: string | null;
  label: string;
  onSuccess: (url: string) => void;
}

export function PhotoUpload({ cc, guardianId, employeeId, type, currentUrl, label, onSuccess }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      } else if (employeeId) {
        endpoint = `/v1/media/employee/${employeeId}/photo`;
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

  const handleRemove = async () => {
    setDeleting(true);
    setError(null);

    try {
      let endpoint = "";
      if (cc) {
        endpoint = `/v1/media/student/${cc}/photo/${type || "standard"}`;
      } else if (guardianId) {
        endpoint = `/v1/media/guardian/${guardianId}/photo`;
      } else if (employeeId) {
        endpoint = `/v1/media/employee/${employeeId}/photo`;
      }

      if (endpoint) {
        try {
          await api.delete(endpoint);
        } catch (delErr: any) {
          // If DELETE endpoint is not yet deployed on backend (e.g. 404/405), fallback to patch
          if (cc) {
            const field = type === "blue_bg" ? "photo_blue_bg_url" : "photograph_url";
            await api.patch(`/v1/staff-editing/students/${cc}`, { [field]: null });
          } else if (guardianId) {
            await api.patch(`/v1/staff-editing/guardians/${guardianId}`, { photo_url: null });
          } else {
            throw delErr;
          }
        }
      }
      onSuccess("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to remove photo");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</label>
      <div className="relative group w-24 h-32 bg-zinc-100 dark:bg-zinc-900 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-primary/50">
        {currentUrl ? (
          <>
            <img 
              src={currentUrl.replace(/([^:])\/\//g, '$1/')} 
              alt={label} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
              <button 
                type="button"
                onClick={() => setIsViewerOpen(true)}
                className="p-1.5 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 hover:scale-105 active:scale-95 transition-all shadow-md"
                title="View Full"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 hover:scale-105 active:scale-95 transition-all shadow-md"
                title="Change Photo"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <button 
                type="button"
                onClick={handleRemove}
                className="p-1.5 bg-rose-500/80 backdrop-blur-md rounded-full text-white hover:bg-rose-600 hover:scale-105 active:scale-95 transition-all shadow-md"
                title="Remove Photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center text-zinc-400 hover:text-primary transition-colors bg-zinc-100 dark:bg-zinc-800/40 group/btn relative p-2"
            title="Click to upload photograph"
          >
            <div className="relative flex flex-col items-center justify-center">
              <User className="h-14 w-14 text-zinc-300 dark:text-zinc-600 group-hover/btn:text-zinc-400 transition-colors" />
              <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-1 rounded-full text-zinc-500 shadow-xs">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </div>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mt-2">Upload Photo</span>
          </button>
        )}

        {/* Status Overlays */}
        {(uploading || deleting) && (
          <div className="absolute inset-0 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-[2px] flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute bottom-0 inset-x-0 bg-red-500 text-white text-[8px] p-1 flex items-center gap-1 z-20">
            <AlertCircle className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-0.5"><X className="h-2.5 w-2.5" /></button>
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

