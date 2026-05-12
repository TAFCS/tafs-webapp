"use client";

import { Send, Image, Mic, MoreVertical, User, Loader2, FileText, X, ChevronDown, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import api from "@/lib/api";

interface ChatWindowProps {
    familyId: number | null;
    messages: any[];
    onSendMessage: (content: string, type: "TEXT" | "IMAGE" | "VOICE" | "DOCUMENT", mediaMetadata?: any) => void;
    onUnsend: (messageId: string) => void;
    isConnected: boolean;
}

export const ChatWindow = ({ familyId, messages, onSendMessage, onUnsend, isConnected }: ChatWindowProps) => {
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [pendingFiles, setPendingFiles] = useState<{ file: File, preview: string, type: "IMAGE" | "DOCUMENT" }[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const shouldSend = useRef(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

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
                    });
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
            
            // Determine best supported MIME type (iOS likes mp4, Chrome likes webm)
            const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
                ? 'audio/mp4' 
                : 'audio/webm';
            
            mediaRecorder.current = new MediaRecorder(stream, { mimeType });
            audioChunks.current = [];
            shouldSend.current = true;

            mediaRecorder.current.ondataavailable = (event) => {
                audioChunks.current.push(event.data);
            };

            mediaRecorder.current.onstop = async () => {
                console.log("[Voice] Recording stopped, shouldSend:", shouldSend.current);
                if (!shouldSend.current) {
                    audioChunks.current = [];
                    // Stop all tracks to release microphone
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                const audioBlob = new Blob(audioChunks.current, { type: mimeType });
                const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
                const formData = new FormData();
                formData.append('file', audioBlob, `voice-note.${extension}`);

                try {
                    const response = await api.post('/v1/chat/media', formData);
                    const data = response.data;
                    console.log("[Voice] Uploaded:", data.url);
                    if (data.url) {
                        onSendMessage(data.url, "VOICE");
                    }
                } catch (err) {
                    console.error("Failed to upload voice note:", err);
                }

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please ensure permissions are granted.");
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
            onSendMessage(input.trim(), "TEXT");
            setInput("");
        }
    };

    if (!familyId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900/50">
                <div className="h-20 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mb-4">
                    <Send className="h-8 w-8 text-zinc-400" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No active conversation</h3>
                <p className="text-zinc-500 dark:text-zinc-400">Select a family from the left to start messaging.</p>
            </div>
        );
    }

    return (
        <div 
            className="flex-1 flex flex-col min-h-0 relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-50 flex items-center justify-center backdrop-blur-sm rounded-xl">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <Send className="h-8 w-8 text-primary" />
                        </div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">Drop files to send</p>
                        <p className="text-sm text-zinc-500">Images or Documents</p>
                    </div>
                </div>
            )}
            <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between px-6 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">Family Chat</h3>
                        <span className={`text-[10px] font-medium ${isConnected ? "text-green-500" : "text-red-500"}`}>
                            {isConnected ? "Online" : "Disconnected"}
                        </span>
                    </div>
                </div>
                <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors">
                    <MoreVertical className="h-5 w-5 text-zinc-400" />
                </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 pr-12 flex flex-col gap-4">
                {(() => {
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
                            clusters.push({ type: "IMAGE_GROUP", messages: group, sender_type: msg.sender_type, id: msg.id, created_at: msg.created_at });
                        } else {
                            clusters.push(msg);
                        }
                    }

                    return clusters.map((cluster) => {
                        const isMe = cluster.sender_type === "ADMIN";
                        const isGroup = cluster.type === "IMAGE_GROUP";
                        const messages = isGroup ? cluster.messages : [cluster];
                        const firstMsg = messages[0];

                        return (
                            <div key={cluster.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group/msg relative mb-2`}>
                                <div className={`relative max-w-[80%] group flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                    {isMe && cluster.status !== "sending" && (
                                        <div className="absolute -right-9 top-1 opacity-0 group-hover/msg:opacity-100 transition-opacity z-10">
                                            <div className="relative group/dropdown">
                                                <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                                                    <ChevronDown className="h-4 w-4" />
                                                </button>
                                                <div className="absolute right-0 top-full pt-1 hidden group-hover/dropdown:block z-50">
                                                    <div className="bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden min-w-[140px]">
                                                        <button 
                                                            onClick={() => onUnsend(cluster.id)}
                                                            className="w-full py-2.5 px-3 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            Unsend Message
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className={`p-1.5 rounded-2xl shadow-sm ${
                                        isMe 
                                            ? "bg-primary text-white rounded-tr-none" 
                                            : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-tl-none"
                                    }`}>
                                        {isGroup ? (
                                            <div className={`grid gap-1 ${messages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} max-w-[400px]`}>
                                                {messages.map((m: any, idx: number) => (
                                                    <div 
                                                        key={m.id} 
                                                        className={`relative cursor-pointer hover:opacity-95 transition-opacity overflow-hidden rounded-lg ${
                                                            messages.length === 3 && idx === 0 ? 'col-span-2' : ''
                                                        }`}
                                                        onClick={() => setPreviewImage(m.media_metadata?.url || m.content)}
                                                    >
                                                        <img 
                                                            src={m.media_metadata?.url || m.content} 
                                                            alt="Chat image" 
                                                            className="w-full h-full object-cover min-h-[150px] max-h-[250px]"
                                                        />
                                                        {idx === 0 && m.media_metadata?.url && m.content && m.content !== m.media_metadata.url && (
                                                            <div className="absolute bottom-0 inset-x-0 p-2 bg-black/40 backdrop-blur-sm text-white text-xs truncate">
                                                                {m.content}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : firstMsg.message_type === "VOICE" ? (
                                        <audio 
                                            src={firstMsg.content.includes('digitaloceanspaces.com') 
                                                ? `/api/v1/chat/media/proxy?key=${firstMsg.content.split('digitaloceanspaces.com/')[1]}` 
                                                : firstMsg.content
                                            } 
                                            controls 
                                            preload="metadata" 
                                            className="max-w-full h-8 scale-90 origin-left"
                                        >
                                            Your browser does not support the audio element.
                                        </audio>
                                    ) : firstMsg.message_type === "IMAGE" ? (
                                        <div 
                                            className="rounded-lg overflow-hidden cursor-pointer hover:opacity-95 transition-opacity"
                                            onClick={() => setPreviewImage(firstMsg.content)}
                                        >
                                            <img 
                                                src={firstMsg.media_metadata?.url || firstMsg.content} 
                                                alt="Uploaded image" 
                                                className="max-w-full max-h-80 object-cover"
                                            />
                                            {firstMsg.media_metadata?.url && firstMsg.content && firstMsg.content !== firstMsg.media_metadata.url && (
                                                <div className="p-2 text-sm whitespace-pre-wrap">{firstMsg.content}</div>
                                            )}
                                        </div>
                                    ) : firstMsg.message_type === "DOCUMENT" ? (
                                        <div className="flex flex-col">
                                            <a 
                                                href={firstMsg.media_metadata?.url || firstMsg.content} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                                            >
                                                <div className={`p-2 rounded-lg ${isMe ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-900"}`}>
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-medium truncate max-w-[150px]">
                                                        {(firstMsg.media_metadata?.url || firstMsg.content).split('/').pop()?.substring(0, 20)}...
                                                    </span>
                                                    <span className="text-[10px] opacity-70 uppercase">Document</span>
                                                </div>
                                            </a>
                                            {firstMsg.media_metadata?.url && firstMsg.content && firstMsg.content !== firstMsg.media_metadata.url && (
                                                <div className="mt-2 pt-2 border-t border-white/10 text-sm whitespace-pre-wrap">{firstMsg.content}</div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm whitespace-pre-wrap">{firstMsg.content}</p>
                                    )}
                                <div className={`text-[9px] mt-1 flex justify-end items-center gap-1 ${isMe ? "text-white/70" : "text-zinc-400"}`}>
                                    {firstMsg.status === "sending" ? (
                                        <Loader2 className="h-2 w-2 animate-spin" />
                                    ) : (
                                        format(new Date(firstMsg.created_at), "hh:mm a")
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
                    });
                })()}
            </div>

            <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
                <input 
                    type="file" 
                    ref={imageInputRef} 
                    hidden 
                    accept="image/*" 
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            handleFileSelect(file, "IMAGE");
                            e.target.value = ''; 
                        }
                    }}
                />
                <input 
                    type="file" 
                    ref={docInputRef} 
                    hidden 
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" 
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            handleFileSelect(file, "DOCUMENT");
                            e.target.value = ''; 
                        }
                    }}
                />

                {pendingFiles.length > 0 && (
                    <div className="flex gap-3 mb-4 p-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl overflow-x-auto">
                        {pendingFiles.map((pf, idx) => (
                            <div key={idx} className="relative flex-shrink-0 group">
                                {pf.type === "IMAGE" ? (
                                    <img src={pf.preview} className="h-20 w-20 object-cover rounded-lg border border-zinc-200 dark:border-zinc-800" />
                                ) : (
                                    <div className="h-20 w-20 flex flex-col items-center justify-center bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 p-1">
                                        <FileText className="h-8 w-8 text-primary mb-1" />
                                        <span className="text-[10px] text-zinc-500 truncate w-full text-center">{pf.file.name}</span>
                                    </div>
                                )}
                                <button 
                                    onClick={() => removePendingFile(idx)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2 max-w-5xl mx-auto">
                    {!isRecording && (
                        <>
                            <button 
                                onClick={() => imageInputRef.current?.click()}
                                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
                                title="Send Image"
                            >
                                <Image className="h-5 w-5 text-zinc-400" />
                            </button>
                            <button 
                                onClick={() => docInputRef.current?.click()}
                                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
                                title="Send Document"
                            >
                                <FileText className="h-5 w-5 text-zinc-400" />
                            </button>
                        </>
                    )}

                    {isRecording && (
                        <button 
                            onClick={() => {
                                shouldSend.current = false;
                                stopRecording();
                            }}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
                        >
                            <div className="h-5 w-5 flex items-center justify-center text-red-500 hover:text-red-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                            </div>
                        </button>
                    )}

                    {isRecording ? (
                        <div className="flex-1 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-full">
                            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-xs font-medium text-red-600 dark:text-red-400">Recording {formatTime(recordingTime)}</span>
                        </div>
                    ) : (
                        <>
                            <button 
                                onClick={startRecording}
                                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
                            >
                                <Mic className="h-5 w-5 text-zinc-400" />
                            </button>
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                    placeholder="Type a message..."
                                    className="w-full bg-zinc-100 dark:bg-zinc-900 border-none focus:ring-2 focus:ring-primary rounded-full px-4 py-2 text-sm"
                                />
                            </div>
                        </>
                    )}

                    <button 
                        onClick={isRecording ? stopRecording : handleSend}
                        disabled={!isRecording && !input.trim() && pendingFiles.length === 0}
                        className={`p-2.5 rounded-full transition-colors ${
                            isRecording 
                                ? "bg-red-500 hover:bg-red-600 text-white" 
                                : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800"
                        }`}
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
