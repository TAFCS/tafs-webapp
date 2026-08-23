"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface VideoDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
}

export function VideoDemoModal({ isOpen, onClose, videoUrl, title = "Demo" }: VideoDemoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      videoRef.current?.pause();
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl transition-all border border-zinc-800"
            aria-label="Close demo video"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          className="w-full max-h-[80vh] bg-black"
        />
      </div>
    </div>
  );
}
