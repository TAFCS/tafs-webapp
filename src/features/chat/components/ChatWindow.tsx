"use client";

import { Send, Image, Mic, MoreVertical, User, Loader2, FileText, X, ChevronDown, Trash2, Megaphone, ShieldCheck, Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import api from "@/lib/api";
import { AnnouncementSelectors } from "./AnnouncementSelectors";
import { useSocket } from "@/context/SocketContext";

interface ChatWindowProps {
    familyId: number | null;
    messages: any[];
    onSendMessage: (content: string, type: "TEXT" | "IMAGE" | "VOICE" | "DOCUMENT", mediaMetadata?: any, announcementTarget?: { grade: string | null, section: string | null }) => void;
    onUnsend: (messageId: string) => void;
    isConnected: boolean;
    isLoading?: boolean;
}

export const ChatWindow = ({ familyId, messages, onSendMessage, onUnsend, isConnected, isLoading }: ChatWindowProps) => {
    const { socket } = useSocket();
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [pendingFiles, setPendingFiles] = useState<{ file: File, preview: string, type: "IMAGE" | "DOCUMENT" }[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Announcement state
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

            mediaRecorder.current.ondataavailable = (event) => {
                audioChunks.current.push(event.data);
            };

            mediaRecorder.current.onstop = async () => {
                if (!shouldSend.current) {
                    audioChunks.current = [];
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                const audioBlob = new Blob(audioChunks.current, { type: mimeType });
                const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
                const formData = new FormData();
                formData.append('file', audioBlob, `voice-note.${extension}`);

                try {
                    const response = await api.post('/v1/chat/media', formData);
                    if (response.data.url) {
                        onSendMessage(response.data.url, "VOICE", undefined, isAnnouncementChannel ? { grade: targetGrade, section: targetSection } : undefined);
                    }
                } catch (err) {
                    console.error("Failed to upload voice note:", err);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err) {
            console.error("Microphone access error:", err);
        }
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
        <div 
            className="flex-1 flex flex-col min-h-0 relative bg-zinc-50 dark:bg-zinc-900/10"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-50 flex items-center justify-center backdrop-blur-md rounded-2xl m-4">
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 scale-110">
                        <div className="p-4 bg-primary/10 rounded-2xl">
                            <Send className="h-10 w-10 text-primary" />
                        </div>
                        <div className="text-center">
                            <p className="font-black text-zinc-900 dark:text-zinc-100 text-lg">Drop to Send</p>
                            <p className="text-xs text-zinc-500 mt-1">Images or Documents</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="h-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${
                        isAnnouncementChannel ? "bg-gradient-to-br from-primary to-blue-700 shadow-primary/20" : "bg-zinc-100 dark:bg-zinc-800"
                    }`}>
                        {isAnnouncementChannel ? <Megaphone className="h-6 w-6 text-white" /> : <User className="h-6 w-6 text-zinc-500" />}
                    </div>
                    <div>
                        <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
                            {isAnnouncementChannel ? "Official Announcements" : "Family Chat"}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"} animate-pulse`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                {isConnected ? "Live Connection" : "Offline"}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Announcement Selectors */}
            {isAnnouncementChannel && (
                <AnnouncementSelectors onFilterChange={(g, s) => { setTargetGrade(g); setTargetSection(s); }} />
            )}

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 pr-12 flex flex-col gap-6 no-scrollbar relative">
                {isLoading ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-500">
                        <div className="relative">
                            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            </div>
                            <div className="absolute -inset-4 bg-primary/5 rounded-full blur-2xl animate-pulse" />
                        </div>
                        <p className="mt-4 text-xs font-black uppercase tracking-widest text-zinc-500 animate-pulse">
                            Synchronizing history...
                        </p>
                    </div>
                ) : (
                    (() => {
                        const clusters: any[] = [];
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
                            clusters.push({ type: "IMAGE_GROUP", messages: group, sender_type: msg.sender_type, id: msg.id, created_at: msg.created_at, is_announcement: msg.is_announcement, sender_name: msg.sender_name, target_grade: msg.target_grade, target_section: msg.target_section });
                        } else {
                            clusters.push(msg);
                        }
                    }

                    return clusters.map((cluster) => {
                        const isMe = cluster.sender_type === "ADMIN";
                        const isAnnouncement = cluster.is_announcement;
                        const isGroup = cluster.type === "IMAGE_GROUP";
                        const messages = isGroup ? cluster.messages : [cluster];
                        const firstMsg = messages[0];

                        return (
                            <div key={cluster.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group/msg relative animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                <div className={`relative max-w-[75%] group flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                    {/* Sender Name / System Label */}
                                    {(isAnnouncement || !isMe) && (
                                        <div className={`flex items-center gap-1.5 mb-1.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                            {isAnnouncement && <ShieldCheck className="h-3 w-3 text-primary fill-primary/10" />}
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${isAnnouncement ? "text-primary" : "text-zinc-500"}`}>
                                                {cluster.sender_name || (isMe ? "TAFS Admin" : "Guardian")}
                                            </span>
                                        </div>
                                    )}

                                    <div className="relative group/actions">
                                        {/* Unsend button */}
                                        {isMe && cluster.status !== "sending" && (
                                            <div className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover/actions:opacity-100 transition-all duration-200">
                                                <button 
                                                    onClick={() => onUnsend(cluster.id)}
                                                    className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl text-red-500 hover:bg-red-50 transition-colors"
                                                    title="Unsend"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}

                                        <div className={`p-4 rounded-3xl shadow-sm relative overflow-hidden ${
                                            isMe 
                                                ? (isAnnouncement 
                                                    ? "bg-gradient-to-br from-primary via-blue-600 to-indigo-700 text-white rounded-tr-none shadow-primary/20" 
                                                    : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-tr-none border border-zinc-200/50 dark:border-zinc-800")
                                                : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-tl-none border border-zinc-200/50 dark:border-zinc-800 shadow-zinc-200/50"
                                        }`}>
                                            {isGroup ? (
                                                <div className={`grid gap-1.5 ${messages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} max-w-[400px]`}>
                                                    {messages.map((m: any, idx: number) => (
                                                        <div 
                                                            key={m.id} 
                                                            className={`relative cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all overflow-hidden rounded-xl shadow-md ${
                                                                messages.length === 3 && idx === 0 ? 'col-span-2' : ''
                                                            }`}
                                                            onClick={() => setPreviewImage(m.media_metadata?.url || m.content)}
                                                        >
                                                            <img src={m.media_metadata?.url || m.content} className="w-full h-full object-cover min-h-[150px] max-h-[300px]" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : firstMsg.message_type === "VOICE" ? (
                                                <audio src={firstMsg.content.includes('digitaloceanspaces.com') ? `/api/v1/chat/media/proxy?key=${firstMsg.content.split('digitaloceanspaces.com/')[1]}` : firstMsg.content} controls className="max-w-full h-10 scale-90 origin-left brightness-95" />
                                            ) : firstMsg.message_type === "IMAGE" ? (
                                                <div className="rounded-xl overflow-hidden cursor-pointer hover:opacity-95 transition-all shadow-md group/img" onClick={() => setPreviewImage(firstMsg.content)}>
                                                    <img src={firstMsg.media_metadata?.url || firstMsg.content} className="max-w-full max-h-[450px] object-cover transition-transform group-hover/img:scale-105 duration-700" />
                                                    {firstMsg.media_metadata?.url && firstMsg.content && firstMsg.content !== firstMsg.media_metadata.url && (
                                                        <div className="p-4 text-sm font-medium leading-relaxed">{firstMsg.content}</div>
                                                    )}
                                                </div>
                                            ) : firstMsg.message_type === "DOCUMENT" ? (
                                                <div className="flex flex-col gap-3 min-w-[200px]">
                                                    <a href={firstMsg.media_metadata?.url || firstMsg.content} target="_blank" className="flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200/50 dark:border-zinc-800 group/doc">
                                                        <div className={`p-3 rounded-xl transition-colors ${isMe ? "bg-primary/10" : "bg-zinc-200"}`}>
                                                            <FileText className={`h-6 w-6 ${isMe ? "text-primary" : "text-zinc-600"}`} />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-black truncate max-w-[140px] tracking-tight">{(firstMsg.media_metadata?.originalName || "Document").substring(0, 24)}</span>
                                                            <span className="text-[10px] font-bold opacity-60 uppercase mt-0.5">{(firstMsg.media_metadata?.sizeBytes / 1024 / 1024).toFixed(1)} MB • DOC</span>
                                                        </div>
                                                    </a>
                                                    {firstMsg.media_metadata?.url && firstMsg.content && firstMsg.content !== firstMsg.media_metadata.url && (
                                                        <p className="text-sm px-1 leading-relaxed opacity-90">{firstMsg.content}</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{firstMsg.content}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer Info (Time + Target) */}
                                    <div className={`flex items-center gap-3 mt-1.5 px-2 ${isMe ? "justify-end" : "justify-start"}`}>
                                        {isAnnouncement && (
                                            <div className="flex items-center gap-1.5 py-0.5 px-2 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
                                                <Globe className="h-2.5 w-2.5 text-zinc-500" />
                                                <span className="text-[9px] font-black uppercase text-zinc-500 tracking-tight">
                                                    Target: {cluster.target_grade ? `${cluster.target_grade}${cluster.target_section ? `-${cluster.target_section}` : ''}` : "Everyone"}
                                                </span>
                                            </div>
                                        )}
                                        <span className="text-[9px] font-bold text-zinc-400">
                                            {firstMsg.status === "sending" ? <Loader2 className="h-2 w-2 animate-spin" /> : format(new Date(firstMsg.created_at), "h:mm a")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    });
                })())}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
                <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileSelect(f, "IMAGE"); e.target.value = ''; }}} />
                <input type="file" ref={docInputRef} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileSelect(f, "DOCUMENT"); e.target.value = ''; }}} />

                {pendingFiles.length > 0 && (
                    <div className="flex gap-4 mb-6 p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-3xl overflow-x-auto no-scrollbar border border-zinc-200 dark:border-zinc-800 shadow-inner">
                        {pendingFiles.map((pf, idx) => (
                            <div key={idx} className="relative flex-shrink-0 group">
                                {pf.type === "IMAGE" ? (
                                    <img src={pf.preview} className="h-24 w-24 object-cover rounded-2xl shadow-lg border-2 border-white dark:border-zinc-800" />
                                ) : (
                                    <div className="h-24 w-24 flex flex-col items-center justify-center bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border-2 border-white dark:border-zinc-800 p-2">
                                        <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center mb-2"><FileText className="h-6 w-6 text-primary" /></div>
                                        <span className="text-[9px] font-black text-zinc-500 truncate w-full text-center px-1">{pf.file.name}</span>
                                    </div>
                                )}
                                <button onClick={() => removePendingFile(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-xl hover:scale-110 active:scale-95 transition-transform"><X className="h-3 w-3" /></button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-3 max-w-6xl mx-auto">
                    <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-2xl">
                        {!isRecording && (
                            <>
                                <button onClick={() => imageInputRef.current?.click()} className="p-2.5 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all shadow-none hover:shadow-sm text-zinc-400 hover:text-primary"><Image className="h-5 w-5" /></button>
                                <button onClick={() => docInputRef.current?.click()} className="p-2.5 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all shadow-none hover:shadow-sm text-zinc-400 hover:text-primary"><FileText className="h-5 w-5" /></button>
                                <button onClick={startRecording} className="p-2.5 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all shadow-none hover:shadow-sm text-zinc-400 hover:text-primary"><Mic className="h-5 w-5" /></button>
                            </>
                        )}
                        {isRecording && (
                            <button onClick={() => { shouldSend.current = false; stopRecording(); }} className="p-2.5 hover:bg-white dark:hover:bg-zinc-800 rounded-xl text-red-500"><X className="h-5 w-5" /></button>
                        )}
                    </div>

                    {isRecording ? (
                        <div className="flex-1 flex items-center gap-4 bg-red-50 dark:bg-red-900/20 px-6 py-3 rounded-2xl border border-red-100 dark:border-red-900/30">
                            <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                            <span className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Live Recording • {formatTime(recordingTime)}</span>
                        </div>
                    ) : (
                        <div className="flex-1 relative group">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder={isAnnouncementChannel ? "Broadcast official announcement..." : "Type a message..."}
                                className="w-full bg-zinc-100 dark:bg-zinc-900/80 border-none focus:ring-2 focus:ring-primary/30 rounded-2xl px-6 py-3.5 text-sm font-medium transition-all"
                            />
                        </div>
                    )}

                    <button 
                        onClick={isRecording ? stopRecording : handleSend}
                        disabled={!isRecording && !input.trim() && pendingFiles.length === 0}
                        className={`p-3.5 rounded-2xl transition-all shadow-xl hover:scale-105 active:scale-95 disabled:scale-100 disabled:shadow-none ${
                            isRecording 
                                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20" 
                                : "bg-primary text-white hover:bg-blue-700 shadow-primary/20 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800"
                        }`}
                    >
                        {isRecording ? <div className="h-5 w-5 rounded-sm bg-white animate-pulse" /> : <Send className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {/* Preview Image Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-300" onClick={() => setPreviewImage(null)}>
                    <button className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all"><X className="h-8 w-8" /></button>
                    <img src={previewImage} className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300" />
                </div>
            )}
        </div>
    );
};
