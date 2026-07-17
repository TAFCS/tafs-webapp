"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parentChangeRequestsService } from "@/lib/parent-change-requests.service";
import { 
    Check, X, Eye, ArrowRight, User, Phone, Mail, 
    Badge, Briefcase, MapPin, School, Building2,
    Clock, History, ClipboardCheck, AlertCircle,
    Search, Filter, MoreVertical, ExternalLink,
    Camera, Calendar
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

export default function ParentChangeRequestsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionComment, setRejectionComment] = useState("");
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const data = await parentChangeRequestsService.listRequests();
            setRequests(data);
        } catch (error) {
            toast.error("Failed to fetch change requests");
        } finally {
            setLoading(false);
        }
    };

    const handleProcess = async (id: number, status: 'APPROVED' | 'REJECTED') => {
        try {
            setIsProcessing(true);
            await parentChangeRequestsService.processRequest(id, { 
                status, 
                comment: status === 'REJECTED' ? rejectionComment : undefined 
            });
            toast.success(`Request ${status.toLowerCase()} successfully`);
            setSelectedRequest(null);
            setShowRejectionModal(false);
            setRejectionComment("");
            fetchRequests();
        } catch (error) {
            toast.error(`Failed to ${status.toLowerCase()} request`);
        } finally {
            setIsProcessing(false);
        }
    };

    const pendingRequests = requests.filter(r => r.status === 'PENDING' && 
        (r.guardians?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
         r.families?.household_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    const historyRequests = requests.filter(r => r.status !== 'PENDING' && 
        (r.guardians?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
         r.families?.household_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const isAccountDeletionRequest = (req: any) =>
        req?.requested_data?.request_type === 'ACCOUNT_DELETION';

    const isStudentUpdateRequest = (req: any) =>
        req?.requested_data?.request_type === 'STUDENT_UPDATE';

    const formatLabel = (key: string) => {
        if (key === 'request_type') return 'Request Type';
        return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const getFieldIcon = (key: string) => {
        switch (key) {
            case 'primary_phone': return <Phone className="h-4 w-4" />;
            case 'whatsapp_number': return <Phone className="h-4 w-4 text-green-500" />;
            case 'email_address': return <Mail className="h-4 w-4" />;
            case 'cnic': return <Badge className="h-4 w-4" />;
            case 'occupation': return <Briefcase className="h-4 w-4" />;
            case 'job_position': return <User className="h-4 w-4" />;
            case 'organization': return <Building2 className="h-4 w-4" />;
            case 'education_level': return <School className="h-4 w-4" />;
            case 'mailing_address': return <MapPin className="h-4 w-4" />;
            case 'photograph_url':
            case 'photo_url':
            case 'photo_blue_bg_url': return <Camera className="h-4 w-4" />;
            case 'dob': return <Calendar className="h-4 w-4" />;
            default: return <User className="h-4 w-4" />;
        }
    };

    return (
        <div className="flex-1 h-[calc(100vh-64px)] flex flex-col p-4 md:p-8 overflow-hidden bg-zinc-50 dark:bg-zinc-900">
            {/* Header Area */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <ClipboardCheck className="h-8 w-8 text-primary" />
                        Parent Change Requests
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 font-medium italic">
                        Reviewing and syncing mobile app profile updates
                    </p>
                </div>
                
                {/* Stats */}
                <div className="flex gap-4">
                    <div className="px-6 py-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col min-w-[120px]">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Pending</span>
                        <span className="text-2xl font-black text-primary">{requests.filter(r => r.status === 'PENDING').length}</span>
                    </div>
                    <div className="px-6 py-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col min-w-[120px]">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">History</span>
                        <span className="text-2xl font-black text-emerald-500">{requests.filter(r => r.status !== 'PENDING').length}</span>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="mb-6 flex flex-col md:flex-row items-center gap-4 bg-white/50 dark:bg-zinc-950/50 p-2 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 backdrop-blur-md">
                {/* Tabs */}
                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white dark:bg-zinc-800 text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        Pending Requests
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-zinc-800 text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        History
                    </button>
                </div>

                {/* Search */}
                <div className="flex-1 relative w-full md:w-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input 
                        type="text"
                        placeholder="Search by guardian or family name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-medium"
                    />
                </div>

                {/* Refresh Button */}
                <button 
                    onClick={fetchRequests}
                    disabled={loading}
                    className="p-2.5 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    title="Refresh data"
                >
                    <motion.div
                        animate={loading ? { rotate: 360 } : {}}
                        transition={loading ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}
                    >
                        <History className={`h-5 w-5 ${loading ? 'text-primary' : 'text-zinc-500'}`} />
                    </motion.div>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1"
                    >
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-md z-10 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-zinc-400">Guardian / Family</th>
                                    <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-zinc-400">Proposed Changes</th>
                                    <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-zinc-400">Timeline</th>
                                    <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-zinc-400">Status</th>
                                    <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-zinc-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                                            <span className="text-zinc-500 font-medium">Fetching secure data...</span>
                                        </td>
                                    </tr>
                                ) : (activeTab === 'pending' ? pendingRequests : historyRequests).length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-zinc-300">
                                                <AlertCircle className="h-8 w-8" />
                                            </div>
                                            <span className="text-zinc-500 font-medium">No {activeTab} requests found matching your search.</span>
                                        </td>
                                    </tr>
                                ) : (activeTab === 'pending' ? pendingRequests : historyRequests).map((req) => (
                                    <tr key={req.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-all duration-300">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg border border-primary/20 group-hover:scale-110 transition-transform">
                                                    {req.guardians?.full_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-black text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">{req.guardians?.full_name}</div>
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {req.families?.students?.length > 0 ? (
                                                            req.families.students.map((s: any) => (
                                                                <span key={s.cc} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-black text-zinc-600 dark:text-zinc-300">
                                                                    <School className="h-2.5 w-2.5 text-primary" />
                                                                    CC {s.cc}
                                                                    {s.gr_number && (
                                                                        <span className="text-zinc-400 dark:text-zinc-500 font-bold">· GR {s.gr_number}</span>
                                                                    )}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-[10px] text-zinc-400 font-medium">{req.families?.household_name || 'No students'}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {isAccountDeletionRequest(req) ? (
                                                <div>
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/50 text-[11px] font-black text-rose-700 dark:text-rose-300 shadow-sm uppercase tracking-wide">
                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                        Account Deletion
                                                    </span>
                                                    {req.requested_data?.reason && (
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 italic max-w-xs truncate">
                                                            {req.requested_data.reason}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : isStudentUpdateRequest(req) ? (
                                                <div className="flex gap-2 flex-wrap max-w-md">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 text-[11px] font-black text-blue-700 dark:text-blue-300 shadow-sm uppercase tracking-wide">
                                                        <User className="h-3.5 w-3.5" />
                                                        Student Update
                                                    </span>
                                                    {req.requested_data.changes && Object.keys(req.requested_data.changes).map((key) => (
                                                        <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 shadow-sm">
                                                            {getFieldIcon(key)}
                                                            {formatLabel(key)}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex gap-2 flex-wrap max-w-md">
                                                    {req.requested_data && Object.entries(req.requested_data)
                                                        .filter(([key, newValue]) => {
                                                            const currentValue = req.guardians?.[key];
                                                            const normCurrent = (currentValue || '').trim();
                                                            const normNew = (String(newValue) || '').trim();
                                                            
                                                            if (normCurrent === normNew) return false;
                                                            if (normCurrent === '' && normNew === '+92') return false;
                                                            return true;
                                                        })
                                                        .map(([key, newValue]) => (
                                                            <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 shadow-sm">
                                                                {getFieldIcon(key)}
                                                                {formatLabel(key)}
                                                            </span>
                                                        ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                                                    {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-medium mt-1">
                                                    {new Date(req.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                req.status === 'PENDING' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                                req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                                            }`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${
                                                    req.status === 'PENDING' ? 'bg-amber-500' :
                                                    req.status === 'APPROVED' ? 'bg-emerald-500' :
                                                    'bg-rose-500'
                                                }`} />
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button 
                                                onClick={() => setSelectedRequest(req)}
                                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black text-primary hover:bg-primary/10 rounded-xl transition-all hover:gap-3 group/btn"
                                            >
                                                {req.status === 'PENDING' ? 'Review' : 'View Details'}
                                                <ArrowRight className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Review Modal */}
            <AnimatePresence>
                {selectedRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedRequest(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                                                {isAccountDeletionRequest(selectedRequest) ? 'Review Account Deletion' : 'Review Changes'}
                                            </h3>
                                            <span className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                selectedRequest.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                                                selectedRequest.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 
                                                'bg-rose-100 text-rose-700'
                                            }`}>
                                                {selectedRequest.status}
                                            </span>
                                        </div>
                                        <p className="text-zinc-500 dark:text-zinc-400 font-medium italic mb-4">
                                            Requested by {selectedRequest.guardians?.full_name}
                                        </p>

                                        {/* Student Roster */}
                                        {selectedRequest.families?.students?.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {selectedRequest.families.students.map((s: any) => (
                                                    <button
                                                        key={s.cc}
                                                        onClick={() => {
                                                            setSelectedRequest(null);
                                                            router.push(`/identity/students?cc=${s.cc}`);
                                                        }}
                                                        className="group flex items-center gap-2.5 pl-1 pr-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer"
                                                        title={`Open ${s.full_name ?? 'student'} in Student Directory`}
                                                    >
                                                        {/* Avatar */}
                                                        <div className="h-7 w-7 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 flex items-center justify-center text-primary font-black text-xs shrink-0 transition-colors">
                                                            {s.full_name?.charAt(0) ?? '?'}
                                                        </div>
                                                        {/* Name */}
                                                        <span className="text-sm font-black text-zinc-800 dark:text-zinc-100 group-hover:text-primary max-w-[140px] truncate transition-colors">
                                                            {s.full_name ?? 'Unknown'}
                                                        </span>
                                                        {/* Divider */}
                                                        <span className="text-zinc-300 dark:text-zinc-600 text-xs">|</span>
                                                        {/* CC */}
                                                        <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                                                            CC <span className="text-primary font-black">{s.cc}</span>
                                                        </span>
                                                        {/* GR — only if present */}
                                                        {s.gr_number && (
                                                            <>
                                                                <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
                                                                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                                                                    GR <span className="text-zinc-700 dark:text-zinc-300 font-black">{s.gr_number}</span>
                                                                </span>
                                                            </>
                                                        )}
                                                        {/* External link hint */}
                                                        <ExternalLink className="h-3 w-3 text-zinc-300 group-hover:text-primary transition-colors shrink-0" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => setSelectedRequest(null)} className="ml-4 shrink-0 p-3 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-2xl transition-colors">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-auto p-8">
                                {/* Comment if rejected */}
                                {selectedRequest.comment && (
                                    <div className="mb-8 p-6 bg-rose-50 dark:bg-rose-900/20 rounded-3xl border border-rose-100 dark:border-rose-900/50 flex gap-4 items-start">
                                        <AlertCircle className="h-6 w-6 text-rose-500 shrink-0" />
                                        <div>
                                            <div className="font-black text-rose-900 dark:text-rose-300 text-sm uppercase tracking-wider mb-1">Rejection Comment</div>
                                            <p className="text-rose-700 dark:text-rose-400 font-medium">{selectedRequest.comment}</p>
                                        </div>
                                    </div>
                                )}

                                {isAccountDeletionRequest(selectedRequest) ? (
                                    <div className="p-8 rounded-[2rem] border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20">
                                        <div className="flex items-start gap-4">
                                            <AlertCircle className="h-8 w-8 text-rose-500 shrink-0" />
                                            <div>
                                                <div className="text-lg font-black text-rose-900 dark:text-rose-200 mb-2">
                                                    Permanent account deletion requested
                                                </div>
                                                <p className="text-rose-800 dark:text-rose-300 font-medium leading-relaxed">
                                                    Approving this request will permanently delete the parent app account,
                                                    revoke access tokens, and remove linked mobile credentials for{' '}
                                                    <span className="font-black">{selectedRequest.guardians?.full_name}</span>.
                                                    This action cannot be undone.
                                                </p>
                                                {selectedRequest.requested_data?.reason && (
                                                    <p className="text-sm text-rose-700 dark:text-rose-300 mt-3 italic">
                                                        <span className="font-semibold not-italic">Reason:</span> {selectedRequest.requested_data.reason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : isStudentUpdateRequest(selectedRequest) ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="mb-4 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-900/50 flex gap-4 items-center">
                                            <User className="h-8 w-8 text-blue-500 shrink-0" />
                                            <div>
                                                <div className="font-black text-blue-950 dark:text-blue-300 text-sm uppercase tracking-wider mb-1">
                                                    Student Target
                                                </div>
                                                <p className="text-blue-800 dark:text-blue-450 font-black">
                                                    {(() => {
                                                        const student = selectedRequest.families?.students?.find(
                                                            (s: any) => s.cc === Number(selectedRequest.requested_data.student_cc)
                                                        );
                                                        return student ? `${student.full_name} (CC: ${student.cc})` : `CC: ${selectedRequest.requested_data.student_cc}`;
                                                    })()}
                                                </p>
                                            </div>
                                        </div>

                                        {(() => {
                                            const student = selectedRequest.families?.students?.find(
                                                (s: any) => s.cc === Number(selectedRequest.requested_data.student_cc)
                                            );
                                            const changes = selectedRequest.requested_data.changes || {};

                                            return Object.entries(changes).map(([key, newValue]) => {
                                                const currentValue = student?.[key];
                                                const isChanged = String(currentValue || '') !== String(newValue || '');

                                                return (
                                                    <div key={key} className={`p-6 rounded-[2rem] border transition-all duration-500 ${isChanged ? 'bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-900/50 shadow-lg shadow-amber-500/5' : 'bg-zinc-50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800'}`}>
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-xl ${isChanged ? 'bg-amber-100 text-amber-600' : 'bg-zinc-200 text-zinc-500'} transition-colors`}>
                                                                    {getFieldIcon(key)}
                                                                </div>
                                                                <span className="text-lg font-black text-zinc-800 dark:text-zinc-200">{formatLabel(key)}</span>
                                                            </div>
                                                            {isChanged && <span className="text-[10px] px-3 py-1 bg-amber-500 text-white rounded-full font-black shadow-lg shadow-amber-500/30 animate-pulse">CHANGED</span>}
                                                        </div>
                                                        
                                                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6">
                                                            <div className="flex-1 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-900">
                                                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Original Data</div>
                                                                <div className="text-sm font-bold text-zinc-500 dark:text-zinc-400 break-all">
                                                                    {(key === 'photograph_url' || key === 'photo_url') && currentValue && String(currentValue).startsWith('http') ? (
                                                                        <img src={currentValue} className="h-20 w-20 object-cover rounded-2xl border border-zinc-200 dark:border-zinc-800" />
                                                                    ) : String(currentValue || 'N/A')}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                                                                <ArrowRight className="h-6 w-6 mx-2" />
                                                            </div>
                                                            <div className="flex-1 p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10">
                                                                <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Requested Update</div>
                                                                <div className="text-sm font-black text-zinc-900 dark:text-zinc-100 break-all">
                                                                    {(key === 'photograph_url' || key === 'photo_url') && newValue && String(newValue).startsWith('http') ? (
                                                                        <img src={newValue as string} className="h-20 w-20 object-cover rounded-2xl border border-zinc-200 dark:border-zinc-800" />
                                                                    ) : String(newValue || 'N/A')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {selectedRequest.requested_data && Object.entries(selectedRequest.requested_data)
                                        .filter(([key, newValue]) => {
                                            const currentValue = selectedRequest.guardians?.[key];
                                            const normCurrent = (currentValue || '').trim();
                                            const normNew = (String(newValue) || '').trim();
                                            
                                            if (normCurrent === normNew) return false;
                                            if (normCurrent === '' && normNew === '+92') return false;
                                            return true;
                                        })
                                        .map(([key, newValue]) => {
                                            const currentValue = selectedRequest.guardians?.[key];
                                            const isChanged = (currentValue || '') !== (newValue || '');

                                            return (
                                                <div key={key} className={`p-6 rounded-[2rem] border transition-all duration-500 ${isChanged ? 'bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-900/50 shadow-lg shadow-amber-500/5' : 'bg-zinc-50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800'}`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-xl ${isChanged ? 'bg-amber-100 text-amber-600' : 'bg-zinc-200 text-zinc-500'} transition-colors`}>
                                                            {getFieldIcon(key)}
                                                        </div>
                                                        <span className="text-lg font-black text-zinc-800 dark:text-zinc-200">{formatLabel(key)}</span>
                                                    </div>
                                                    {isChanged && <span className="text-[10px] px-3 py-1 bg-amber-500 text-white rounded-full font-black shadow-lg shadow-amber-500/30 animate-pulse">CHANGED</span>}
                                                </div>
                                                
                                                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6">
                                                    <div className="flex-1 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-900">
                                                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Original Data</div>
                                                        <div className="text-sm font-bold text-zinc-500 dark:text-zinc-400 break-all">
                                                            {key === 'photo_url' && currentValue && String(currentValue).startsWith('http') ? (
                                                                <img src={currentValue} className="h-20 w-20 object-cover rounded-2xl border border-zinc-200 dark:border-zinc-800" />
                                                            ) : String(currentValue || 'N/A')}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                                                        <div className="h-px w-8 bg-zinc-200 dark:bg-zinc-800 hidden md:block" />
                                                        <ArrowRight className="h-6 w-6 mx-2" />
                                                        <div className="h-px w-8 bg-zinc-200 dark:bg-zinc-800 hidden md:block" />
                                                    </div>
                                                    <div className="flex-1 p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10">
                                                        <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Requested Update</div>
                                                        <div className="text-sm font-black text-zinc-900 dark:text-zinc-100 break-all">
                                                            {key === 'photo_url' && newValue && String(newValue).startsWith('http') ? (
                                                                <img src={newValue as string} className="h-20 w-20 object-cover rounded-2xl border border-zinc-200 dark:border-zinc-800" />
                                                            ) : String(newValue || 'N/A')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            );
                                        })}
                                </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            {selectedRequest.status === 'PENDING' ? (
                                <div className="p-8 border-t border-zinc-100 dark:border-zinc-900 flex justify-end gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => setShowRejectionModal(true)}
                                        className="px-8 py-4 rounded-2xl border-2 border-rose-200 dark:border-rose-900/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 font-black transition-all disabled:opacity-50 active:scale-95"
                                    >
                                        {isAccountDeletionRequest(selectedRequest) ? 'Reject Request' : 'Reject Changes'}
                                    </button>
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleProcess(selectedRequest.id, 'APPROVED')}
                                        className={`px-10 py-4 rounded-2xl font-black shadow-xl transition-all disabled:opacity-50 active:scale-95 flex items-center gap-3 ${
                                            isAccountDeletionRequest(selectedRequest)
                                                ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-500/30'
                                                : 'bg-primary text-white hover:bg-primary/90 shadow-primary/30'
                                        }`}
                                    >
                                        {isProcessing ? (
                                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                        ) : <Check className="h-5 w-5" />}
                                        {isAccountDeletionRequest(selectedRequest)
                                            ? 'Approve & Delete Account'
                                            : 'Approve & Sync Profile'}
                                    </button>
                                </div>
                            ) : (
                                <div className="p-8 border-t border-zinc-100 dark:border-zinc-900 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50 text-sm font-bold text-zinc-500">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        Processed by {selectedRequest.processor?.full_name || 'Admin'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        {new Date(selectedRequest.processed_at || selectedRequest.updated_at).toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Rejection Comment Modal */}
            <AnimatePresence>
                {showRejectionModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative bg-white dark:bg-zinc-950 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-8"
                        >
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-2">Reason for Rejection</h3>
                            <p className="text-sm text-zinc-500 font-medium mb-6">This feedback will be sent back to the parent to help them fix the profile data.</p>
                            
                            <textarea 
                                value={rejectionComment}
                                onChange={(e) => setRejectionComment(e.target.value)}
                                placeholder="e.g. Please provide a clear CNIC photo or correct your organization name..."
                                className="w-full h-40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none shadow-inner"
                            />
                            
                            <div className="flex justify-end gap-3 mt-8">
                                <button 
                                    onClick={() => setShowRejectionModal(false)}
                                    className="px-6 py-3 text-sm font-black text-zinc-400 hover:text-zinc-600 transition-colors"
                                >
                                    Go Back
                                </button>
                                <button 
                                    disabled={isProcessing || !rejectionComment.trim()}
                                    onClick={() => handleProcess(selectedRequest.id, 'REJECTED')}
                                    className="px-8 py-3 rounded-xl bg-rose-600 text-white hover:bg-rose-700 font-black transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-rose-500/30"
                                >
                                    {isProcessing ? 'Processing...' : 'Confirm Rejection'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
