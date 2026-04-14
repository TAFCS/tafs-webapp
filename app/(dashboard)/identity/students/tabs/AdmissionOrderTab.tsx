"use client";

import { useState, useEffect } from "react";
import { 
    Loader2, 
    Printer,
    Edit3,
    AlertCircle
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { pdf } from "@react-pdf/renderer";
import { AdmissionOrderPDF, AdmissionOrderData } from "@/components/enrollment/AdmissionOrderPDF";

interface Props {
    cc: number;
}

const InputField = ({ label, value, onChange, width = "flex-1" }: { label: string, value: string, onChange: (v: string) => void, width?: string }) => (
    <div className={`flex items-end gap-2 ${width}`}>
        <span className="text-[9px] font-black uppercase whitespace-nowrap text-zinc-400">{label}</span>
        <input 
            type="text" 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-transparent border-b border-zinc-100 dark:border-zinc-800 focus:border-primary outline-none py-0.5 text-xs font-bold text-zinc-900 dark:text-zinc-100 px-1"
        />
    </div>
);

export function AdmissionOrderTab({ cc }: Props) {
    const [formData, setFormData] = useState<AdmissionOrderData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (cc) fetchData();
    }, [cc]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: res } = await api.get(`/v1/enrollments/${cc}/admission-order`);
            const raw = res.data;
            
            const initialData: AdmissionOrderData = {
                day: new Date().toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase(),
                date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'),
                from: 'ADMISSION REGISTRAR',
                reg_number: '',
                cc: raw.cc,
                gr_number: raw.gr_number || '',
                link_gr_number: '',
                full_name: raw.full_name || '',
                father_name: raw.father_name || '',
                dob: raw.dob || '',
                gender: raw.gender || '',
                doa: raw.doa || '',
                academic_year: raw.academic_year || '',
                campus_name: raw.campus_name || '',
                class_name: raw.class_name || '',
                section_name: raw.section_name || '',
                remarks: '',
                address: raw.address || '',
                home_phone: raw.home_phone || '',
                fax: raw.fax || '',
                father_cell: raw.father_cell || '',
                mother_cell: raw.mother_cell || '',
                nearest_phone: '',
                nearest_name: '',
                relationship: '',
                email: raw.email || '',
                remarks_general: ''
            };
            setFormData(initialData);
        } catch (error) {
            toast.error("Failed to load admission order data");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!formData) return;
        setIsGenerating(true);
        try {
            const blob = await pdf(<AdmissionOrderPDF data={formData} />).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `admission_order_${formData.cc}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success("Admission Order generated successfully!");
        } catch (error) {
            toast.error("Failed to generate PDF");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleChange = (field: keyof AdmissionOrderData, value: string) => {
        if (formData) {
            setFormData({ ...formData, [field]: value });
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Order Data...</p>
            </div>
        );
    }

    if (!formData) return (
        <div className="p-10 text-center">
            <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-2 opacity-20" />
            <p className="text-zinc-500 font-bold">Could not load admission order.</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header Control */}
            <div className="flex items-center justify-between gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-1 flex items-start gap-3">
                    <Edit3 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[11px] font-black text-amber-700 uppercase tracking-tight">Interactive Preview</p>
                        <p className="text-[10px] font-bold text-amber-600/80 leading-tight">Edit any field below to update the final printed form.</p>
                    </div>
                </div>
                <button 
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="flex items-center gap-2 h-12 px-6 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 tracking-widest text-[11px]"
                >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    {isGenerating ? 'GENERATING...' : 'PRINT ORDER'}
                </button>
            </div>

            {/* Scaled Paper Preview */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 rounded-lg shadow-sm relative overflow-hidden">
                {/* Simplified Header */}
                <div className="text-center mb-8">
                    <p className="text-[8px] font-black text-red-700 tracking-[0.2em] uppercase">The American Foundation School</p>
                    <h2 className="text-lg font-black text-blue-900 dark:text-blue-400 tracking-tight">ADMISSION ORDER</h2>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-8 pb-4 border-b border-zinc-50 dark:border-zinc-900">
                        <div className="space-y-3">
                            <InputField label="Day :" value={formData.day || ''} onChange={(v) => handleChange('day', v)} />
                            <InputField label="Date :" value={formData.date || ''} onChange={(v) => handleChange('date', v)} />
                            <InputField label="From :" value={formData.from || ''} onChange={(v) => handleChange('from', v)} />
                        </div>
                        <div className="space-y-3">
                            <InputField label="Reg. # :" value={formData.reg_number || ''} onChange={(v) => handleChange('reg_number', v)} />
                            <InputField label="C.C. # :" value={formData.cc.toString()} onChange={(v) => handleChange('cc', v)} />
                            <InputField label="G.R. # :" value={formData.gr_number || ''} onChange={(v) => handleChange('gr_number', v)} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <InputField label="Student's Name :" value={formData.full_name || ''} onChange={(v) => handleChange('full_name', v)} />
                        <InputField label="Father's Name :" value={formData.father_name || ''} onChange={(v) => handleChange('father_name', v)} />
                        
                        <div className="flex gap-6">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black uppercase text-zinc-400">Gender :</span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleChange('gender', 'MALE')}
                                        className={`px-2 py-0.5 rounded text-[10px] font-black border transition-all ${formData.gender?.toUpperCase() === 'MALE' ? 'bg-blue-600 text-white border-blue-600' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}
                                    >
                                        M
                                    </button>
                                    <button 
                                        onClick={() => handleChange('gender', 'FEMALE')}
                                        className={`px-2 py-0.5 rounded text-[10px] font-black border transition-all ${formData.gender?.toUpperCase() === 'FEMALE' ? 'bg-pink-600 text-white border-pink-600' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}
                                    >
                                        F
                                    </button>
                                </div>
                            </div>
                            <InputField label="DOB :" value={formData.dob ? new Date(formData.dob).toLocaleDateString() : ''} onChange={(v) => handleChange('dob', v)} />
                        </div>

                        <div className="flex gap-6">
                            <InputField label="Class :" value={formData.class_name || ''} onChange={(v) => handleChange('class_name', v)} />
                            <InputField label="Section :" value={formData.section_name || ''} onChange={(v) => handleChange('section_name', v)} />
                        </div>

                        <InputField label="Address :" value={formData.address || ''} onChange={(v) => handleChange('address', v)} />

                        <div className="flex gap-6">
                            <InputField label="Father's Cell :" value={formData.father_cell || ''} onChange={(v) => handleChange('father_cell', v)} />
                            <InputField label="Mother's Cell :" value={formData.mother_cell || ''} onChange={(v) => handleChange('mother_cell', v)} />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <InputField label="Nearest # :" value={formData.nearest_phone || ''} onChange={(v) => handleChange('nearest_phone', v)} />
                            <InputField label="Relationship :" value={formData.relationship || ''} onChange={(v) => handleChange('relationship', v)} />
                        </div>

                        <InputField label="Remarks :" value={formData.remarks_general || ''} onChange={(v) => handleChange('remarks_general', v)} />
                    </div>
                </div>

                {/* Footer Watermark */}
                <div className="absolute bottom-4 right-4 text-[40px] font-black text-zinc-50 dark:text-zinc-900/40 pointer-events-none select-none opacity-50">
                    ADMISSION-101
                </div>
            </div>
        </div>
    );
}
