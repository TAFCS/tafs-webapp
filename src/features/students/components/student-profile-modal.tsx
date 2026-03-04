import { X, User, MapPin, Phone, CreditCard, GraduationCap, Hash, LayoutGrid, Calendar as CalendarIcon, Hash as Tag } from "lucide-react";
import { StudentListItem } from "../../../store/slices/studentsSlice";

interface StudentProfileModalProps {
    student: StudentListItem | null;
    onClose: () => void;
}

export function StudentProfileModal({ student, onClose }: StudentProfileModalProps) {
    if (!student) return null;

    const statusStyles: Record<string, string> = {
        Cleared: "bg-emerald-100 text-emerald-800 border-emerald-200",
        Overdue: "bg-rose-100 text-rose-800 border-rose-200",
        Partial: "bg-amber-100 text-amber-800 border-amber-200",
    };

    const estatusStyles: Record<string, string> = {
        ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
        PENDING: "bg-zinc-100 text-zinc-800 border-zinc-200",
        GRADUATED: "bg-blue-100 text-blue-800 border-blue-200",
        SUSPENDED: "bg-rose-100 text-rose-800 border-rose-200 line-through decoration-rose-400",
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                {/* Header (Premium Gradient) */}
                <div className="relative h-32 bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex items-end">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {/* Floating Avatar */}
                    <div className="absolute -bottom-12 left-8 h-24 w-24 bg-white rounded-2xl p-1 shadow-lg border border-zinc-100">
                        <div className="h-full w-full bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                            <User className="h-10 w-10" />
                        </div>
                    </div>
                </div>

                {/* Main Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto w-full">
                    <div className="p-8 pt-16 grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Profile Summary (Left side) */}
                        <div className="flex flex-col gap-6 lg:col-span-1">
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">{student.student_full_name}</h2>
                                <p className="text-sm font-medium text-zinc-500 mt-1">{student.gr_number || "N/A GR"} • {student.cc_number || "N/A CC"}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${estatusStyles[student.enrollment_status || ''] || 'bg-zinc-100 text-zinc-800 border-zinc-200'}`}>
                                    {student.enrollment_status || 'N/A'} Student
                                </span>
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusStyles[student.financial_status_badge || 'Cleared'] || statusStyles.Cleared}`}>
                                    Fee: {student.financial_status_badge || 'Cleared'}
                                </span>
                            </div>

                            <div className="w-full h-px bg-zinc-100 my-2"></div>

                            <div className="flex flex-col gap-4">
                                <InfoItem icon={<LayoutGrid />} label="Campus" value={student.campus || "N/A"} />
                                <InfoItem icon={<GraduationCap className="h-4 w-4" />} label="Grade & Section" value={student.grade_and_section || "N/A"} />
                                <InfoItem icon={<Tag />} label="House" value={student.house_and_color || "N/A"} />
                            </div>

                        </div>

                        {/* Detailed Tabs/Grid (Right side) */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* Personal Info Box */}
                            <div className="bg-zinc-50/50 border rounded-xl p-5">
                                <h3 className="text-sm font-semibold text-zinc-900 mb-4 border-b pb-2 flex items-center gap-2">
                                    <User className="h-4 w-4 text-primary" /> Personal Information
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 gap-y-6">
                                    <DataPoint label="Date of Birth" value={student.date_of_birth?.toString() || ""} />
                                    <DataPoint label="Registration No." value={student.registration_number?.toString() || ""} />
                                    <DataPoint label="Primary Guardian" value={student.primary_guardian_name?.toString() || ""} />
                                    <DataPoint label="Guardian CNIC" value={student.primary_guardian_cnic?.toString() || ""} />
                                    <DataPoint label="WhatsApp Number" value={student.whatsapp_number?.toString() || ""} />
                                    <DataPoint label="Family / Household ID" value={student.family_id?.toString() || ""} />
                                </div>
                            </div>

                            {/* Contact & Address */}
                            <div className="bg-zinc-50/50 border rounded-xl p-5">
                                <h3 className="text-sm font-semibold text-zinc-900 mb-4 border-b pb-2 flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-emerald-500" /> Location Details
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <DataPoint label="Residential Address" value={student.residential_address?.toString() || ""} />
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="bg-zinc-50/50 border rounded-xl p-5">
                                <h3 className="text-sm font-semibold text-zinc-900 mb-4 border-b pb-2 flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-rose-500" /> Financial Overview
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white border rounded-lg p-4">
                                        <p className="text-xs text-zinc-500 font-medium">Outstanding Balance</p>
                                        <p className={`text-xl font-bold mt-1 ${(student.total_outstanding_balance ?? 0) > 0 ? "text-rose-600" : "text-zinc-900"}`}>
                                            Rs. {(student.total_outstanding_balance ?? 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-white border rounded-lg p-4">
                                        <p className="text-xs text-zinc-500 font-medium">Advance Credit</p>
                                        <p className={`text-xl font-bold mt-1 ${(student.advance_credit_balance ?? 0) > 0 ? "text-emerald-600" : "text-zinc-900"}`}>
                                            Rs. {(student.advance_credit_balance ?? 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-zinc-50 p-4 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                    >
                        Close
                    </button>
                    <button className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-all shadow-sm">
                        Edit Profile
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
                {icon}
            </div>
            <div>
                <p className="text-xs text-zinc-500 font-medium">{label}</p>
                <p className="text-sm font-semibold text-zinc-900">{value}</p>
            </div>
        </div>
    );
}

function DataPoint({ label, value }: { label: string, value: string }) {
    return (
        <div>
            <p className="text-xs text-zinc-500 font-medium mb-1">{label}</p>
            <p className="text-sm font-semibold text-zinc-900">{value || "N/A"}</p>
        </div>
    );
}
