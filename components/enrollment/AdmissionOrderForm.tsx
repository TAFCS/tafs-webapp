'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { AdmissionOrderPDF } from './AdmissionOrderPDF';

interface Student {
  cc: number;
  gr_number?: string;
  reg_number?: string;
  link_gr_number?: string;
  full_name: string;
  dob?: string;
  gender?: string;
  doa?: string;
  scholastic_year?: string;
  academic_year?: string;
  campus_name?: string;
  class_name?: string;
  section_name?: string;
  segment_head?: string;
  address?: string;
  home_phone?: string;
  father_name?: string;
  father_cell?: string;
  mother_cell?: string;
  nearest_relationship?: string;
  nearest_name?: string;
  nearest_phone?: string;
  email?: string;
  fax?: string;
  day?: string;
  date?: string;
  photograph_url?: string | null;
}

/** Fetch a URL and return it as a base64 data URI */
async function toBase64DataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function RemarksField({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [localValue, setLocalValue] = useState(value);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
      <textarea
        value={localValue}
        onChange={(e) => { setLocalValue(e.target.value); onChange(e.target.value); }}
        rows={4}
        placeholder="Enter any additional remarks..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

interface AdmissionOrderFormProps {
  student: Student;
}

export default function AdmissionOrderForm({ student }: AdmissionOrderFormProps) {
  const [remarks, setRemarks] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isPreparingAssets, setIsPreparingAssets] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Pre-fetch all images as base64 on mount
  useEffect(() => {
    let cancelled = false;
    setIsPreparingAssets(true);

    const prepare = async () => {
      console.log(`[AdmissionOrder] Starting asset preparation for CC: ${student.cc}`);
      
      // 1. Fetch logo from public dir
      const logo = await toBase64DataUrl('/logo.png');
      if (!cancelled) {
        console.log(`[AdmissionOrder] Logo fetched: ${!!logo}`);
        setLogoBase64(logo);
      }

      // 2. Fetch student photo via same-origin Next.js proxy to bypass CORS
      if (student.photograph_url) {
        const origin = window.location.origin;
        const proxyUrl = `${origin}/api/photo-proxy?url=${encodeURIComponent(student.photograph_url)}`;
        console.log(`[AdmissionOrder] Fetching student photo via proxy: ${proxyUrl}`);
        
        const photo = await toBase64DataUrl(proxyUrl);
        if (!cancelled) {
          if (photo) {
            console.log(`[AdmissionOrder] Photo fetched and converted successfully. Length: ${photo.length}`);
            setPhotoBase64(photo);
          } else {
            console.warn(`[AdmissionOrder] Photo fetch/conversion failed. Fallback to direct proxy URL display.`);
          }
        }
      } else {
        console.log(`[AdmissionOrder] No photograph_url found for student.`);
      }

      if (!cancelled) setIsPreparingAssets(false);
    };

    prepare();
    return () => { cancelled = true; };
  }, [student.cc, student.photograph_url]);

  const handleDownload = useCallback(async () => {
    setIsGenerating(true);
    try {
      const doc = (
        <AdmissionOrderPDF data={{
          cc: student.cc,
          gr_number: student.gr_number,
          reg_number: student.reg_number,
          link_gr_number: student.link_gr_number,
          full_name: student.full_name,
          father_name: student.father_name,
          dob: student.dob,
          gender: student.gender,
          doa: student.doa,
          academic_year: student.academic_year,
          campus_name: student.campus_name,
          class_name: student.class_name,
          section_name: student.section_name,
          remarks: remarks,
          address: student.address,
          home_phone: student.home_phone,
          fax: student.fax,
          father_cell: student.father_cell,
          mother_cell: student.mother_cell,
          nearest_phone: student.nearest_phone,
          nearest_name: student.nearest_name,
          relationship: student.nearest_relationship,
          email: student.email,
          day: student.day,
          date: student.date,
          photograph_url: photoBase64,
          logo_url: logoBase64,
        }} />
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admission-order-${student.cc}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [student, remarks, photoBase64, logoBase64]);

  // Fallback URL for UI display if Base64 conversion is still in progress or failed
  const getDisplayPhoto = () => {
    if (photoBase64) return photoBase64;
    if (student.photograph_url) {
        return `${window.location.origin}/api/photo-proxy?url=${encodeURIComponent(student.photograph_url)}`;
    }
    return null;
  };

  const displayPhoto = getDisplayPhoto();

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Student Photo */}
            <div className="relative group">
              {displayPhoto ? (
                <img 
                    src={displayPhoto} 
                    alt={student.full_name} 
                    className="w-20 h-24 object-cover rounded-lg border-2 border-white/50 shadow-lg ring-4 ring-white/10"
                    onLoad={() => console.log(`[AdmissionOrder] UI Photo rendered successfully`)}
                    onError={() => console.error(`[AdmissionOrder] UI Photo failed to render`)}
                />
              ) : student.photograph_url && isPreparingAssets ? (
                <div className="w-20 h-24 rounded-lg border-2 border-white/30 bg-white/10 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                  <span className="text-[10px] text-white/70">Loading...</span>
                </div>
              ) : (
                <div className="w-20 h-24 rounded-lg border-2 border-dashed border-white/30 bg-white/5 flex flex-col items-center justify-center text-white/40 text-[10px] uppercase font-bold text-center px-1">
                  <span>Photo</span>
                  <span>Missing</span>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">The American Foundation School</h1>
              <p className="text-red-100 flex items-center gap-2 mt-1">
                <span className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                Admission Order Form | Official Record
              </p>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm border border-white/20">
              <span className="text-xs font-semibold text-red-500 bg-white px-2 py-0.5 rounded-full mr-2 uppercase">CC</span>
              <span className="font-mono text-lg font-bold">{student.cc}</span>
            </div>
            <p className="text-xs text-red-200 font-medium tracking-wide uppercase">GR: {student.gr_number || 'PENDING'}</p>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-8 space-y-8">
        {/* Quick Summary Banner */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 items-center">
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Class</span>
                <span className="font-semibold text-gray-800">{student.class_name || 'N/A'}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Section</span>
                <span className="font-semibold text-gray-800">{student.section_name || 'N/A'}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Gender</span>
                <span className="font-semibold text-gray-800">{student.gender || 'N/A'}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Academic Year</span>
                <span className="font-semibold text-gray-800">{student.academic_year || 'N/A'}</span>
            </div>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest border-b pb-2">Student Information</h3>
                <div className="grid gap-4">
                    <div className="group">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block group-focus-within:text-red-500 transition-colors">Candidate Name</label>
                        <input type="text" value={student.full_name} readOnly className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:bg-white focus:ring-4 focus:ring-red-500/5 transition-all outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Date of Birth</label>
                            <input type="text" value={student.dob ? new Date(student.dob).toLocaleDateString() : 'N/A'} readOnly className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl font-medium text-gray-700 shadow-sm" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Reg Number</label>
                            <input type="text" value={student.reg_number || 'N/A'} readOnly className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl font-medium text-gray-700 shadow-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Permanent Address</label>
                        <textarea value={student.address || ''} readOnly rows={3} className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl font-medium text-gray-700 resize-none shadow-sm" />
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest border-b pb-2">Guardian Details</h3>
                <div className="grid gap-4">
                    <div className="group">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Father's Name</label>
                        <input type="text" value={student.father_name || 'N/A'} readOnly className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl font-semibold text-gray-900" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Father Cell</label>
                            <input type="text" value={student.father_cell || 'N/A'} readOnly className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl font-medium text-gray-700 shadow-sm" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Mother Cell</label>
                            <input type="text" value={student.mother_cell || 'N/A'} readOnly className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl font-medium text-gray-700 shadow-sm" />
                        </div>
                    </div>
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-1">
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-wider">Emergency Contact</span>
                        <p className="font-bold text-orange-900">{student.nearest_name || 'N/A'}</p>
                        <p className="text-sm text-orange-800 font-medium">{student.nearest_phone || 'No Phone Registered'}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Remarks Section */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
            <RemarksField value={remarks} onChange={setRemarks} />
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-gray-200">
          <div className="flex items-center gap-3">
            {isPreparingAssets ? (
              <div className="flex items-center gap-3 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200 text-sm font-bold shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating Print Assets...
              </div>
            ) : photoBase64 ? (
              <div className="flex items-center gap-3 px-4 py-2 bg-green-50 text-green-700 rounded-full border border-green-200 text-sm font-bold shadow-sm animate-in fade-in slide-in-from-left-4">
                <div className="h-2 w-2 bg-green-500 rounded-full" />
                Asset Ready for High-Res Print
              </div>
            ) : student.photograph_url ? (
                <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 text-blue-700 rounded-full border border-blue-200 text-sm font-bold shadow-sm">
                    Photo Loading...
                </div>
            ) : (
                <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 text-gray-600 rounded-full border border-gray-200 text-sm font-bold shadow-sm">
                    No Photograph to Print
                </div>
            )}
          </div>
          
          <button
            onClick={handleDownload}
            disabled={isPreparingAssets || isGenerating}
            className="group relative inline-flex items-center justify-center px-10 py-4 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-2xl font-black text-lg shadow-xl shadow-red-900/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            {isGenerating ? (
              <><Loader2 className="h-6 w-6 mr-3 animate-spin" />Processing PDF...</>
            ) : (
              <><Download className="h-6 w-6 mr-3 group-hover:bounce transition-transform" />Download Admission Order</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}