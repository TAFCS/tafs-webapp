"use client";

import { useState, useEffect } from "react";
import {
    Users,
    Loader2,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Hash,
    Home,
    Search,
    ChevronRight,
    UserPlus,
    UserCheck,
    X,
    Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Candidate {
    cc: number;
    full_name: string;
    campus_id: number;
    class_id: number;
    campuses: { campus_name: string };
    classes: { description: string };
    student_admissions: Array<{ requested_grade: string }>;
}

interface Suggestions {
    suggested_gr: string;
    suggested_house: number | null;
    suggested_section: number | null;
    all_houses: Array<{ id: number, house_name: string, house_color: string }>;
    available_sections: Array<{ id: number, description: string }>;
}

export default function EnrollmentsPage() {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [selectedStudent, setSelectedStudent] = useState<Candidate | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

    // Enrollment form state
    const [finalGr, setFinalGr] = useState("");
    const [finalHouseId, setFinalHouseId] = useState<number | "">("");
    const [finalSectionId, setFinalSectionId] = useState<number | "">("");
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [enrolledReport, setEnrolledReport] = useState<any>(null);

    useEffect(() => {
        fetchCandidates();
    }, []);

    const fetchCandidates = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get("/v1/enrollments/candidates");
            setCandidates(data.data || data); // Handle both nested and direct data
        } catch (error) {
            toast.error("Failed to fetch enrollment candidates");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartEnroll = async (student: Candidate) => {
        setSelectedStudent(student);
        setIsFetchingSuggestions(true);
        try {
            const { data } = await api.get(`/v1/enrollments/${student.cc}/suggestions`);
            const res = data.data || data;
            setSuggestions(res);
            setFinalGr(res.suggested_gr);
            setFinalHouseId(res.suggested_house || "");
            setFinalSectionId(res.suggested_section || "");
        } catch (error) {
            toast.error("Failed to fetch enrollment suggestions");
            setSelectedStudent(null);
        } finally {
            setIsFetchingSuggestions(false);
        }
    };

    const handleConfirmEnroll = async () => {
        if (!selectedStudent || !finalGr || !finalHouseId) {
            toast.error("Please provide GR number and House");
            return;
        }

        setIsEnrolling(true);
        try {
            const { data } = await api.post(`/v1/enrollments/${selectedStudent.cc}/enroll`, {
                gr_number: finalGr,
                house_id: Number(finalHouseId),
                section_id: finalSectionId ? Number(finalSectionId) : undefined
            });

            const res = data.data || data;
            setEnrolledReport(res);
            setShowSuccess(true);
            setCandidates(prev => prev.filter(c => c.cc !== selectedStudent.cc));
            setSelectedStudent(null);
            setSuggestions(null);
            toast.success("Student enrolled successfully!");
        } catch (error) {
            toast.error("Enrollment failed. Please try again.");
        } finally {
            setIsEnrolling(false);
        }
    };

    const filteredCandidates = candidates.filter(c =>
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cc.toString().includes(searchTerm)
    );

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden relative">
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
                        <UserPlus className="h-8 w-8 text-primary" />
                        Student Enrollments
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium max-w-md">
                        Formalize soft admissions by assigning permanent records, houses, and sections.
                    </p>
                </div>

                <div className="relative z-10 w-full md:w-80">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name or CC..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                        />
                    </div>
                </div>

                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>
            </div>

            {/* Candidates Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-zinc-100 dark:bg-zinc-900 rounded-3xl animate-pulse border border-zinc-200 dark:border-zinc-800" />
                    ))}
                </div>
            ) : filteredCandidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-950 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                    <div className="h-20 w-20 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-300 mb-6 group hover:scale-110 transition-transform">
                        <Users className="h-10 w-10" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">No Pending Enrollments</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm mx-auto font-medium">
                        {searchTerm ? "No candidates match your search." : "All students with soft admission have been processed!"}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {filteredCandidates.map((candidate) => (
                            <motion.div
                                key={candidate.cc}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.3 }}
                                className="group bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all overflow-hidden flex flex-col"
                            >
                                <div className="p-6 flex-1">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl group-hover:scale-110 transition-transform">
                                            {candidate.full_name.charAt(0)}
                                        </div>
                                        <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-100 dark:border-amber-900/30">
                                            Soft Admission
                                        </span>
                                    </div>

                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg group-hover:text-primary transition-colors line-clamp-1">
                                        {candidate.full_name}
                                    </h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-4">
                                        Candidate CC #{candidate.cc}
                                    </p>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-xs py-1.5 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                                            <Home className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="font-bold">{candidate.campuses?.campus_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-xs py-1.5 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                                            <CheckCircle className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="font-bold">{candidate.classes?.description}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleStartEnroll(candidate)}
                                    className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] group-hover:gap-4"
                                >
                                    PROCEED TO ENROLL
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Enrollment Modal */}
            <AnimatePresence>
                {selectedStudent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedStudent(null)}
                            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-[40px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-all"
                            >
                                <X className="h-6 w-6" />
                            </button>

                            {isFetchingSuggestions ? (
                                <div className="p-20 flex flex-col items-center justify-center">
                                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                                    <p className="text-zinc-500 font-bold">Computing Suggestions...</p>
                                </div>
                            ) : (
                                <div className="p-10">
                                    <div className="mb-8">
                                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Finalize Enrollment</h2>
                                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">For {selectedStudent.full_name}</p>
                                    </div>

                                    <div className="space-y-6">
                                        {/* GR Number Field */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between ml-1">
                                                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Assigned GR Number</label>
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">Recommended</span>
                                            </div>
                                            <div className="relative">
                                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                                                <input
                                                    type="text"
                                                    value={finalGr}
                                                    onChange={(e) => setFinalGr(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-black text-lg text-primary"
                                                />
                                            </div>
                                        </div>

                                        {/* House Selection */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-wider text-zinc-500 ml-1">Assigned House</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {suggestions?.all_houses.map(house => (
                                                    <button
                                                        key={house.id}
                                                        onClick={() => setFinalHouseId(house.id)}
                                                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left relative ${finalHouseId === house.id
                                                                ? 'border-primary bg-primary/5 text-primary'
                                                                : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
                                                            }`}
                                                    >
                                                        <div
                                                            className="w-4 h-4 rounded-full shadow-sm flex-shrink-0"
                                                            style={{ backgroundColor: house.house_color.toLowerCase() }}
                                                        />
                                                        <div>
                                                            <div className="text-xs font-black leading-none mb-1">{house.house_name}</div>
                                                            <div className="text-[10px] opacity-70 font-bold uppercase">{house.house_color}</div>
                                                        </div>
                                                        {suggestions?.suggested_house === house.id && (
                                                            <div className="absolute top-2 right-2 text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                                <Sparkles className="h-2 w-2 text-amber-500" />
                                                                REC.
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Section Selection */}
                                        <div className="space-y-2 text-left">
                                            <label className="text-xs font-black uppercase tracking-wider text-zinc-500 ml-1">Assign Section</label>
                                            <div className="relative">
                                                <select
                                                    value={finalSectionId}
                                                    onChange={(e) => setFinalSectionId(e.target.value === "" ? "" : Number(e.target.value))}
                                                    className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-black text-zinc-700 dark:text-zinc-300 appearance-none cursor-pointer"
                                                >
                                                    <option value="">Unassigned</option>
                                                    {suggestions?.available_sections.map(section => (
                                                        <option key={section.id} value={section.id}>
                                                            {section.description} {suggestions?.suggested_section === section.id ? '(Recommended)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                                    <ChevronRight className="h-5 w-5 rotate-90" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleConfirmEnroll}
                                        disabled={isEnrolling}
                                        className="w-full mt-10 py-5 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-3xl font-black text-base shadow-xl shadow-zinc-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-[0px] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isEnrolling ? <Loader2 className="h-6 w-6 animate-spin" /> : <UserCheck className="h-6 w-6" />}
                                        CONFIRM ENROLLMENT
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Success Modal */}
            <AnimatePresence>
                {showSuccess && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-primary/20 backdrop-blur-md"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="relative w-full max-w-sm bg-white dark:bg-zinc-950 rounded-[50px] shadow-2xl border-4 border-primary p-12 text-center"
                        >
                            <div className="h-24 w-24 bg-primary rounded-full flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-primary/30">
                                <CheckCircle className="h-12 w-12" />
                            </div>

                            <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">ENROLLED!</h2>
                            <p className="text-zinc-500 font-bold mb-8">Registration Complete for {enrolledReport?.full_name}</p>

                            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-[30px] p-6 space-y-4 mb-8 border border-zinc-100 dark:border-zinc-800">
                                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                                    <span className="text-zinc-400">GR Number</span>
                                    <span className="text-zinc-900 dark:text-zinc-100">{enrolledReport?.gr_number}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                                    <span className="text-zinc-400">House</span>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: enrolledReport?.houses?.house_color.toLowerCase() }}
                                        />
                                        <span className="text-zinc-900 dark:text-zinc-100">{enrolledReport?.houses?.house_name}</span>
                                    </div>
                                </div>
                                {enrolledReport?.sections && (
                                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                                        <span className="text-zinc-400">Section</span>
                                        <span className="text-zinc-900 dark:text-zinc-100">{enrolledReport?.sections?.description}</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setShowSuccess(false)}
                                className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                            >
                                CONTINUE
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
