'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Loader2, Image as ImageIcon, CheckCircle2, Building2, Layout, Sparkles, Maximize2, X } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { LeavingCertificatePDF, LeavingCertificateData } from './LeavingCertificatePDF';

interface LeavingCertificateFormProps {
    data: LeavingCertificateData;
}

interface LogoOption {
    id: string;
    name: string;
    subtitle: string;
    url: string;
}

const LOGO_SIZES: { id: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE'; label: string; scaleText: string }[] = [
    { id: 'SMALL', label: 'Small', scaleText: '80%' },
    { id: 'MEDIUM', label: 'Medium', scaleText: '100%' },
    { id: 'LARGE', label: 'Large', scaleText: '120%' },
    { id: 'XLARGE', label: 'X-Large', scaleText: '140%' },
];

const LEFT_LOGOS: LogoOption[] = [
    { id: 'DEFAULT', name: 'TAFS Crest', subtitle: 'Official Shield Crest', url: '/logo.png' },
    { id: 'TAFCS', name: 'The American Foundation School', subtitle: 'TAFCS Red Banner Logo', url: '/logo-tafcs.png' },
    { id: 'TAFSAL', name: 'TAFSAL A-Level', subtitle: 'A-Level Segment Logo', url: '/logo-tafsal.png' },
    { id: 'TAFSS', name: 'TAFSS Secondary', subtitle: 'Secondary Segment Logo', url: '/logo-tafss.png' },
    { id: 'TAFSOL', name: 'TAFSOL O-Level', subtitle: 'O-Level Segment Logo', url: '/logo-tafsol.png' },
];

const RIGHT_LOGOS: LogoOption[] = [
    { id: 'FLAG', name: 'Each One Teach One', subtitle: 'US Flag & Motto Header', url: '/logo-each-one-teach-one.png' },
    { id: 'CAMB', name: 'Cambridge Assessment', subtitle: 'Cambridge International', url: '/logo-camb.png' },
];

