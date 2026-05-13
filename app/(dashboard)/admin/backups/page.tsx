"use client";

import { useState, useEffect } from "react";
import { 
    Database, 
    Download, 
    RefreshCw, 
    Calendar, 
    Clock, 
    HardDrive, 
    ChevronRight, 
    AlertCircle,
    CheckCircle2,
    Loader2,
    FileArchive,
    Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import toast from "react-hot-toast";

interface Backup {
    key: string;
    fileName: string;
    size: number;
    lastModified: string;
}

const PKT_TIMEZONE = "Asia/Karachi";

export default function BackupsPage() {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTriggering, setIsTriggering] = useState(false);
    const [backupType, setBackupType] = useState<'sql' | 'json'>('sql');

    const fetchBackups = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get("/v1/backups");
            setBackups(data?.data || []);
        } catch (error: any) {
            toast.error("Failed to fetch backups list");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const handleTriggerBackup = async () => {
        setIsTriggering(true);
        const loadingToast = toast.loading(`Generating ${backupType.toUpperCase()} backup...`);
        try {
            // Increase timeout to 120s for database dumps
            await api.post(`/v1/backups/trigger?type=${backupType}`, {}, { timeout: 120000 });
            toast.success("Backup generated successfully", { id: loadingToast });
            fetchBackups();
        } catch (error: any) {
            toast.error("Backup failed: " + (error.response?.data?.message || "Unknown error"), { id: loadingToast });
        } finally {
            setIsTriggering(false);
        }
    };

    const handleDownload = async (key: string) => {
        const downloadToast = toast.loading("Preparing download...");
        try {
            // Fetch the file as a blob
            const response = await api.get(`/v1/backups/download/${key}`, {
                responseType: 'blob'
            });

            // Create a temporary URL for the blob
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            // Extract filename from key or use default
            const fileName = key.split('/').pop() || 'backup.sql.gz';
            link.setAttribute('download', fileName);
            
            // Append to body, click, and cleanup
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            toast.success("Download started", { id: downloadToast });
        } catch (error: any) {
            console.error("Download failed:", error);
            toast.error("Download failed: " + (error.response?.data?.message || "Unknown error"), { id: downloadToast });
        }
    };

    const handleDelete = async (key: string) => {
        if (!confirm("Are you sure you want to permanently delete this backup?")) return;
        
        const deleteToast = toast.loading("Deleting backup...");
        try {
            await api.delete(`/v1/backups/delete/${key}`);
            toast.success("Backup deleted successfully", { id: deleteToast });
            fetchBackups();
        } catch (error: any) {
            toast.error("Failed to delete backup: " + (error.response?.data?.message || "Unknown error"), { id: deleteToast });
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const formatPktDate = (dateStr: string) => {
        const date = toZonedTime(new Date(dateStr), PKT_TIMEZONE);
        return format(date, "MMM dd, yyyy");
    };

    const formatPktTime = (dateStr: string) => {
        const date = toZonedTime(new Date(dateStr), PKT_TIMEZONE);
        return format(date, "hh:mm a");
    };

    const groupBackups = (list: Backup[]) => {
        const groups: Record<string, { sql?: Backup; json?: Backup; lastModified: string }> = {};
        
        list.forEach(backup => {
            const match = backup.fileName.match(/TAFS_(?:SQL|JSON)_(.+?)\.(?:sql|json)\.gz/);
            const timestamp = match ? match[1] : backup.fileName;
            const type = backup.fileName.includes("SQL") ? "sql" : "json";
            
            if (!groups[timestamp]) {
                groups[timestamp] = { lastModified: backup.lastModified };
            }
            groups[timestamp][type] = backup;
        });
        
        return Object.entries(groups)
            .sort((a, b) => new Date(b[1].lastModified).getTime() - new Date(a[1].lastModified).getTime());
    };

    const backupGroups = groupBackups(backups);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl">
                            <Database className="h-6 w-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-zinc-900">Database Backups</h1>
                    </div>
                    <p className="text-zinc-500 text-sm font-medium pl-1">
                        Securely manage and download automated snapshots of your TAFCS database.
                    </p>
                </div>

                <button
                    onClick={handleTriggerBackup}
                    disabled={isTriggering}
                    className="flex items-center justify-center gap-2.5 px-8 py-3.5 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zinc-200"
                >
                    {isTriggering ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                    Generate Full Backup (SQL + JSON)
                </button>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: "Automatic Schedule", value: "12AM, 12PM, 4PM", icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Timezone", value: "Pakistan Time (PKT)", icon: Calendar, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Storage Location", value: "DigitalOcean Spaces", icon: HardDrive, color: "text-indigo-600", bg: "bg-indigo-50" },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-3xl border border-zinc-100 flex items-center gap-4">
                        <div className={`p-3 ${stat.bg} rounded-2xl`}>
                            <stat.icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</p>
                            <p className="text-sm font-black text-zinc-800">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Backups List */}
            <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/30">
                    <h2 className="font-black text-zinc-800 flex items-center gap-2">
                        Available Snapshots
                        <span className="px-2 py-0.5 bg-zinc-200 text-zinc-600 rounded-lg text-[10px] font-black uppercase">
                            {backupGroups.length} Sessions
                        </span>
                    </h2>
                    <button 
                        onClick={fetchBackups}
                        className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                </div>

                <div className="p-2">
                    {isLoading ? (
                        <div className="space-y-2 p-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-20 bg-zinc-50 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : backupGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="p-6 bg-zinc-50 rounded-[32px] border border-zinc-100 shadow-inner">
                                <Database className="h-10 w-10 text-zinc-200" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-zinc-700">No backups found</p>
                                <p className="text-sm text-zinc-400 max-w-[240px] mx-auto mt-1">
                                    Your automated backups will appear here once they are generated.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            <AnimatePresence mode="popLayout">
                                {backupGroups.map(([timestamp, group], idx) => (
                                    <motion.div
                                        key={timestamp}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group flex flex-col md:flex-row md:items-center justify-between p-5 bg-white hover:bg-zinc-50 border border-transparent hover:border-zinc-100 rounded-[28px] transition-all gap-4"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="p-4 bg-zinc-100 group-hover:bg-primary/10 rounded-2xl transition-colors">
                                                <FileArchive className="h-7 w-7 text-zinc-400 group-hover:text-primary transition-colors" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-zinc-800 text-base">Backup Session {timestamp.split('_')[1]}</p>
                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black uppercase">Complete Set</span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
                                                        <Calendar className="h-3 w-3" /> {formatPktDate(group.lastModified)}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
                                                        <Clock className="h-3 w-3" /> {formatPktTime(group.lastModified)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {group.sql && (
                                                <button
                                                    onClick={() => handleDownload(group.sql!.key)}
                                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl font-bold text-[11px] hover:bg-zinc-800 transition-all shadow-sm active:scale-[0.97]"
                                                >
                                                    <Download className="h-3 w-3" />
                                                    DOWNLOAD SQL
                                                    <span className="text-[9px] opacity-60 ml-1">({formatFileSize(group.sql.size)})</span>
                                                </button>
                                            )}
                                            {group.json && (
                                                <button
                                                    onClick={() => handleDownload(group.json!.key)}
                                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-xl font-bold text-[11px] hover:bg-zinc-50 transition-all shadow-sm active:scale-[0.97]"
                                                >
                                                    <Download className="h-3 w-3" />
                                                    DOWNLOAD JSON
                                                    <span className="text-[9px] text-zinc-400 ml-1">({formatFileSize(group.json.size)})</span>
                                                </button>
                                            )}
                                            <div className="w-px h-8 bg-zinc-200 mx-2 hidden md:block" />
                                            <button
                                                onClick={() => {
                                                    if (group.sql) handleDelete(group.sql.key);
                                                    if (group.json) setTimeout(() => handleDelete(group.json!.key), 500);
                                                }}
                                                className="p-2.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Delete all files for this session"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>

            {/* Storage Warning/Note */}
            <div className="bg-amber-50 border border-amber-100 p-6 rounded-[32px] flex items-start gap-4">
                <div className="p-2 bg-amber-100 rounded-xl">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                    <h3 className="font-black text-amber-900 text-sm">Data Retention Policy</h3>
                    <p className="text-amber-700/80 text-[13px] mt-0.5 leading-relaxed">
                        Backups are kept for 30 days. For long-term archival, please download and store them in a secure physical location.
                        All backups are encrypted at rest on our storage servers.
                    </p>
                </div>
            </div>
        </div>
    );
}
