'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { LeavingCertificatePDF, LeavingCertificateData } from './LeavingCertificatePDF';

interface LeavingCertificateFormProps {
    data: LeavingCertificateData;
}

export default function LeavingCertificateForm({ data: initialData }: LeavingCertificateFormProps) {
    const [formData, setFormData] = useState<LeavingCertificateData>(initialData);
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        setFormData(initialData);
    }, [initialData]);

    useEffect(() => {
        let isMounted = true;
        if (initialData?.photograph_url) {
            const url = initialData.photograph_url;
            fetch(url)
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (isMounted && typeof reader.result === 'string') {
                            setPhotoBase64(reader.result);
                        }
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(() => {});
        }
        return () => {
            isMounted = false;
        };
    }, [initialData?.photograph_url]);

    const handleDownloadPDF = useCallback(async () => {
        setIsGenerating(true);
        try {
            const pdfData: LeavingCertificateData = {
                ...formData,
                photograph_url: photoBase64 || formData.photograph_url || null,
            };

            const doc = <LeavingCertificatePDF data={pdfData} />;
            const blob = await pdf(doc).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `TAFS_Leaving_Certificate_${formData.cc || 'student'}.pdf`;
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
    }, [formData, photoBase64]);

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Student Photo */}
                        <div className="w-16 h-20 rounded-xl overflow-hidden border-2 border-white/40 bg-white/10 flex items-center justify-center shrink-0">
                            {photoBase64 || formData.photograph_url ? (
                                <img
                                    src={photoBase64 || formData.photograph_url || ''}
                                    alt="Student"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-[10px] text-white/70 uppercase font-bold text-center">Photo</span>
                            )}
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">The American Foundation School</h1>
                            <p className="text-red-100 text-xs font-semibold uppercase tracking-wider mt-1 flex items-center gap-2">
                                <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
                                Student Leaving Certificate (SLC)
                            </p>
                        </div>
                    </div>
                    <div className="text-right space-y-1">
                        <div className="bg-white/15 px-3 py-1 rounded-full backdrop-blur-md border border-white/20 inline-flex items-center gap-2">
                            <span className="text-[11px] font-black text-red-600 bg-white px-2 py-0.5 rounded-full uppercase">CC</span>
                            <span className="font-mono text-xl font-bold">{formData.cc}</span>
                        </div>
                        <p className="text-xs text-red-200 font-bold uppercase tracking-wider">GR: {formData.gr_number || '—'}</p>
                    </div>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                    <span className="block text-[10px] font-black text-zinc-400 uppercase">SLC Number</span>
                    <span className="text-[13px] font-bold text-zinc-800 dark:text-zinc-100">{formData.slc_number || '—'}</span>
                </div>
                <div>
                    <span className="block text-[10px] font-black text-zinc-400 uppercase">Present Level</span>
                    <span className="text-[13px] font-bold text-zinc-800 dark:text-zinc-100">{formData.present_level || '—'} (Sec {formData.section || '—'})</span>
                </div>
                <div>
                    <span className="block text-[10px] font-black text-zinc-400 uppercase">Reason for Leaving</span>
                    <span className="text-[13px] font-bold text-zinc-800 dark:text-zinc-100">{formData.reason_for_leaving || '—'}</span>
                </div>
                <div>
                    <span className="block text-[10px] font-black text-zinc-400 uppercase">Leaving Date</span>
                    <span className="text-[13px] font-bold text-zinc-800 dark:text-zinc-100">
                        {formData.last_date_of_attendance?.month} {formData.last_date_of_attendance?.day}, {formData.last_date_of_attendance?.year}
                    </span>
                </div>
            </div>

            {/* Editable Certificate Form Controls */}
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                        Leaving Certificate Fields & Details
                    </h3>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGenerating}
                        className="px-4 h-9 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-red-200 dark:shadow-none"
                    >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {isGenerating ? 'Generating PDF...' : 'Download Official SLC PDF'}
                    </button>
                </div>

                {/* Section 1: Certificate Numbers & Candidate Name */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">1. Basic Info & Identification</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Certificate Heading</label>
                            <select
                                value={formData.header_prefix || 'TAFS'}
                                onChange={e => {
                                    const selectedPrefix = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        header_prefix: selectedPrefix,
                                        header_title: `${selectedPrefix} LEAVING CERTIFICATE`,
                                    }));
                                }}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-red-500 uppercase cursor-pointer"
                            >
                                <option value="TAFS">TAFS LEAVING CERTIFICATE</option>
                                <option value="TAFCS">TAFCS LEAVING CERTIFICATE</option>
                                <option value="TAFSAL">TAFSAL LEAVING CERTIFICATE</option>
                                <option value="TAFSS">TAFSS LEAVING CERTIFICATE</option>
                                <option value="TAFSOL">TAFSOL LEAVING CERTIFICATE</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">SLC #</label>
                            <input
                                type="text"
                                value={formData.slc_number || ''}
                                onChange={e => setFormData(prev => ({ ...prev, slc_number: e.target.value }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-red-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">G. R. #</label>
                            <input
                                type="text"
                                value={formData.gr_number || ''}
                                onChange={e => setFormData(prev => ({ ...prev, gr_number: e.target.value }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-red-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Computer Code (CC)</label>
                            <input
                                type="text"
                                value={formData.cc || ''}
                                disabled
                                className="w-full h-9 px-3 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-500 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Student Last Name</label>
                            <input
                                type="text"
                                value={formData.name?.last || ''}
                                onChange={e => setFormData(prev => ({ ...prev, name: { ...prev.name, last: e.target.value } }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Student First Name</label>
                            <input
                                type="text"
                                value={formData.name?.first || ''}
                                onChange={e => setFormData(prev => ({ ...prev, name: { ...prev.name, first: e.target.value } }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Student Middle Name</label>
                            <input
                                type="text"
                                value={formData.name?.middle || ''}
                                onChange={e => setFormData(prev => ({ ...prev, name: { ...prev.name, middle: e.target.value } }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 2: Father Name & Demographics */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">2. Guardian & Personal Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Father Last Name</label>
                            <input
                                type="text"
                                value={formData.father_name?.last || ''}
                                onChange={e => setFormData(prev => ({ ...prev, father_name: { ...prev.father_name, last: e.target.value } }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Father First Name</label>
                            <input
                                type="text"
                                value={formData.father_name?.first || ''}
                                onChange={e => setFormData(prev => ({ ...prev, father_name: { ...prev.father_name, first: e.target.value } }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Father Middle Name</label>
                            <input
                                type="text"
                                value={formData.father_name?.middle || ''}
                                onChange={e => setFormData(prev => ({ ...prev, father_name: { ...prev.father_name, middle: e.target.value } }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Sex</label>
                            <select
                                value={formData.gender || 'MALE'}
                                onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none"
                            >
                                <option value="MALE">MALE</option>
                                <option value="FEMALE">FEMALE</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Religion</label>
                            <input
                                type="text"
                                value={formData.religion || ''}
                                onChange={e => setFormData(prev => ({ ...prev, religion: e.target.value }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Nationality</label>
                            <input
                                type="text"
                                value={formData.nationality || ''}
                                onChange={e => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Identification Mark</label>
                            <input
                                type="text"
                                value={formData.identification_marks || ''}
                                onChange={e => setFormData(prev => ({ ...prev, identification_marks: e.target.value }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 3: Academic History & Result */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">3. Academic Record & Campus Location</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Reason for Leaving</label>
                            <input
                                type="text"
                                value={formData.reason_for_leaving || ''}
                                onChange={e => setFormData(prev => ({ ...prev, reason_for_leaving: e.target.value }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Remarks</label>
                            <input
                                type="text"
                                value={formData.remarks || ''}
                                onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none uppercase"
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Footer Campus Location / Address</label>
                            <input
                                type="text"
                                value={formData.campus_address || ''}
                                onChange={e => setFormData(prev => ({ ...prev, campus_address: e.target.value }))}
                                className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 border rounded-xl outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Action */}
                <div className="pt-4 flex justify-end">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGenerating}
                        className="px-6 h-11 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-red-200 dark:shadow-none"
                    >
                        {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                        {isGenerating ? 'Generating PDF...' : 'Download Official SLC PDF'}
                    </button>
                </div>
            </div>
        </div>
    );
}
