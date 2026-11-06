'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, History, Loader2, Route, Search, Send, X, XCircle } from 'lucide-react';
import { studentsService, type SimpleStudentSearchResult } from '@/lib/students.service';
import { STUDENT_SEARCH_PLACEHOLDER } from '@/components/students/StudentMatchReason';
import {
    flowErrorMessage,
    ticketFlowService,
    type FlowDiff,
    type FlowIssue,
    type FlowRouteAllRow,
    type FlowVersionSummary,
} from '@/lib/ticket-flow.service';
import { card, ghostBtn, input, label, primaryBtn, textarea } from './styles';

function Modal({ title, onClose, children, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 flex items-start justify-center overflow-auto p-4 md:p-10" onClick={onClose}>
            <div className={`${card} w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} p-6 space-y-4`} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-2">{title}</h2>
                    <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-900" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

// ─── Issues ───────────────────────────────────────────────────────────────────

export function IssuesList({ issues, onPick }: { issues: FlowIssue[]; onPick: (key: string) => void }) {
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    if (issues.length === 0) {
        return (
            <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> No problems found.
            </p>
        );
    }
    return (
        <div className="space-y-1.5 max-h-80 overflow-auto">
            {[...errors, ...warnings].map((i, n) => (
                <button
                    key={n}
                    type="button"
                    disabled={!i.node_key}
                    onClick={() => i.node_key && onPick(i.node_key)}
                    className={`w-full text-left text-xs rounded-lg px-2.5 py-1.5 flex gap-2 ${i.severity === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}
                >
                    {i.severity === 'error' ? <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                    {i.message}
                </button>
            ))}
        </div>
    );
}

function DiffSummary({ diff }: { diff: FlowDiff }) {
    const rows: [string, string[]][] = [
        ['Added', diff.added],
        ['Removed', diff.removed],
        ['Renamed', diff.renamed],
        ['Moved', diff.moved],
        ['Settings changed', diff.changed],
    ];
    const any = rows.some(([, v]) => v.length);
    if (!any) return <p className="text-sm text-zinc-500">No changes from the published flow.</p>;
    return (
        <div className="space-y-2">
            {rows
                .filter(([, v]) => v.length)
                .map(([k, v]) => (
                    <div key={k}>
                        <p className={label}>
                            {k} ({v.length})
                        </p>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300">{v.slice(0, 12).join(' · ')}{v.length > 12 ? ` · +${v.length - 12} more` : ''}</p>
                    </div>
                ))}
        </div>
    );
}

// ─── Publish ──────────────────────────────────────────────────────────────────

export function PublishModal({
    lockVersion,
    onClose,
    onPublished,
    onPick,
}: {
    lockVersion: number;
    onClose: () => void;
    onPublished: (version: number) => void;
    onPick: (key: string) => void;
}) {
    const [state, setState] = useState<{ issues: FlowIssue[]; diff: FlowDiff } | null>(null);
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        ticketFlowService
            .validate()
            .then(setState)
            .catch((e) => toast.error(flowErrorMessage(e, 'Could not check the draft')));
    }, []);

    const errors = state?.issues.filter((i) => i.severity === 'error') ?? [];
    const publish = async () => {
        setBusy(true);
        try {
            const res = await ticketFlowService.publish(lockVersion, notes);
            toast.success(`Version ${res.version} is live. The apps pick it up on their next load.`);
            onPublished(res.version);
        } catch (e) {
            toast.error(flowErrorMessage(e, 'Publishing failed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={
                <>
                    <Send className="h-5 w-5" /> Publish the draft
                </>
            }
            onClose={onClose}
        >
            {!state ? (
                <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
                <>
                    <DiffSummary diff={state.diff} />
                    <IssuesList
                        issues={state.issues}
                        onPick={(k) => {
                            onPick(k);
                            onClose();
                        }}
                    />
                    <div className="space-y-1">
                        <p className={label}>What changed (shown in history)</p>
                        <textarea className={textarea} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Added a Transport lane for NNZ" />
                    </div>
                    <p className="text-xs text-zinc-500">
                        Parents see the new flow the next time they open Get help. A ticket being written against the old version still goes through for 24 hours.
                    </p>
                    <button type="button" className={primaryBtn} disabled={busy || errors.length > 0} onClick={publish}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {errors.length > 0 ? `Fix ${errors.length} problem(s) first` : 'Publish'}
                    </button>
                </>
            )}
        </Modal>
    );
}

// ─── History ──────────────────────────────────────────────────────────────────

export function HistoryModal({ hasDraft, onClose, onRestore }: { hasDraft: boolean; onClose: () => void; onRestore: (version: number) => void }) {
    const [rows, setRows] = useState<FlowVersionSummary[] | null>(null);
    useEffect(() => {
        ticketFlowService
            .versions()
            .then(setRows)
            .catch((e) => toast.error(flowErrorMessage(e, 'Could not load history')));
    }, []);
    const when = (s: string | null) => (s ? new Date(s).toLocaleString() : '');
    return (
        <Modal
            title={
                <>
                    <History className="h-5 w-5" /> Version history
                </>
            }
            onClose={onClose}
        >
            {!rows ? (
                <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
                <div className="space-y-2 max-h-[60vh] overflow-auto">
                    {rows.map((r) => (
                        <div key={r.version} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                                    Version {r.version}{' '}
                                    <span
                                        className={`ml-1 text-[10px] font-bold uppercase tracking-wider ${r.status === 'PUBLISHED' ? 'text-emerald-700' : r.status === 'DRAFT' ? 'text-sky-700' : 'text-zinc-400'}`}
                                    >
                                        {r.status === 'PUBLISHED' ? 'live' : r.status.toLowerCase()}
                                    </span>
                                </p>
                                <p className="text-xs text-zinc-500">
                                    {r.status === 'DRAFT'
                                        ? `Edited by ${r.updated_by ?? '—'} · ${when(r.updated_at)}`
                                        : `Published by ${r.published_by ?? '—'} · ${when(r.published_at)}`}
                                </p>
                                {r.notes && <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">{r.notes}</p>}
                            </div>
                            {r.status === 'ARCHIVED' && (
                                <button
                                    type="button"
                                    className={ghostBtn}
                                    onClick={() => {
                                        if (!hasDraft || window.confirm('This replaces the open draft. Continue?')) onRestore(r.version);
                                    }}
                                >
                                    Restore as draft
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}

// ─── Test routing for every leaf ───────────────────────────────────────────────

export function RouteAllModal({ useDraft, onClose, onPick }: { useDraft: boolean; onClose: () => void; onPick: (key: string) => void }) {
    const [student, setStudent] = useState<SimpleStudentSearchResult | null>(null);
    const [rows, setRows] = useState<FlowRouteAllRow[] | null>(null);
    const [busy, setBusy] = useState(false);
    const run = async () => {
        setBusy(true);
        try {
            const res = await ticketFlowService.routeAll(student?.cc, useDraft);
            setRows(res.leaves);
        } catch (e) {
            toast.error(flowErrorMessage(e, 'Could not test routing'));
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal
            wide
            title={
                <>
                    <Route className="h-5 w-5" /> Where every ticket goes
                </>
            }
            onClose={onClose}
        >
            <p className="text-sm text-zinc-500">
                Pick a sample student to test tickets about a child; leave it empty to test tickets that are not about a child. Uses the {useDraft ? 'draft' : 'published flow'}.
            </p>
            <StudentPicker value={student} onChange={(s) => { setStudent(s); setRows(null); }} />
            <button type="button" className={primaryBtn} onClick={run} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />} Route every ticket step
            </button>
            {rows && (
                <div className="overflow-auto max-h-[55vh] rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <table className="w-full text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 text-left">
                            <tr>
                                <th className="p-2">Step</th>
                                <th className="p-2">Goes to</th>
                                <th className="p-2">Why</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const fallback = !!r.note && /fallback/i.test(r.note);
                                return (
                                    <tr key={r.leaf_key} className={`border-t border-zinc-100 dark:border-zinc-800 ${!r.available ? 'opacity-50' : ''}`}>
                                        <td className="p-2">
                                            <button type="button" className="text-left hover:underline" onClick={() => { onPick(r.leaf_key); onClose(); }}>
                                                {r.labels.join(' › ')}
                                            </button>
                                        </td>
                                        <td className={`p-2 font-bold ${fallback ? 'text-amber-700' : r.target?.kind === 'none' ? 'text-red-700' : ''}`}>
                                            {!r.available ? 'Not shown for this student' : r.target?.kind === 'none' ? 'Unassigned' : r.target?.name}
                                        </td>
                                        <td className="p-2 text-zinc-500">{!r.available ? r.reason : r.note ?? (r.rule_id ? 'Routing rule' : 'Its own queue')}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>
    );
}

function StudentPicker({ value, onChange }: { value: SimpleStudentSearchResult | null; onChange: (s: SimpleStudentSearchResult | null) => void }) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<SimpleStudentSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    useEffect(() => {
        const term = q.trim();
        if (!term) {
            setResults([]);
            return;
        }
        setSearching(true);
        const handle = setTimeout(async () => {
            try {
                setResults(await studentsService.searchSimple({ q: term }));
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(handle);
    }, [q]);
    if (value) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2">
                <div className="flex-1 text-sm">
                    <span className="font-bold">{value.full_name}</span>
                    <span className="text-zinc-500"> · CC {value.cc} · {value.campuses?.campus_name} · {value.classes?.description}</span>
                </div>
                <button type="button" className={ghostBtn} onClick={() => onChange(null)}>
                    <X className="h-3.5 w-3.5" /> Clear
                </button>
            </div>
        );
    }
    return (
        <div className="space-y-1">
            <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-zinc-400" />
                <input className={`${input} pl-9`} placeholder={STUDENT_SEARCH_PLACEHOLDER} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {q.trim() && (
                <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 max-h-56 overflow-auto">
                    {searching ? (
                        <p className="text-xs text-zinc-500 p-3">Searching…</p>
                    ) : results.length === 0 ? (
                        <p className="text-xs text-zinc-500 p-3">No students match “{q.trim()}”.</p>
                    ) : (
                        results.map((s) => (
                            <button
                                key={s.cc}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                onClick={() => {
                                    onChange(s);
                                    setQ('');
                                }}
                            >
                                <span className="font-semibold">{s.full_name}</span>
                                <span className="text-zinc-500"> · CC {s.cc} · {s.campuses?.campus_name} · {s.classes?.description}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
