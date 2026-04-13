"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
    Loader2, 
    Download, 
    ArrowLeft, 
    Printer,
    Edit3,
    FileText
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { pdf } from "@react-pdf/renderer";
import { AdmissionOrderPDF, AdmissionOrderData } from "@/components/enrollment/AdmissionOrderPDF";

const InputField = ({ label, value, onChange, width = "flex-1" }: { label: string, value: string, onChange: (v: string) => void, width?: string }) => (
    <div className={`flex items-end gap-2 ${width}`}>
        <span className="text-[10px] font-black uppercase whitespace-nowrap text-zinc-400">{label}</span>
        <input 
            type="text" 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-transparent border-b border-zinc-200 dark:border-zinc-800 focus:border-primary outline-none py-0.5 text-sm font-bold text-zinc-900 dark:text-zinc-100 px-1"
        />
    </div>
);

export default function AdmissionOrderPage() {
    const params = useParams();
    const router = useRouter();
    const cc = params.cc;

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
            
            // Map backend data to editable form data
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
            <div className="flex flex-col items-center justify-center min-h-screen">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Preparing Editable Form...</p>
            </div>
        );
    }

    if (!formData) return null;

    return (
        <div className="max-w-5xl mx-auto py-10 px-6 space-y-8">
            {/* Control Bar */}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm sticky top-6 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors">
                        <ArrowLeft className="h-6 w-6 text-zinc-500" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            Admission Order <span className="text-xs bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-lg text-zinc-400">CC #{formData.cc}</span>
                        </h1>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                            <Edit3 className="h-3 w-3" /> Edit fields below then print
                        </p>
                    </div>
                </div>

                <button 
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 tracking-widest text-sm"
                >
                    {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
                    {isGenerating ? 'GENERATING PDF...' : 'PRINT ADMISSION ORDER'}
                </button>
            </div>

            {/* Editable Paper Form */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 p-16 rounded-sm shadow-2xl relative overflow-hidden text-zinc-900 dark:text-zinc-100">
                {/* School Header */}
                <div className="text-center space-y-2 mb-12">
                    <p className="text-[10px] font-black text-red-700 tracking-[0.2em] uppercase">The American Foundation School for A Level Studies</p>
                    <h2 className="text-3xl font-black text-blue-900 tracking-tight">ADMISSION ORDER</h2>
                    <div className="flex justify-center items-center gap-2 pt-2">
                        <span className="text-[10px] font-black uppercase">Campus -</span>
                        <input 
                            type="text" 
                            value={formData.campus_name || ''} 
                            onChange={(e) => handleChange('campus_name', e.target.value)}
                            className="bg-transparent border-b border-zinc-300 outline-none text-sm font-black text-center w-48"
                        />
                    </div>
                </div>

                {/* Grid Rows */}
                <div className="space-y-10">
                    {/* Metrics Row */}
                    <div className="grid grid-cols-2 gap-20 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="space-y-4">
                            <InputField label="Day :" value={formData.day || ''} onChange={(v) => handleChange('day', v)} />
                            <InputField label="Date :" value={formData.date || ''} onChange={(v) => handleChange('date', v)} />
                            <InputField label="From :" value={formData.from || ''} onChange={(v) => handleChange('from', v)} />
                        </div>
                        <div className="space-y-4">
                            <InputField label="Reg. # :" value={formData.reg_number || ''} onChange={(v) => handleChange('reg_number', v)} />
                            <InputField label="C.C. # :" value={formData.cc.toString()} onChange={(v) => handleChange('cc', v)} />
                            <InputField label="G.R. # :" value={formData.gr_number || ''} onChange={(v) => handleChange('gr_number', v)} />
                            <InputField label="Link to G.R. # :" value={formData.link_gr_number || ''} onChange={(v) => handleChange('link_gr_number', v)} />
                        </div>
                    </div>

                    {/* Student Detail Rows */}
                    <div className="space-y-6">
                        <InputField label="Student's Name :" value={formData.full_name || ''} onChange={(v) => handleChange('full_name', v)} />
                        <InputField label="Father's Name :" value={formData.father_name || ''} onChange={(v) => handleChange('father_name', v)} />
                        
                        <div className="flex gap-10">
                            <InputField label="Date of Birth :" value={formData.dob ? new Date(formData.dob).toLocaleDateString() : ''} onChange={(v) => handleChange('dob', v)} />
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black uppercase text-zinc-400">Gender :</span>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="gender" checked={formData.gender?.toUpperCase() === 'MALE'} onChange={() => handleChange('gender', 'MALE')} className="accent-primary" />
                                    <span className="text-xs font-bold uppercase">Male</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="gender" checked={formData.gender?.toUpperCase() === 'FEMALE'} onChange={() => handleChange('gender', 'FEMALE')} className="accent-primary" />
                                    <span className="text-xs font-bold uppercase">Female</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-10">
                            <InputField label="Date of Admission :" value={formData.doa ? new Date(formData.doa).toLocaleDateString() : ''} onChange={(v) => handleChange('doa', v)} />
                            <InputField label="Scholastic Year :" value={formData.academic_year || ''} onChange={(v) => handleChange('academic_year', v)} />
                        </div>

                        <div className="flex gap-10">
                            <InputField label="Class Allocated :" value={formData.class_name || ''} onChange={(v) => handleChange('class_name', v)} width="flex-[2]" />
                            <InputField label="Section :" value={formData.section_name || ''} onChange={(v) => handleChange('section_name', v)} />
                        </div>

                        <InputField label="Remarks :" value={formData.remarks || ''} onChange={(v) => handleChange('remarks', v)} />
                        
                        <InputField label="Permanent Address # :" value={formData.address || ''} onChange={(v) => handleChange('address', v)} />

                        <div className="flex gap-10">
                            <InputField label="Home Phone # :" value={formData.home_phone || ''} onChange={(v) => handleChange('home_phone', v)} />
                            <InputField label="Fax # :" value={formData.fax || ''} onChange={(v) => handleChange('fax', v)} />
                        </div>

                        <div className="flex gap-10">
                            <InputField label="Cellular # (Father's) :" value={formData.father_cell || ''} onChange={(v) => handleChange('father_cell', v)} />
                            <InputField label="Cellular # (Mother's) :" value={formData.mother_cell || ''} onChange={(v) => handleChange('mother_cell', v)} />
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <InputField label="Nearest # :" value={formData.nearest_phone || ''} onChange={(v) => handleChange('nearest_phone', v)} />
                            <InputField label="Name :" value={formData.nearest_name || ''} onChange={(v) => handleChange('nearest_name', v)} />
                            <InputField label="Relationship :" value={formData.relationship || ''} onChange={(v) => handleChange('relationship', v)} />
                        </div>

                        <InputField label="E-mail Address :" value={formData.email || ''} onChange={(v) => handleChange('email', v)} />
                    </div>

                    {/* Footer / C.C. Section */}
                    <div className="pt-10 space-y-8">
                        <div className="text-center font-bold italic text-[9px] text-zinc-400 border-t border-zinc-100 pt-4 tracking-wider">
                            COPIES TO : PERSONAL FILE / PARENTS / ACCOUNTS DEPARTMENT / SCHOOL LIST
                        </div>
                        <InputField label="Remarks (if any) :" value={formData.remarks_general || ''} onChange={(v) => handleChange('remarks_general', v)} />

                        <div className="flex justify-between items-end pt-12">
                            <div className="space-y-1 text-center">
                                <div className="w-40 border-t-2 border-zinc-900 mx-auto"></div>
                                <p className="text-[10px] font-black uppercase">School Stamp</p>
                            </div>
                            <div className="space-y-1 text-center">
                                <div className="w-56 border-t-2 border-zinc-900 mx-auto"></div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-30 italic">System Analyst</p>
                            </div>
                            <div className="space-y-1 text-center">
                                <p className="text-xs font-black">MRS. FOZIA HUSSAIN</p>
                                <div className="w-64 border-t-2 border-zinc-900 mx-auto"></div>
                                <p className="text-[10px] font-black uppercase">Directress A. & P. - G</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vertical form-like watermark for aesthetic */}
                <div className="absolute top-0 right-10 text-[60px] font-black text-zinc-50 pointer-events-none select-none -rotate-90 origin-top-right">FORM 101-AD</div>
            </div>
        </div>
    );
}
