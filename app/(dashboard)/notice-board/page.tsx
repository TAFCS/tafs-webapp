"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import api from "@/lib/api";
import { Pin, Trash2, BarChart2, Plus, Upload, X, Eye, Calendar, Loader2, Search, ChevronDown, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Post {
    id: number;
    title: string | null;
    body: string;
    campus_ids: number[];
    class_ids: number[];
    section_ids: number[];
    media_urls: string[];
    media_types: string[];
    is_pinned: boolean;
    posted_at: string;
    expires_at: string | null;
    deleted_at: string | null;
    users: { full_name: string };
    _count: { post_reads: number };
}

interface ReadStats {
    post_id: number;
    total_reached: number;
    total_read: number;
}

interface Campus {
    id: number;
    campus_name: string;
    campus_classes: { classes: { id: number; description: string }; campus_sections: { sections: { id: number; description: string } }[] }[];
}

type PanelMode = "list" | "compose" | "stats";

export default function NoticeBoardPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [panelMode, setPanelMode] = useState<PanelMode>("list");
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [readStats, setReadStats] = useState<ReadStats | null>(null);
    const [campuses, setCampuses] = useState<any[]>([]);

    // Compose state
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [selectedCampusIds, setSelectedCampusIds] = useState<number[]>([]);
    const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
    const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);
    const [isPinned, setIsPinned] = useState(false);
    const [expiresAt, setExpiresAt] = useState("");
    const [uploadedMedia, setUploadedMedia] = useState<{ url: string; type: string; name: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Student targeting state
    const [studentTargetOpen, setStudentTargetOpen] = useState(false);
    const [studentSearchQuery, setStudentSearchQuery] = useState("");
    const [studentSearchResults, setStudentSearchResults] = useState<{ cc: number; full_name: string; gr_number: string }[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<{ cc: number; full_name: string; gr_number: string }[]>([]);
    const [searchingStudents, setSearchingStudents] = useState(false);
    const [ccPasteText, setCcPasteText] = useState("");
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        fetchPosts();
        fetchCampuses();
    }, []);

    async function fetchPosts() {
        setLoading(true);
        try {
            const res = await api.get("v1/admin/notice-board");
            setPosts(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
        } finally {
            setLoading(false);
        }
    }

    async function fetchCampuses() {
        try {
            const res = await api.get("v1/campuses");
            setCampuses(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
        } catch {}
    }

    async function loadStats(post: Post) {
        setSelectedPost(post);
        setReadStats(null);
        setPanelMode("stats");
        try {
            const res = await api.get(`v1/admin/notice-board/${post.id}/reads`);
            setReadStats(res.data);
        } catch {}
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;
        setUploading(true);
        try {
            for (const file of files) {
                const form = new FormData();
                form.append("file", file);
                const res = await api.post("v1/admin/notice-board/upload", form, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                setUploadedMedia(prev => [...prev, { url: res.data.url, type: res.data.type, name: file.name }]);
            }
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    async function handleSubmit() {
        if (!body.trim()) return;
        setSubmitting(true);
        try {
            const res = await api.post("v1/admin/notice-board", {
                title: title.trim() || undefined,
                body: body.trim(),
                campus_ids: selectedCampusIds,
                class_ids: selectedClassIds,
                section_ids: selectedSectionIds,
                student_ccs: selectedStudents.map(s => s.cc),
                media_urls: uploadedMedia.map(m => m.url),
                media_types: uploadedMedia.map(m => m.type),
                is_pinned: isPinned,
                expires_at: expiresAt || undefined,
            });
            setPosts(prev => [res.data, ...prev]);
            resetCompose();
            setPanelMode("list");
        } finally {
            setSubmitting(false);
        }
    }

    async function togglePin(post: Post) {
        const nextPinned = !post.is_pinned;
        await api.patch(`v1/admin/notice-board/${post.id}`, { is_pinned: nextPinned });
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_pinned: nextPinned } : p));
        setSelectedPost(prev => prev && prev.id === post.id ? { ...prev, is_pinned: nextPinned } : prev);
    }

    async function deletePost(post: Post) {
        if (!confirm(`Delete "${post.title || "this post"}"?`)) return;
        await api.delete(`v1/admin/notice-board/${post.id}`);
        setPosts(prev => prev.filter(p => p.id !== post.id));
        if (selectedPost?.id === post.id) setPanelMode("list");
    }

    function resetCompose() {
        setTitle(""); setBody(""); setSelectedCampusIds([]); setSelectedClassIds([]);
        setSelectedSectionIds([]); setIsPinned(false); setExpiresAt(""); setUploadedMedia([]);
        setSelectedStudents([]); setStudentSearchQuery(""); setStudentSearchResults([]);
        setCcPasteText(""); setStudentTargetOpen(false);
    }

    const searchStudents = useCallback((q: string) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (q.length < 2) { setStudentSearchResults([]); return; }
        searchTimerRef.current = setTimeout(async () => {
            setSearchingStudents(true);
            try {
                const res = await api.get("/v1/students/search-simple", { params: { q } });
                setStudentSearchResults(res.data?.data ?? res.data ?? []);
            } catch { setStudentSearchResults([]); }
            finally { setSearchingStudents(false); }
        }, 300);
    }, []);

    function addStudent(s: { cc: number; full_name: string; gr_number: string }) {
        if (selectedStudents.some(x => x.cc === s.cc)) return;
        setSelectedStudents(prev => [...prev, s]);
        setStudentSearchQuery("");
        setStudentSearchResults([]);
    }

    function removeStudent(cc: number) {
        setSelectedStudents(prev => prev.filter(s => s.cc !== cc));
    }

    async function parseCcPaste() {
        const raw = ccPasteText.split(/[,\n\r]+/).map(s => s.trim()).filter(Boolean);
        const ccs = raw.map(Number).filter(n => Number.isInteger(n) && n > 0);
        const newCcs = ccs.filter(cc => !selectedStudents.some(s => s.cc === cc));
        if (!newCcs.length) return;
        const resolved: { cc: number; full_name: string; gr_number: string }[] = [];
        for (const cc of newCcs) {
            try {
                const res = await api.get("/v1/students/search-simple", { params: { q: String(cc) } });
                const list = res.data?.data ?? res.data ?? [];
                const match = list.find((s: any) => s.cc === cc);
                if (match) resolved.push(match);
                else resolved.push({ cc, full_name: `CC ${cc}`, gr_number: "" });
            } catch {
                resolved.push({ cc, full_name: `CC ${cc}`, gr_number: "" });
            }
        }
        setSelectedStudents(prev => [...prev, ...resolved]);
        setCcPasteText("");
    }

    // Derive scope label for a post
    function scopeLabel(post: Post) {
        if (!post.campus_ids.length && !post.class_ids.length && !post.section_ids.length) return "School-wide";
        const parts: string[] = [];
        if (post.campus_ids.length) {
            const names = campuses.filter(c => post.campus_ids.includes(c.id)).map((c: any) => c.campus_name);
            parts.push(names.join(", "));
        }
        return parts.join(" · ") || "Targeted";
    }

    // Live scope preview in compose
    function composeScopeLabel() {
        if (!selectedCampusIds.length && !selectedClassIds.length && !selectedSectionIds.length)
            return "All families (school-wide)";
        const parts: string[] = [];
        if (selectedCampusIds.length) {
            const names = campuses.filter(c => selectedCampusIds.includes(c.id)).map((c: any) => c.campus_name);
            parts.push(names.join(", "));
        }
        return `Families in: ${parts.join(" · ") || "selected scope"}`;
    }

    // Derive available classes for selected campuses
    const availableClasses = campuses
        .filter(c => selectedCampusIds.includes(c.id))
        .flatMap((c: any) => (c.offered_classes ?? []).map((oc: any) => ({ id: oc.id, name: oc.description })))
        .filter((c: any) => c.id)
        .filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);

    const availableSections = campuses
        .filter(c => selectedCampusIds.includes(c.id))
        .flatMap((c: any) => (c.offered_classes ?? [])
            .filter((oc: any) => selectedClassIds.includes(oc.id))
            .flatMap((oc: any) => (oc.sections ?? []).map((s: any) => ({ id: s.id, name: s.description }))))
        .filter((s: any) => s.id)
        .filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);

    function toggleId(arr: number[], id: number, setter: (v: number[]) => void) {
        setter(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
    }

    return (
        <div className="h-[calc(100vh-160px)] flex gap-6">
            {/* Left: post list */}
            <div className="w-80 flex-shrink-0 flex flex-col bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">Notice Board</span>
                    <button
                        onClick={() => { resetCompose(); setPanelMode("compose"); }}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                    >
                        <Plus className="h-3.5 w-3.5" /> New Post
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        </div>
                    ) : posts.length === 0 ? (
                        <p className="text-center text-zinc-400 text-sm py-12">No posts yet.</p>
                    ) : posts.map(post => (
                        <div
                            key={post.id}
                            onClick={() => loadStats(post)}
                            className={`p-4 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${selectedPost?.id === post.id ? "bg-zinc-50 dark:bg-zinc-900" : ""}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        {post.is_pinned && <Pin className="h-3 w-3 text-primary flex-shrink-0" />}
                                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate">{scopeLabel(post)}</span>
                                    </div>
                                    {post.title && <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{post.title}</p>}
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5">{post.body}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className="text-xs text-zinc-400">{formatDistanceToNow(new Date(post.posted_at), { addSuffix: true })}</span>
                                    <span className="text-xs text-zinc-400">{post._count?.post_reads ?? 0} read</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: compose / stats panel */}
            <div className="flex-1 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
                {panelMode === "list" && (
                    <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm flex-col gap-3">
                        <Eye className="h-10 w-10 opacity-20" />
                        <p>Select a post to view analytics, or create a new one.</p>
                    </div>
                )}

                {panelMode === "compose" && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <span className="font-bold text-zinc-800 dark:text-zinc-100">New Post</span>
                            <button onClick={() => setPanelMode("list")} className="text-zinc-400 hover:text-zinc-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                            {/* 1. Write */}
                            <div className="flex flex-col gap-3">
                                <input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Title (optional)"
                                    className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-semibold bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <textarea
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    placeholder="Write your notice here…"
                                    rows={5}
                                    className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                />
                            </div>

                            {/* 2. Attach */}
                            <div>
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Attachments</p>
                                <div
                                    className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                                    onClick={() => fileRef.current?.click()}
                                >
                                    {uploading ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400 mx-auto" />
                                    ) : (
                                        <>
                                            <Upload className="h-5 w-5 text-zinc-300 mx-auto mb-1" />
                                            <p className="text-xs text-zinc-400">Click or drag to attach images, videos, or PDFs</p>
                                        </>
                                    )}
                                </div>
                                <input ref={fileRef} type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={handleUpload} />
                                {uploadedMedia.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {uploadedMedia.map((m, i) => (
                                            <div key={i} className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs">
                                                <span className="truncate max-w-[120px]">{m.name}</span>
                                                <button onClick={() => setUploadedMedia(prev => prev.filter((_, j) => j !== i))}>
                                                    <X className="h-3.5 w-3.5 text-zinc-400" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 3. Scope */}
                            <div>
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Scope</p>
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <p className="text-xs text-zinc-500 mb-1">Campus</p>
                                        <div className="flex flex-wrap gap-2">
                                            {campuses.map((c: any) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => toggleId(selectedCampusIds, c.id, v => { setSelectedCampusIds(v); setSelectedClassIds([]); setSelectedSectionIds([]); })}
                                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selectedCampusIds.includes(c.id) ? "bg-primary text-white border-primary" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-primary/50"}`}
                                                >
                                                    {c.campus_name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {selectedCampusIds.length > 0 && availableClasses.length > 0 && (
                                        <div>
                                            <p className="text-xs text-zinc-500 mb-1">Class</p>
                                            <div className="flex flex-wrap gap-2">
                                                {availableClasses.map((c: any) => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => toggleId(selectedClassIds, c.id, v => { setSelectedClassIds(v); setSelectedSectionIds([]); })}
                                                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selectedClassIds.includes(c.id) ? "bg-primary text-white border-primary" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-primary/50"}`}
                                                    >
                                                        {c.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedCampusIds.length > 0 && selectedClassIds.length > 0 && availableSections.length > 0 && (
                                        <div>
                                            <p className="text-xs text-zinc-500 mb-1">Section</p>
                                            <div className="flex flex-wrap gap-2">
                                                {availableSections.map((s: any) => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => toggleId(selectedSectionIds, s.id, setSelectedSectionIds)}
                                                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selectedSectionIds.includes(s.id) ? "bg-primary text-white border-primary" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-primary/50"}`}
                                                    >
                                                        {s.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-xs text-primary font-medium">
                                        Will be visible to: {composeScopeLabel()}
                                    </p>
                                </div>
                            </div>

                            {/* 3b. Student targeting */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setStudentTargetOpen(prev => !prev)}
                                    className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Target specific students
                                    {selectedStudents.length > 0 && (
                                        <span className="bg-primary/10 text-primary font-black text-[10px] rounded-full px-2 py-0.5">
                                            {selectedStudents.length}
                                        </span>
                                    )}
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${studentTargetOpen ? "rotate-180" : ""}`} />
                                </button>

                                {studentTargetOpen && (
                                    <div className="mt-3 flex flex-col gap-3">
                                        {/* Search */}
                                        <div className="relative">
                                            <div className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2">
                                                <Search className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                                                <input
                                                    value={studentSearchQuery}
                                                    onChange={e => { setStudentSearchQuery(e.target.value); searchStudents(e.target.value); }}
                                                    placeholder="Search by name or GR number…"
                                                    className="flex-1 text-sm bg-transparent outline-none"
                                                />
                                                {searchingStudents && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
                                            </div>
                                            {studentSearchResults.length > 0 && (
                                                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden">
                                                    {studentSearchResults.map(s => (
                                                        <button
                                                            key={s.cc}
                                                            onClick={() => addStudent(s)}
                                                            disabled={selectedStudents.some(x => x.cc === s.cc)}
                                                            className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between disabled:opacity-40"
                                                        >
                                                            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{s.full_name}</span>
                                                            <span className="text-xs text-zinc-400">{s.gr_number ? `GR ${s.gr_number}` : `CC ${s.cc}`}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Chip list */}
                                        {selectedStudents.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {selectedStudents.map(s => (
                                                    <span
                                                        key={s.cc}
                                                        className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-lg px-2.5 py-1 text-xs font-semibold"
                                                    >
                                                        {s.full_name}
                                                        {s.gr_number && <span className="text-primary/60">({s.gr_number})</span>}
                                                        <button onClick={() => removeStudent(s.cc)} className="hover:text-red-500 transition-colors">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Paste CCs */}
                                        <div className="flex gap-2">
                                            <textarea
                                                value={ccPasteText}
                                                onChange={e => setCcPasteText(e.target.value)}
                                                placeholder="Paste comma-separated CCs (e.g. 1001, 1002, 1003)"
                                                rows={2}
                                                className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={parseCcPaste}
                                                disabled={!ccPasteText.trim()}
                                                className="self-end px-4 py-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40"
                                            >
                                                Parse
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. Options */}
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="rounded" />
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Pin post</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Calendar className="h-4 w-4 text-zinc-400" />
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Expires</span>
                                    <input
                                        type="datetime-local"
                                        value={expiresAt}
                                        onChange={e => setExpiresAt(e.target.value)}
                                        className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="p-5 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !body.trim()}
                                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                Post to Notice Board
                            </button>
                        </div>
                    </div>
                )}

                {panelMode === "stats" && selectedPost && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BarChart2 className="h-5 w-5 text-primary" />
                                <span className="font-bold text-zinc-800 dark:text-zinc-100">Post Analytics</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => togglePin(selectedPost)}
                                    className={`p-2 rounded-lg transition-colors ${selectedPost.is_pinned ? "bg-primary/10 text-primary" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                                    title={selectedPost.is_pinned ? "Unpin" : "Pin"}
                                >
                                    <Pin className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => deletePost(selectedPost)}
                                    className="p-2 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
                            {/* Post preview */}
                            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold text-zinc-500 bg-zinc-200 dark:bg-zinc-700 rounded-full px-2 py-0.5">{scopeLabel(selectedPost)}</span>
                                    {selectedPost.is_pinned && <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 flex items-center gap-1"><Pin className="h-3 w-3" />Pinned</span>}
                                </div>
                                {selectedPost.title && <p className="font-bold text-zinc-800 dark:text-zinc-100 mb-1">{selectedPost.title}</p>}
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{selectedPost.body}</p>
                                <p className="text-xs text-zinc-400 mt-2">
                                    Posted by {selectedPost.users.full_name} · {formatDistanceToNow(new Date(selectedPost.posted_at), { addSuffix: true })}
                                    {selectedPost.expires_at && ` · Expires ${formatDistanceToNow(new Date(selectedPost.expires_at), { addSuffix: true })}`}
                                </p>
                            </div>

                            {/* Read stats */}
                            {readStats ? (
                                <div>
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Read Analytics</p>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-black text-zinc-800 dark:text-zinc-100">{readStats.total_reached}</p>
                                            <p className="text-xs text-zinc-400 mt-1">Families Reached</p>
                                        </div>
                                        <div className="bg-primary/5 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-black text-primary">{readStats.total_read}</p>
                                            <p className="text-xs text-zinc-400 mt-1">Families Read</p>
                                        </div>
                                    </div>
                                    {readStats.total_reached > 0 && (
                                        <div>
                                            <div className="flex justify-between text-xs text-zinc-500 mb-1">
                                                <span>Read rate</span>
                                                <span>{Math.round((readStats.total_read / readStats.total_reached) * 100)}%</span>
                                            </div>
                                            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary rounded-full transition-all duration-500"
                                                    style={{ width: `${Math.round((readStats.total_read / readStats.total_reached) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading analytics…
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