export default function LeavingCertificateForm({ data: initialData }: LeavingCertificateFormProps) {
    const [formData, setFormData] = useState<LeavingCertificateData>(initialData);
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [logoBase64Map, setLogoBase64Map] = useState<Record<string, string>>({});
    
    // Logo selector keys
    const [leftLogoId, setLeftLogoId] = useState<string>('DEFAULT');
    const [rightLogoId, setRightLogoId] = useState<string>('FLAG');

    // Logo size keys
    const [leftLogoSize, setLeftLogoSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE'>('MEDIUM');
    const [rightLogoSize, setRightLogoSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE'>('MEDIUM');

    // Campus selection key
    const [campusSelection, setCampusSelection] = useState<'AUTO' | 'ALL' | 'JAUHAR' | 'KANEEZ' | 'NAZIMABAD'>('AUTO');
    
    // Full screen modal state
    const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);

    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        setFormData(initialData);
        if (initialData.selected_campus) {
            setCampusSelection(initialData.selected_campus);
        }
        if (initialData.left_logo_size) {
            setLeftLogoSize(initialData.left_logo_size);
        }
        if (initialData.right_logo_size) {
            setRightLogoSize(initialData.right_logo_size);
        }
    }, [initialData]);

    // Preload all logo image base64s for reliable PDF embedding
    useEffect(() => {
        let isMounted = true;
        const allUrls = Array.from(new Set([...LEFT_LOGOS.map(l => l.url), ...RIGHT_LOGOS.map(r => r.url)]));
        
        allUrls.forEach(url => {
            fetch(url)
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (isMounted && typeof reader.result === 'string') {
                            setLogoBase64Map(prev => ({ ...prev, [url]: reader.result as string }));
                        }
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(() => {});
        });

        if (initialData?.photograph_url) {
            fetch(initialData.photograph_url)
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (isMounted && typeof reader.result === 'string') {
                            setPhotoBase64(reader.result as string);
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

    const activeLeftUrl = LEFT_LOGOS.find(l => l.id === leftLogoId)?.url || '/logo.png';
    const activeRightUrl = RIGHT_LOGOS.find(r => r.id === rightLogoId)?.url || '/logo-each-one-teach-one.png';

    const handleDownloadPDF = useCallback(async () => {
        setIsGenerating(true);
        try {
            const leftBase64 = logoBase64Map[activeLeftUrl] || activeLeftUrl;
            const rightBase64 = logoBase64Map[activeRightUrl] || activeRightUrl;

            const pdfData: LeavingCertificateData = {
                ...formData,
                photograph_url: photoBase64 || formData.photograph_url || null,
                logo_url: leftBase64,
                right_logo_url: rightBase64,
                left_logo_id: leftLogoId,
                right_logo_id: rightLogoId,
                left_logo_size: leftLogoSize,
                right_logo_size: rightLogoSize,
                selected_campus: campusSelection,
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
    }, [formData, photoBase64, activeLeftUrl, activeRightUrl, logoBase64Map, campusSelection, leftLogoId, rightLogoId, leftLogoSize, rightLogoSize]);

    // Format display for enrolled campus info
    const studentCampusName = formData.campus_name || 'Enrolled Campus';

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
                    <span className="block text-[10px] font-black text-zinc-400 uppercase">Enrolled Campus</span>
                    <span className="text-[13px] font-bold text-red-600 dark:text-red-400">{studentCampusName}</span>
                </div>
                <div>
                    <span className="block text-[10px] font-black text-zinc-400 uppercase">Present Level</span>
                    <span className="text-[13px] font-bold text-zinc-800 dark:text-zinc-100">{formData.present_level || '—'} (Sec {formData.section || '—'})</span>
                </div>
                <div>
                    <span className="block text-[10px] font-black text-zinc-400 uppercase">Leaving Date</span>
                    <span className="text-[13px] font-bold text-zinc-800 dark:text-zinc-100">
                        {formData.last_date_of_attendance?.month} {formData.last_date_of_attendance?.day}, {formData.last_date_of_attendance?.year}
                    </span>
                </div>
            </div>

            {/* Editable Certificate Form Controls */}
            <div className="p-6 space-y-8">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                        Leaving Certificate Customization & Details
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

                {/* VISUAL LOGO SELECTOR SECTION */}
                <div className="bg-zinc-50 dark:bg-zinc-850/60 rounded-2xl p-5 border border-zinc-200/80 dark:border-zinc-800 space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <Sparkles className="h-4 w-4" />
                            <h4 className="text-xs font-extrabold uppercase tracking-wider">Header Logos Customization (Visual Selector)</h4>
                        </div>
                        <span className="text-[10px] font-semibold text-zinc-400">Click any card to select logo</span>
                    </div>

                    {/* Visual Live Header Preview Banner */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="block text-[10px] font-bold text-zinc-400 uppercase">Live Certificate Header Preview</span>
                            <button
                                type="button"
                                onClick={() => setIsHeaderModalOpen(true)}
                                className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all shadow-sm"
                            >
                                <Maximize2 className="h-3 w-3 text-red-600" />
                                View Full Screen
                            </button>
                        </div>
                        <div className="flex items-center justify-between min-h-16 px-4 py-2 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                            {/* Left Logo Preview */}
                            <div className="flex items-center justify-start transition-all">
                                <img
                                    src={activeLeftUrl}
                                    alt="Top Left Logo"
                                    className={`object-contain transition-all ${
                                        leftLogoSize === 'SMALL' ? 'h-7' : leftLogoSize === 'LARGE' ? 'h-12' : leftLogoSize === 'XLARGE' ? 'h-15' : 'h-9'
                                    }`}
                                />
                            </div>
                            {/* Document Title Preview */}
                            <div className="text-center px-2">
                                <span className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-100 underline decoration-zinc-400">
                                    {formData.header_title || 'TAFS LEAVING CERTIFICATE'}
                                </span>
                            </div>
                            {/* Right Logo Preview */}
                            <div className="flex items-center justify-end transition-all">
                                <img
                                    src={activeRightUrl}
                                    alt="Top Right Logo"
                                    className={`object-contain transition-all ${
                                        rightLogoSize === 'SMALL' ? 'h-7' : rightLogoSize === 'LARGE' ? 'h-12' : rightLogoSize === 'XLARGE' ? 'h-15' : 'h-9'
                                    }`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* TOP LEFT LOGO VISUAL SELECTOR */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase">
                                    Top Left Header Logo
                                </label>
                                <select
                                    value={leftLogoId}
                                    onChange={e => setLeftLogoId(e.target.value)}
                                    className="text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 outline-none cursor-pointer"
                                >
                                    {LEFT_LOGOS.map(logo => (
                                        <option key={logo.id} value={logo.id}>{logo.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Visual Cards Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                {LEFT_LOGOS.map(logo => {
                                    const isSelected = leftLogoId === logo.id;
                                    return (
                                        <button
                                            key={logo.id}
                                            type="button"
                                            onClick={() => setLeftLogoId(logo.id)}
                                            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                                                isSelected
                                                    ? 'border-red-600 bg-red-50/60 dark:bg-red-950/20 ring-2 ring-red-500/30'
                                                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300'
                                            }`}
                                        >
                                            {isSelected && (
                                                <CheckCircle2 className="h-4 w-4 text-red-600 absolute top-2 right-2" />
                                            )}
                                            <div className="h-10 w-full flex items-center justify-center mb-2 bg-zinc-50 dark:bg-zinc-950 rounded-lg p-1">
                                                <img src={logo.url} alt={logo.name} className="max-h-full max-w-full object-contain" />
                                            </div>
                                            <div>
                                                <span className="block text-[11px] font-extrabold text-zinc-800 dark:text-zinc-200 leading-tight">
                                                    {logo.name}
                                                </span>
                                                <span className="block text-[9px] text-zinc-400 leading-tight mt-0.5 truncate">
                                                    {logo.subtitle}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Left Logo Size Control */}
                            <div className="pt-2">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-extrabold uppercase text-zinc-500">Left Logo Size</span>
                                    <span className="text-[10px] font-bold text-red-600">
                                        {LOGO_SIZES.find(s => s.id === leftLogoSize)?.label} ({LOGO_SIZES.find(s => s.id === leftLogoSize)?.scaleText})
                                    </span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                    {LOGO_SIZES.map(sizeOpt => {
                                        const isSelected = leftLogoSize === sizeOpt.id;
                                        return (
                                            <button
                                                key={sizeOpt.id}
                                                type="button"
                                                onClick={() => setLeftLogoSize(sizeOpt.id)}
                                                className={`py-1 text-[10px] font-bold rounded-lg transition-all border ${
                                                    isSelected
                                                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                                                }`}
                                            >
                                                {sizeOpt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* TOP RIGHT LOGO VISUAL SELECTOR */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase">
                                    Top Right Header Logo
                                </label>
                                <select
                                    value={rightLogoId}
                                    onChange={e => setRightLogoId(e.target.value)}
                                    className="text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 outline-none cursor-pointer"
                                >
                                    {RIGHT_LOGOS.map(logo => (
                                        <option key={logo.id} value={logo.id}>{logo.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Visual Cards Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                {RIGHT_LOGOS.map(logo => {
                                    const isSelected = rightLogoId === logo.id;
                                    return (
                                        <button
                                            key={logo.id}
                                            type="button"
                                            onClick={() => setRightLogoId(logo.id)}
                                            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                                                isSelected
                                                    ? 'border-red-600 bg-red-50/60 dark:bg-red-950/20 ring-2 ring-red-500/30'
                                                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300'
                                            }`}
                                        >
                                            {isSelected && (
                                                <CheckCircle2 className="h-4 w-4 text-red-600 absolute top-2 right-2" />
                                            )}
                                            <div className="h-10 w-full flex items-center justify-center mb-2 bg-zinc-50 dark:bg-zinc-950 rounded-lg p-1">
                                                <img src={logo.url} alt={logo.name} className="max-h-full max-w-full object-contain" />
                                            </div>
                                            <div>
                                                <span className="block text-[11px] font-extrabold text-zinc-800 dark:text-zinc-200 leading-tight">
                                                    {logo.name}
                                                </span>
                                                <span className="block text-[9px] text-zinc-400 leading-tight mt-0.5 truncate">
                                                    {logo.subtitle}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Right Logo Size Control */}
                            <div className="pt-2">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-extrabold uppercase text-zinc-500">Right Logo Size</span>
                                    <span className="text-[10px] font-bold text-red-600">
                                        {LOGO_SIZES.find(s => s.id === rightLogoSize)?.label} ({LOGO_SIZES.find(s => s.id === rightLogoSize)?.scaleText})
                                    </span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                    {LOGO_SIZES.map(sizeOpt => {
                                        const isSelected = rightLogoSize === sizeOpt.id;
                                        return (
                                            <button
                                                key={sizeOpt.id}
                                                type="button"
                                                onClick={() => setRightLogoSize(sizeOpt.id)}
                                                className={`py-1 text-[10px] font-bold rounded-lg transition-all border ${
                                                    isSelected
                                                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                                                }`}
                                            >
                                                {sizeOpt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
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

                {/* Section 3: Academic History & Campus Location */}
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

                        {/* CAMPUS ADDRESS SELECTOR */}
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1 flex items-center justify-between">
                                <span>Footer Campus Address Display</span>
                                <span className="text-[10px] text-red-600 font-semibold uppercase">Enrolled: {studentCampusName}</span>
                            </label>
                            <select
                                value={campusSelection}
                                onChange={e => setCampusSelection(e.target.value as any)}
                                className="w-full h-10 px-3 text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-red-500 cursor-pointer"
                            >
                                <option value="AUTO">Auto (Show Enrolled Student's Campus: {studentCampusName})</option>
                                <option value="JAUHAR">Gulistan-e-Jauhar Campus Only</option>
                                <option value="KANEEZ">Gulshan-e-Kaneez Fatima Campus Only</option>
                                <option value="NAZIMABAD">North Nazimabad Campus Only</option>
                                <option value="ALL">All 3 Campuses (Full Institutional Footer)</option>
                            </select>
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

            {/* FULL SCREEN HEADER PREVIEW MODAL */}
            {isHeaderModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-4xl w-full p-6 md:p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-6 relative">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-xl">
                                    <Maximize2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                                        Full Screen Certificate Header Preview
                                    </h3>
                                    <p className="text-xs text-zinc-400 font-medium">Real-time proportions as printed on official A4 SLC PDF</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsHeaderModalOpen(false)}
                                className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* High-Res Full Header Canvas */}
                        <div className="bg-white p-8 md:p-10 rounded-2xl border border-zinc-200 shadow-inner space-y-4">
                            <div className="flex items-center justify-between h-28 border-b border-zinc-200 pb-4">
                                {/* Left Logo */}
                                <div className="h-24 w-52 flex items-center justify-start">
                                    <img src={activeLeftUrl} alt="Top Left Logo" className="max-h-full max-w-full object-contain" />
                                </div>
                                {/* Header Title */}
                                <div className="text-center px-4">
                                    <h2 className="text-xl md:text-2xl font-black uppercase text-black underline tracking-wide">
                                        {formData.header_title || 'TAFS LEAVING CERTIFICATE'}
                                    </h2>
                                </div>
                                {/* Right Logo */}
                                <div className="h-24 w-56 flex items-center justify-end">
                                    <img src={activeRightUrl} alt="Top Right Logo" className="max-h-full max-w-full object-contain" />
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-semibold pt-2">
                                <span>Left Logo: {LEFT_LOGOS.find(l => l.id === leftLogoId)?.name}</span>
                                <span className="italic">Exact A4 Header Proportion Mockup</span>
                                <span>Right Logo: {RIGHT_LOGOS.find(r => r.id === rightLogoId)?.name}</span>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="flex items-center justify-between pt-2">
                            <button
                                onClick={() => setIsHeaderModalOpen(false)}
                                className="px-5 h-11 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-extrabold rounded-xl transition-all"
                            >
                                Close Preview
                            </button>
                            <button
                                onClick={() => {
                                    setIsHeaderModalOpen(false);
                                    handleDownloadPDF();
                                }}
                                disabled={isGenerating}
                                className="px-6 h-11 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-red-200 dark:shadow-none"
                            >
                                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                                {isGenerating ? 'Generating PDF...' : 'Download Official SLC PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
