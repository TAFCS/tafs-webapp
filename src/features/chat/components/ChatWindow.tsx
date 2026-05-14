"use client";

import { Send, Image, Mic, MoreVertical, User, Loader2, FileText, X, ChevronDown, Trash2, Megaphone, ShieldCheck, Globe, Download, Reply, WifiOff, RefreshCcw, Check, CheckCheck } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import api from "@/lib/api";
import { AnnouncementSelectors } from "./AnnouncementSelectors";
import { useSocket } from "@/context/SocketContext";

interface ChatWindowProps {
    familyId: number | null;
    activeConversation?: any;
    messages: any[];
    onSendMessage: (content: string, type: "TEXT" | "IMAGE" | "VOICE" | "DOCUMENT", mediaMetadata?: any, announcementTarget?: { grade: string | null, section: string | null }) => void;
    onUnsend: (messageId: string) => void;
    isConnected: boolean;
    isParentOnline?: boolean;
    isLoading?: boolean;
}

export const ChatWindow = ({ familyId, activeConversation, messages, onSendMessage, onUnsend, isConnected, isParentOnline, isLoading }: ChatWindowProps) => {
    const { socket } = useSocket();
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [pendingFiles, setPendingFiles] = useState<{ file: File, preview: string, type: "IMAGE" | "DOCUMENT" }[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showStudentDetails, setShowStudentDetails] = useState(false);
    const [familyStudents, setFamilyStudents] = useState<any[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [activeMentions, setActiveMentions] = useState<Array<{name: string, cc: string}>>([]);
    const [mentionIndex, setMentionIndex] = useState(0);
    
    const [targetGrade, setTargetGrade] = useState<string | null>(null);
    const [targetSection, setTargetSection] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<any>(null);

    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const shouldSend = useRef(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    const isAnnouncementChannel = familyId === 0;

    const fetchFamilyStudents = async (showModal = true) => {
        if (!familyId || familyId === 0) return;
        setIsLoadingStudents(true);
        try {
            const res = await api.get(`v1/chat/family/${familyId}/students`);
            setFamilyStudents(res.data);
            if (showModal) setShowStudentDetails(true);
        } catch (err) {
            console.error("Failed to fetch family students:", err);
        } finally {
            setIsLoadingStudents(false);
        }
    };

    const handleFileSelect = (file: File, type: "IMAGE" | "DOCUMENT") => {
        const preview = URL.createObjectURL(file);
        setPendingFiles(prev => [...prev, { file, preview, type }]);
    };

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => {
            const newFiles = [...prev];
            URL.revokeObjectURL(newFiles[index].preview);
            newFiles.splice(index, 1);
            return newFiles;
        });
    };

    const uploadAndSendPending = async (caption?: string, existingMetadata?: any) => {
        const batchId = Date.now().toString();
        const filesToUpload = [...pendingFiles];
        setPendingFiles([]);

        for (let i = 0; i < filesToUpload.length; i++) {
            const item = filesToUpload[i];
            const formData = new FormData();
            formData.append('file', item.file);

            try {
                const response = await api.post('/v1/chat/media', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (response.data.url) {
                    const metadata = { 
                        url: response.data.url,
                        batchId,
                        caption: i === 0 ? caption : undefined,
                        ...existingMetadata
                    };
                    onSendMessage(response.data.url, item.type, metadata, isAnnouncementChannel ? { grade: targetGrade, section: targetSection } : undefined);
                }
            } catch (err) {
                console.error("Failed to upload pending file:", err);
            } finally {
                URL.revokeObjectURL(item.preview);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
            const type = file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT';
            handleFileSelect(file, type);
        });
    };

    const prevMessagesLength = useRef(messages.length);
    useEffect(() => {
        if (scrollRef.current && messages.length > prevMessagesLength.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        prevMessagesLength.current = messages.length;
    }, [messages]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
            mediaRecorder.current = new MediaRecorder(stream, { mimeType });
            audioChunks.current = [];
            shouldSend.current = true;
            mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
            mediaRecorder.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/mp4' });
                const audioFile = new File([audioBlob], `voice_${Date.now()}.m4a`, { type: 'audio/mp4' });
                
                if (shouldSend.current) {
                    // Send directly to avoid state race condition
                    const formData = new FormData();
                    formData.append('file', audioFile);
                    try {
                        const response = await api.post('/v1/chat/media', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        if (response.data.url) {
                            onSendMessage(response.data.url, "VOICE", { url: response.data.url, duration: recordingTime }, isAnnouncementChannel ? { grade: targetGrade, section: targetSection } : undefined);
                        }
                    } catch (err) {
                        console.error("Failed to upload voice note:", err);
                    }
                }
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err) { console.error("Mic access denied:", err); }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleInputChange = (val: string) => {
        setInput(val);
        
        const lastAtPos = val.lastIndexOf("@");
        if (lastAtPos !== -1) {
            const afterAt = val.slice(lastAtPos + 1);
            // Check if there's a space after @, if so, stop mentioning
            if (afterAt.includes(" ")) {
                setShowMentions(false);
            } else {
                setMentionSearch(afterAt.toLowerCase());
                setShowMentions(true);
                setMentionIndex(0);
                if (familyStudents.length === 0) fetchFamilyStudents(false);
            }
        } else {
            setShowMentions(false);
        }
    };

    const insertMention = (student: any) => {
        const lastAtPos = input.lastIndexOf("@");
        const beforeAt = input.slice(0, lastAtPos);
        const name = student.full_name;
        
        const newText = beforeAt + "@" + name + " ";
        setInput(newText);
        setActiveMentions(prev => [...prev, { name, cc: student.cc }]);
        setShowMentions(false);
        setMentionSearch("");
    };

    const handleSend = () => {
        if (!input.trim() && !pendingFiles.length) return;

        let contentToSend = input;
        
        // Translate visual @Names back to technical tags
        activeMentions.forEach(mention => {
            const regex = new RegExp(`@${mention.name}`, 'g');
            contentToSend = contentToSend.replace(regex, `@[${mention.name}](student:${mention.cc})`);
        });

        const metadata: any = {};
        if (replyingTo) {
            metadata.replyTo = {
                id: replyingTo.id,
                content: replyingTo.content,
                senderName: replyingTo.sender_type === "ADMIN" ? "You" : (replyingTo.sender_name || "Parent"),
                type: replyingTo.message_type
            };
        }

        if (pendingFiles.length > 0) {
            uploadAndSendPending(contentToSend.trim(), metadata);
            setInput("");
            setActiveMentions([]);
            setReplyingTo(null);
        } else if (input.trim()) {
            onSendMessage(contentToSend.trim(), "TEXT", metadata, isAnnouncementChannel ? { grade: targetGrade, section: targetSection } : undefined);
            setInput("");
            setActiveMentions([]);
            setReplyingTo(null);
        }
    };

    const filteredMentionStudents = familyStudents.filter(s => 
        s.full_name.toLowerCase().includes(mentionSearch) || 
        s.cc.toString().includes(mentionSearch)
    );

    const renderMessageContent = (content: string, isMe: boolean) => {
        const parts = content.split(/(@\[.*?\]\(student:\d+\))/g);
        return parts.map((part, i) => {
            const match = part.match(/@\[(.*?)\]\(student:(\d+)\)/);
            if (match) {
                return (
                    <span key={i} className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-black text-[11px] mx-0.5 shadow-sm ${isMe ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                        @{match[1]}
                    </span>
                );
            }
            return part;
        });
    };

    const clusters = useMemo(() => {
        const results: any[] = [];
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (msg.message_type === "IMAGE") {
                const group = [msg];
                while (
                    i + 1 < messages.length && 
                    messages[i + 1].message_type === "IMAGE" && 
                    messages[i + 1].sender_type === msg.sender_type &&
                    messages[i + 1].media_metadata?.batchId === msg.media_metadata?.batchId &&
                    msg.media_metadata?.batchId !== undefined
                ) {
                    group.push(messages[i+1]);
                    i++;
                }
                results.push({ type: "IMAGE_GROUP", messages: group, sender_type: msg.sender_type, id: msg.id, created_at: msg.created_at, is_announcement: msg.is_announcement, sender_name: msg.sender_name, target_grade: msg.target_grade, target_section: msg.target_section });
            } else {
                results.push(msg);
            }
        }
        return results;
    }, [messages]);

    if (familyId === null) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950/50">
                <div className="h-24 w-24 rounded-3xl bg-white dark:bg-zinc-900 flex items-center justify-center mb-6 shadow-2xl shadow-primary/10 rotate-3 animate-bounce-subtle">
                    <Send className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Your Inbox is Waiting</h3>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-[260px] text-center mt-2 text-sm leading-relaxed">Select a conversation or start an announcement to begin.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 relative bg-zinc-50 dark:bg-zinc-900/10" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {/* Header */}
            <div className="h-20 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-8 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner ${isAnnouncementChannel ? "bg-primary" : "bg-zinc-100 dark:bg-zinc-900"}`}>
                        {isAnnouncementChannel ? (
                            <Megaphone className="h-6 w-6 text-white" />
                        ) : activeConversation?.primary_guardian?.photo_url ? (
                            <img src={activeConversation.primary_guardian.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <User className="h-6 w-6 text-zinc-500" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
                            {isAnnouncementChannel ? "Official Announcements" : activeConversation?.primary_guardian?.name || activeConversation?.families?.household_name || "Family Chat"}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            {!isAnnouncementChannel && (
                                <>
                                    <div className={`h-1.5 w-1.5 rounded-full ${isParentOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" : "bg-zinc-400"}`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isParentOnline ? "text-green-600 dark:text-green-400" : "text-zinc-500"}`}>
                                        {isParentOnline ? "Online Now" : "Offline"}
                                    </span>
                                </>
                            )}
                            {isAnnouncementChannel && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Official Channel</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="hidden lg:flex flex-col items-end">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">System Link</span>
                            <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-blue-500" : "bg-red-500"} shadow-sm`} />
                        </div>
                        <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter mt-0.5">{isConnected ? "Verified" : "Sync Error"}</p>
                    </div>
                    {!isAnnouncementChannel && (
                        <button onClick={fetchFamilyStudents} disabled={isLoadingStudents} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-400 hover:text-primary flex items-center gap-2">
                            {isLoadingStudents ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Family Info</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Announcement Selectors */}
            {isAnnouncementChannel && (
                <AnnouncementSelectors onFilterChange={(g, s) => { setTargetGrade(g); setTargetSection(s); }} />
            )}

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 pr-12 flex flex-col gap-4 no-scrollbar relative">
                {/* Offline Banner */}
                <AnimatePresence>
                    {!isConnected && (
                        <motion.div 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="sticky top-0 z-30 flex items-center justify-center mb-6"
                        >
                            <div className="bg-red-500/10 backdrop-blur-md border border-red-500/20 px-6 py-2.5 rounded-2xl flex items-center gap-3 shadow-xl">
                                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
                                    Connection Lost. Reconnecting...
                                </span>
                                <button 
                                    onClick={() => window.location.reload()} 
                                    className="p-1.5 hover:bg-red-500/10 rounded-lg transition-all text-red-600 dark:text-red-400"
                                >
                                    <RefreshCcw className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Background Watermark */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                    <img 
                        src="/logo.png" 
                        alt="Watermark" 
                        className="w-[60%] opacity-[0.05] grayscale dark:invert"
                    />
                </div>
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-500">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="mt-4 text-xs font-black uppercase tracking-widest text-zinc-500">Synchronizing history...</p>
                    </div>
                )}
                
                {!isLoading && clusters.map((cluster, idx) => {
                    const isMe = cluster.sender_type === "ADMIN";
                    const isAnnouncement = cluster.is_announcement;
                    const isGroup = cluster.type === "IMAGE_GROUP";
                    const clusterMessages = isGroup ? cluster.messages : [cluster];
                    const firstMsg = clusterMessages[0];

                    const msgDate = new Date(firstMsg.created_at);
                    const prevMsg = idx > 0 ? (clusters[idx - 1].messages ? clusters[idx - 1].messages[0] : clusters[idx - 1]) : null;
                    const prevDate = prevMsg ? new Date(prevMsg.created_at) : null;
                    
                    const showDateSeparator = !prevDate || !isSameDay(msgDate, prevDate);

                    const formatDateHeader = (date: Date) => {
                        const now = new Date();
                        if (isSameDay(date, now)) return "Today";
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        if (isSameDay(date, yesterday)) return "Yesterday";
                        return format(date, "MMMM d, yyyy");
                    };

                    return (
                        <div key={cluster.id || idx}>
                            {showDateSeparator && (
                                <div className="flex justify-center my-6 relative">
                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                        <div className="w-full border-t border-zinc-200 dark:border-zinc-800/50" />
                                    </div>
                                    <div className="relative bg-zinc-100 dark:bg-zinc-800 px-6 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-600 dark:text-zinc-400">
                                            {formatDateHeader(msgDate)}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="relative group/swipe px-4">
                                {/* Reply Icon Indicator (visible on swipe) */}
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/swipe:opacity-10 transition-opacity pointer-events-none">
                                    <Reply className="h-5 w-5 text-primary ml-2" />
                                </div>

                                <motion.div 
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 100 }}
                                    dragSnapToOrigin
                                    dragElastic={0.05}
                                    transition={{ type: "spring", stiffness: 1000, damping: 50 }}
                                    onDragEnd={(e, info) => {
                                        if (info.offset.x > 50) {
                                            setReplyingTo(firstMsg);
                                        }
                                    }}
                                    className={`flex ${isMe ? "justify-end" : "justify-start"} group/msg relative animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                >
                                    <div className={`relative max-w-[75%] group flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                        {(isAnnouncement || !isMe) && (
                                            <div className={`flex items-center gap-1.5 mb-1.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                                {isAnnouncement && <ShieldCheck className="h-3 w-3 text-primary" />}
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isAnnouncement ? "text-primary" : "text-zinc-500"}`}>
                                                    {cluster.sender_name && cluster.sender_name !== "Guardian" ? cluster.sender_name : (isMe ? "TAFS Admin" : (activeConversation?.primary_guardian?.name || activeConversation?.families?.household_name || "Guardian"))}
                                                </span>
                                            </div>
                                        )}
                                        <div className="relative group/actions">
                                            {cluster.id && cluster.status !== "sending" && (
                                                <button onClick={() => onUnsend(cluster.id)} className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover/actions:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="h-4 w-4" /></button>
                                            )}
                                            <div className={`p-4 rounded-3xl shadow-sm relative overflow-hidden ${isMe ? "bg-primary text-white rounded-tr-none shadow-blue-200/50 dark:shadow-none" : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-tl-none border border-zinc-200/50 dark:border-zinc-800 shadow-zinc-200/50"}`}>
                                                {/* Show replied message if any */}
                                                {firstMsg.media_metadata?.replyTo && (
                                                    <div className={`mb-3 p-3 rounded-2xl border-l-4 text-xs font-medium ${isMe ? "bg-white/10 border-white/50 text-white/90" : "bg-zinc-50/50 dark:bg-zinc-900/50 border-primary/50 text-zinc-500 dark:text-zinc-400"}`}>
                                                        <p className={`font-black text-[9px] uppercase tracking-wider mb-1 ${isMe ? "text-white" : "text-primary"}`}>{firstMsg.media_metadata.replyTo.senderName}</p>
                                                        <p className={`truncate ${isMe ? "text-white/80" : ""}`}>{firstMsg.media_metadata.replyTo.content}</p>
                                                    </div>
                                                )}
                                                {isGroup ? (
                                                    <div className={`grid gap-1.5 ${clusterMessages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} max-w-[400px]`}>
                                                        {clusterMessages.map((m: any) => (
                                                            <div key={m.id} className="relative cursor-pointer rounded-xl overflow-hidden shadow-md" onClick={() => setPreviewImage(m.media_metadata?.url || m.content)}>
                                                                <img src={m.media_metadata?.url || m.content} className="w-full h-full object-cover min-h-[150px]" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : firstMsg.message_type === "VOICE" ? (
                                                    <audio src={firstMsg.content.includes('digitaloceanspaces.com') ? `/api/v1/chat/media/proxy?key=${firstMsg.content.split('digitaloceanspaces.com/')[1]}` : firstMsg.content} controls className="max-w-full h-10 scale-90 origin-left" />
                                                ) : firstMsg.message_type === "IMAGE" ? (
                                                    <div className="rounded-xl overflow-hidden cursor-pointer" onClick={() => setPreviewImage(firstMsg.content)}>
                                                        <img src={firstMsg.media_metadata?.url || firstMsg.content} className="max-w-full max-h-[450px] object-cover" />
                                                    </div>
                                                ) : firstMsg.message_type === "DOCUMENT" ? (
                                                    <div className="flex items-center gap-4 p-2 min-w-[240px]">
                                                        <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                                            <FileText className="h-6 w-6 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold truncate pr-4">
                                                                {firstMsg.media_metadata?.originalName || "Document"}
                                                            </p>
                                                            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                                                                {firstMsg.media_metadata?.mimetype?.split('/')[1] || "PDF"} • {Math.round((firstMsg.media_metadata?.sizeBytes || 0) / 1024)} KB
                                                            </p>
                                                        </div>
                                                        <button 
                                                            onClick={() => window.open(firstMsg.media_metadata?.url || firstMsg.content, '_blank')}
                                                            className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all text-primary shadow-sm border border-zinc-100 dark:border-zinc-800"
                                                        >
                                                            <Download className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{renderMessageContent(firstMsg.content, isMe)}</p>
                                                )}
                                                
                                                {/* Status inside bubble */}
                                                <div className={`flex items-center gap-1.5 mt-1 justify-end select-none`}>
                                                    <span className={`text-[9px] font-bold ${isMe ? "text-white/60" : "text-zinc-400"}`}>
                                                        {firstMsg.status === "sending" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : format(new Date(firstMsg.created_at), "h:mm a")}
                                                    </span>
                                                    {isMe && firstMsg.status !== "sending" && (
                                                        firstMsg.is_read ? (
                                                            <CheckCheck className="h-3 w-3 text-blue-300" />
                                                        ) : (
                                                            <Check className="h-3 w-3 text-white/50" />
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {isAnnouncement && (
                                            <div className="mt-1.5 px-2">
                                                <div className="flex items-center gap-1.5 py-0.5 px-2 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 w-fit">
                                                    <Globe className="h-2.5 w-2.5 text-zinc-500" />
                                                    <span className="text-[9px] font-black uppercase text-zinc-500">Target: {cluster.target_grade ? `${cluster.target_grade}${cluster.target_section ? `-${cluster.target_section}` : ''}` : "Everyone"}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 shadow-lg relative">
                {/* Reply Preview */}
                <AnimatePresence>
                    {replyingTo && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.98 }}
                            className="absolute left-6 right-6 bottom-full mb-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl z-30"
                        >
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-1 bg-primary rounded-full flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                                            Replying to {replyingTo.sender_type === "ADMIN" ? "You" : (replyingTo.sender_name || "Parent")}
                                        </p>
                                        <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all">
                                            <X className="h-3 w-3 text-zinc-500" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate font-medium">
                                        {replyingTo.message_type === "IMAGE" ? "Image message" : 
                                         replyingTo.message_type === "VOICE" ? "Voice message" : 
                                         replyingTo.message_type === "DOCUMENT" ? "Document" : replyingTo.content}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileSelect(f, "IMAGE"); e.target.value = ''; }}} />
                <input type="file" ref={docInputRef} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileSelect(f, "DOCUMENT"); e.target.value = ''; }}} />

                {pendingFiles.length > 0 && (
                    <div className="flex gap-4 mb-6 p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-3xl overflow-x-auto border border-zinc-200 dark:border-zinc-800 shadow-inner">
                        {pendingFiles.map((pf, idx) => (
                            <div key={idx} className="relative flex-shrink-0 group">
                                {pf.type === "IMAGE" ? <img src={pf.preview} className="h-24 w-24 object-cover rounded-2xl shadow-lg border-2 border-white dark:border-zinc-800" /> : <div className="h-24 w-24 bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border-2 border-white dark:border-zinc-800 flex items-center justify-center p-2"><FileText className="h-8 w-8 text-primary" /></div>}
                                <button onClick={() => removePendingFile(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-xl transition-transform hover:scale-110"><X className="h-3 w-3" /></button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-3 max-w-6xl mx-auto relative">
                    {!isConnected && (
                        <div className="absolute inset-0 z-40 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-[2px] rounded-2xl flex items-center justify-center animate-in fade-in duration-300">
                            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 rounded-full shadow-2xl scale-90">
                                <WifiOff className="h-3.5 w-3.5 text-white dark:text-zinc-900" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white dark:text-zinc-900">
                                    Offline Mode
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-2xl">
                        {!isRecording && (
                            <>
                                <button onClick={() => imageInputRef.current?.click()} className="p-2.5 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-400 hover:text-primary"><Image className="h-5 w-5" /></button>
                                <button onClick={() => docInputRef.current?.click()} className="p-2.5 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-400 hover:text-primary"><FileText className="h-5 w-5" /></button>
                                <button onClick={startRecording} className="p-2.5 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-400 hover:text-primary"><Mic className="h-5 w-5" /></button>
                            </>
                        )}
                        {isRecording && <button onClick={() => { shouldSend.current = false; stopRecording(); }} className="p-2.5 hover:bg-white dark:hover:bg-zinc-800 rounded-xl text-red-500"><X className="h-5 w-5" /></button>}
                    </div>

                    {isRecording ? (
                        <div className="flex-1 flex items-center gap-4 bg-red-50 dark:bg-red-900/20 px-6 py-3 rounded-2xl border border-red-100 dark:border-red-900/30">
                            <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                            <span className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Live Recording • {formatTime(recordingTime)}</span>
                        </div>
                    ) : (
                        <div className="flex-1 relative">
                            {/* Input Highlighter Overlay */}
                            {!isRecording && (
                                <div 
                                    className="absolute inset-0 px-6 py-3.5 text-sm font-medium pointer-events-none whitespace-pre-wrap break-words overflow-hidden m-0"
                                    style={{ lineHeight: '1.25rem', fontFamily: 'inherit' }}
                                    aria-hidden="true"
                                >
                                    {(() => {
                                        // Build a dynamic regex from active mentions
                                        if (activeMentions.length === 0) return <span>{input}</span>;
                                        
                                        const names = activeMentions.map(m => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                                        const regex = new RegExp(`(@(?:${names}))( )`, 'g');
                                        
                                        return input.split(regex).map((part, i) => {
                                            const isMention = activeMentions.some(m => "@" + m.name === part);
                                            if (isMention) {
                                                return (
                                                    <span key={i} className="text-primary bg-primary/10 rounded-sm border-y border-primary/20">
                                                        {part}
                                                    </span>
                                                );
                                            }
                                            return <span key={i} className="text-zinc-900 dark:text-zinc-100">{part}</span>;
                                        });
                                    })()}
                                </div>
                            )}
                            <AnimatePresence>
                                {showMentions && filteredMentionStudents.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute bottom-full mb-4 left-0 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-80"
                                    >
                                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tag Students</p>
                                        </div>
                                        <div className="overflow-y-auto no-scrollbar">
                                            {filteredMentionStudents.map((student, idx) => (
                                                <button
                                                    key={student.cc}
                                                    onClick={() => insertMention(student)}
                                                    className={`w-full flex items-center gap-3 p-3 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-left border-b border-zinc-50 dark:border-zinc-800/50 last:border-none ${idx === mentionIndex ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                                                >
                                                    <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                                                        {student.photograph_url ? <img src={student.photograph_url} className="h-full w-full object-cover" /> : <User className="h-5 w-5 m-2.5 text-zinc-400" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate">{student.full_name}</p>
                                                        <p className="text-[9px] font-bold text-primary uppercase mt-0.5">CC: {student.cc}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <input 
                                type="text" 
                                value={input} 
                                onChange={(e) => handleInputChange(e.target.value)} 
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSend();
                                    
                                    // Handle atomic backspace for names
                                    if (e.key === "Backspace") {
                                        const selectionStart = (e.target as HTMLInputElement).selectionStart;
                                        if (selectionStart !== null) {
                                            for (const mention of activeMentions) {
                                                const tag = "@" + mention.name + " ";
                                                const searchStr = input.slice(0, selectionStart);
                                                if (searchStr.endsWith(tag)) {
                                                    e.preventDefault();
                                                    const newText = input.slice(0, selectionStart - tag.length) + input.slice(selectionStart);
                                                    setInput(newText);
                                                    setTimeout(() => {
                                                        const inputEl = e.target as HTMLInputElement;
                                                        inputEl.setSelectionRange(selectionStart - tag.length, selectionStart - tag.length);
                                                    }, 0);
                                                    return;
                                                }
                                            }
                                        }
                                    }

                                    if (showMentions && filteredMentionStudents.length > 0) {
                                        if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            setMentionIndex(prev => (prev + 1) % filteredMentionStudents.length);
                                        }
                                        if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            setMentionIndex(prev => (prev - 1 + filteredMentionStudents.length) % filteredMentionStudents.length);
                                        }
                                        if (e.key === "Tab" || e.key === "Enter") {
                                            if (showMentions) {
                                                e.preventDefault();
                                                insertMention(filteredMentionStudents[mentionIndex]);
                                            }
                                        }
                                        if (e.key === "Escape") {
                                            setShowMentions(false);
                                        }
                                    }
                                }} 
                                placeholder={isAnnouncementChannel ? "Broadcast official announcement..." : "Type a message..."} 
                                className="w-full bg-zinc-100 dark:bg-zinc-900/80 border-none focus:ring-0 rounded-2xl px-6 py-3.5 text-sm font-medium transition-all caret-primary text-transparent outline-none m-0 block" 
                                style={{ lineHeight: '1.25rem', fontFamily: 'inherit' }}
                            />
                        </div>
                    )}

                    <button onClick={isRecording ? stopRecording : handleSend} disabled={!isRecording && !input.trim() && pendingFiles.length === 0} className={`p-3.5 rounded-2xl transition-all shadow-xl hover:scale-105 active:scale-95 disabled:scale-100 disabled:shadow-none ${isRecording ? "bg-red-500 text-white" : "bg-primary text-white hover:bg-blue-700 disabled:bg-zinc-200 disabled:text-zinc-400"}`}>
                        {isRecording ? <div className="h-5 w-5 rounded-sm bg-white animate-pulse" /> : <Send className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {/* Modals */}
            {previewImage && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in" onClick={() => setPreviewImage(null)}>
                    <button className="absolute top-8 right-8 p-3 bg-white/10 rounded-2xl text-white"><X className="h-8 w-8" /></button>
                    <img src={previewImage} className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl animate-in zoom-in-95" />
                </div>
            )}

            {showStudentDetails && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-zinc-200 dark:border-zinc-800">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div>
                                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Family Students</h3>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{familyStudents.length} Students Enrolled</p>
                            </div>
                            <button onClick={() => setShowStudentDetails(false)} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto flex flex-col gap-4">
                            {familyStudents.map((student) => (
                                <div key={student.cc} className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 group hover:border-primary/30 transition-all">
                                    <div className="h-16 w-16 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                        {student.photograph_url ? <img src={student.photograph_url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><User className="h-8 w-8 text-zinc-400" /></div>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-sm text-zinc-900 dark:text-zinc-100 truncate tracking-tight">{student.full_name}</h4>
                                        <p className="text-[10px] font-bold text-primary uppercase mt-0.5 tracking-wider">CC: {student.cc}</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="px-2 py-0.5 bg-white dark:bg-zinc-800 rounded-md text-[9px] font-black border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">{student.classes?.description} {student.sections?.description}</span>
                                            <span className="px-2 py-0.5 bg-white dark:bg-zinc-800 rounded-md text-[9px] font-black border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">{student.campuses?.campus_name}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800">
                            <button onClick={() => setShowStudentDetails(false)} className="w-full py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all shadow-sm">Close Details</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
