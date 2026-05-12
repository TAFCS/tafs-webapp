"use client";

import { Send, Image, Mic, MoreVertical, User, Loader2, FileText, X, ChevronDown, Trash2, Megaphone, ShieldCheck, Globe, Download } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { format } from "date-fns";
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
    isLoading?: boolean;
}

export const ChatWindow = ({ familyId, activeConversation, messages, onSendMessage, onUnsend, isConnected, isLoading }: ChatWindowProps) => {
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
    
    const [targetGrade, setTargetGrade] = useState<string | null>(null);
    const [targetSection, setTargetSection] = useState<string | null>(null);

    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const shouldSend = useRef(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    const isAnnouncementChannel = familyId === 0;

    const fetchFamilyStudents = async () => {
        if (!familyId || familyId === 0) return;
        setIsLoadingStudents(true);
        try {
            const res = await api.get(`v1/chat/family/${familyId}/students`);
            setFamilyStudents(res.data);
            setShowStudentDetails(true);
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

    const uploadAndSendPending = async (caption?: string) => {
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
                    onSendMessage(response.data.url, item.type, { 
                        url: response.data.url,
                        batchId,
                        caption: i === 0 ? caption : undefined
                    }, isAnnouncementChannel ? { grade: targetGrade, section: targetSection } : undefined);
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

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
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
                if (!shouldSend.current) {
                    audioChunks.current = [];
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                const audioBlob = new Blob(audioChunks.current, { type: mimeType });
                const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
                const file = new File([audioBlob], `recording.${extension}`, { type: mimeType });
                const formData = new FormData();
                formData.append('file', file);
                try {
                    const response = await api.post('/v1/chat/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                    if (response.data.url) {
                        onSendMessage(response.data.url, "VOICE", { duration: recordingTime }, isAnnouncementChannel ? { grade: targetGrade, section: targetSection } : undefined);
                    }
                } catch (err) { console.error("Voice upload failed:", err); }
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

    const handleSend = () => {
        if (pendingFiles.length > 0) {
            uploadAndSendPending(input.trim());
            setInput("");
        } else if (input.trim()) {
            onSendMessage(input.trim(), "TEXT", undefined, isAnnouncementChannel ? { grade: targetGrade, section: targetSection } : undefined);
            setInput("");
        }
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
                            <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"} animate-pulse`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{isConnected ? "Live Connection" : "Offline"}</span>
                        </div>
                    </div>
                </div>
                {!isAnnouncementChannel && (
                    <button onClick={fetchFamilyStudents} disabled={isLoadingStudents} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-400 hover:text-primary flex items-center gap-2">
                        {isLoadingStudents ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Family Info</span>
                    </button>
                )}
            </div>

            {/* Announcement Selectors */}
            {isAnnouncementChannel && (
                <AnnouncementSelectors onFilterChange={(g, s) => { setTargetGrade(g); setTargetSection(s); }} />
            )}

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 pr-12 flex flex-col gap-6 no-scrollbar relative">
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-500">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="mt-4 text-xs font-black uppercase tracking-widest text-zinc-500">Synchronizing history...</p>
                    </div>
                )}
                
                {!isLoading && clusters.map((cluster) => {
                    const isMe = cluster.sender_type === "ADMIN";
                    const isAnnouncement = cluster.is_announcement;
                    const isGroup = cluster.type === "IMAGE_GROUP";
                    const clusterMessages = isGroup ? cluster.messages : [cluster];
                    const firstMsg = clusterMessages[0];

                    return (
                        <div key={cluster.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group/msg relative animate-in fade-in slide-in-from-bottom-2 duration-300`}>
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
                                    {isMe && cluster.status !== "sending" && (
                                        <button onClick={() => onUnsend(cluster.id)} className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover/actions:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="h-4 w-4" /></button>
                                    )}
                                    <div className={`p-4 rounded-3xl shadow-sm relative overflow-hidden ${isMe ? (isAnnouncement ? "bg-gradient-to-br from-primary to-indigo-700 text-white rounded-tr-none" : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-tr-none border border-zinc-200/50 dark:border-zinc-800") : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-tl-none border border-zinc-200/50 dark:border-zinc-800 shadow-zinc-200/50"}`}>
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
                                            <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{firstMsg.content}</p>
                                        )}
                                    </div>
                                </div>
                                <div className={`flex items-center gap-3 mt-1.5 px-2 ${isMe ? "justify-end" : "justify-start"}`}>
                                    {isAnnouncement && (
                                        <div className="flex items-center gap-1.5 py-0.5 px-2 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
                                            <Globe className="h-2.5 w-2.5 text-zinc-500" />
                                            <span className="text-[9px] font-black uppercase text-zinc-500">Target: {cluster.target_grade ? `${cluster.target_grade}${cluster.target_section ? `-${cluster.target_section}` : ''}` : "Everyone"}</span>
                                        </div>
                                    )}
                                    <span className="text-[9px] font-bold text-zinc-400">{firstMsg.status === "sending" ? <Loader2 className="h-2 w-2 animate-spin" /> : format(new Date(firstMsg.created_at), "h:mm a")}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 shadow-lg">
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

                <div className="flex items-center gap-3 max-w-6xl mx-auto">
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
                        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder={isAnnouncementChannel ? "Broadcast official announcement..." : "Type a message..."} className="flex-1 bg-zinc-100 dark:bg-zinc-900/80 border-none focus:ring-2 focus:ring-primary/30 rounded-2xl px-6 py-3.5 text-sm font-medium transition-all" />
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
