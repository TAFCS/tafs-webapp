'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Languages, Loader2, Paperclip, RotateCcw, Route, Send, Smartphone, X } from 'lucide-react';
import {
    flowErrorMessage,
    ticketFlowService,
    type FlowConditions,
    type FlowNode,
    type FlowOverview,
    type FlowRoutePreview,
    type FlowTree,
} from '@/lib/ticket-flow.service';
import { FlowIcon } from './flow-icons';
import { card, ghostBtn, input, label, primaryBtn } from './styles';

// A phone-sized walk of the tree, with the same rules the app and the server
// use: conditions against the picked child (or any child before a pick),
// single-answer questions skipped, INFO shown before carrying on.

interface SampleChild {
    name: string;
    campus_id: number | null;
    class_id: number | null;
}

interface Placement {
    campus_id: number | null;
    class_id: number | null;
    segment_id: number | null;
}

type Step = { key: string; childIndex?: number | null; continued?: boolean };

export function PreviewPhone({
    tree,
    options,
    useDraft,
    onClose,
}: {
    tree: FlowTree;
    options: FlowOverview['options'];
    useDraft: boolean;
    onClose: () => void;
}) {
    const [children, setChildren] = useState<SampleChild[]>([
        { name: 'Ali', campus_id: options.campuses[0]?.id ?? null, class_id: options.classes[10]?.id ?? options.classes[0]?.id ?? null },
        { name: 'Sara', campus_id: options.campuses[0]?.id ?? null, class_id: options.classes[3]?.id ?? options.classes[0]?.id ?? null },
    ]);
    const [urdu, setUrdu] = useState(false);
    const [steps, setSteps] = useState<Step[]>([]);
    const [text, setText] = useState('');
    const [sent, setSent] = useState(false);
    const [routeCc, setRouteCc] = useState('');
    const [route, setRoute] = useState<FlowRoutePreview | null>(null);
    const [routing, setRouting] = useState(false);

    const placements: Placement[] = useMemo(
        () =>
            children.map((c) => ({
                campus_id: c.campus_id,
                class_id: c.class_id,
                segment_id: options.classes.find((x) => x.id === c.class_id)?.segment_id ?? null,
            })),
        [children, options.classes],
    );

    const t = (en: string | undefined, ur: unknown) => (urdu && typeof ur === 'string' && ur.trim() ? ur : en ?? '');
    const nodeLabel = (n: FlowNode) => t(n.label, n.label_ur);

    // Resolve the walk: nodes along the path and the current child choice.
    const walk = useMemo(() => {
        const nodes: FlowNode[] = [];
        let options: FlowNode[] = tree.lanes;
        let picked = false;
        let child: Placement | null = null;
        for (const s of steps) {
            const n = options.find((x) => x.key === s.key);
            if (!n) break;
            nodes.push(n);
            if (n.type === 'PICK_CHILD' && s.childIndex !== undefined) {
                picked = true;
                child = s.childIndex === null ? null : placements[s.childIndex] ?? null;
            }
            options = n.children ?? [];
        }
        return { nodes, picked, child };
    }, [steps, tree, placements]);

    const visible = (n: FlowNode, picked: boolean, child: Placement | null) => visibleFor(n.conditions, picked, child, placements);

    const current = walk.nodes[walk.nodes.length - 1] ?? null;
    const currentStep = steps[steps.length - 1];

    const go = (node: FlowNode) => {
        setRoute(null);
        const next = [...steps, { key: node.key }];
        setSteps(autoSkip(next, node));
    };

    /** Skip questions and lanes with exactly one visible answer, as the app does. */
    const autoSkip = (list: Step[], node: FlowNode): Step[] => {
        let out = list;
        let n = node;
        for (let guard = 0; guard < 10; guard++) {
            if (n.type !== 'LANE' && n.type !== 'QUESTION') break;
            const kids = (n.children ?? []).filter((c) => visible(c, walk.picked, walk.child));
            if (kids.length !== 1) break;
            out = [...out, { key: kids[0].key }];
            n = kids[0];
        }
        return out;
    };

    const back = () => {
        setRoute(null);
        setSent(false);
        setSteps((s) => {
            const copy = [...s];
            const last = copy[copy.length - 1];
            if (last && (last.childIndex !== undefined || last.continued)) {
                copy[copy.length - 1] = { key: last.key };
                return copy;
            }
            copy.pop();
            // Pop auto-skipped single answers too.
            while (copy.length > 0) {
                const prev = findNode(tree, copy.map((x) => x.key));
                if (!prev || (prev.type !== 'LANE' && prev.type !== 'QUESTION')) break;
                const kids = (prev.children ?? []).filter((c) => visible(c, walk.picked, walk.child));
                if (kids.length !== 1) break;
                copy.pop();
            }
            return copy;
        });
    };

    const reset = () => {
        setSteps([]);
        setText('');
        setSent(false);
        setRoute(null);
    };

    const checkRoute = async () => {
        setRouting(true);
        try {
            const cc = walk.child && routeCc.trim() ? Number(routeCc.trim()) : undefined;
            if (walk.child && !cc) {
                toast.error('Enter a real student CC to see where a ticket about a child goes');
                return;
            }
            setRoute(await ticketFlowService.previewRoute(steps.map((s) => s.key), cc, useDraft));
        } catch (e) {
            toast.error(flowErrorMessage(e, 'Could not check the route'));
        } finally {
            setRouting(false);
        }
    };

    let body: React.ReactNode;
    if (!current) {
        const lanes = tree.lanes.filter((l) => visible(l, false, null) && (l.children ?? []).length > 0);
        body = (
            <>
                <ScreenTitle>{urdu ? 'ہم کس طرح مدد کر سکتے ہیں؟' : 'How can we help?'}</ScreenTitle>
                <div className="grid grid-cols-2 gap-2">
                    {lanes.map((l) => {
                        const color = (l.settings?.color as string) || '#4B5563';
                        return (
                            <button key={l.key} type="button" onClick={() => go(l)} className="text-left rounded-2xl p-3 text-white min-h-[96px] flex flex-col justify-between" style={{ background: color }}>
                                <FlowIcon name={l.icon} className="h-6 w-6" />
                                <div>
                                    <p className="font-black text-sm leading-tight">{nodeLabel(l)}</p>
                                    {(l.settings?.description || l.help) && (
                                        <p className="text-[10px] opacity-90 leading-tight mt-0.5">{t((l.settings?.description as string) || l.help, l.settings?.description_ur ?? l.help_ur)}</p>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                    {lanes.length === 0 && <p className="col-span-2 text-xs text-zinc-500">No lane is visible for these sample children.</p>}
                </div>
            </>
        );
    } else if (current.type === 'PICK_CHILD' && currentStep?.childIndex === undefined) {
        const s = current.settings ?? {};
        body = (
            <>
                <ScreenTitle>{t((s.prompt as string) || current.label, s.prompt_ur)}</ScreenTitle>
                <div className="space-y-2">
                    {children.map((c, i) => (
                        <Answer key={i} onClick={() => setSteps((st) => [...st.slice(0, -1), { key: current.key, childIndex: i }])} label={c.name} help={classLabel(options, c)} />
                    ))}
                    {!!s.allow_none && (
                        <Answer onClick={() => setSteps((st) => [...st.slice(0, -1), { key: current.key, childIndex: null }])} label={t((s.none_label as string) || 'Not about one child', s.none_label_ur)} />
                    )}
                </div>
            </>
        );
    } else if (current.type === 'INFO' && !currentStep?.continued) {
        const s = current.settings ?? {};
        const hasNext = (current.children ?? []).some((c) => visible(c, walk.picked, walk.child));
        body = (
            <>
                <ScreenTitle>{nodeLabel(current)}</ScreenTitle>
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 p-3 text-sm whitespace-pre-wrap">{t(s.body as string, s.body_ur)}</div>
                {typeof s.link_url === 'string' && s.link_url && <p className="text-xs text-sky-700 underline">{(s.link_label as string) || s.link_url}</p>}
                <div className="space-y-2 pt-2">
                    <button type="button" className={`${primaryBtn} w-full`} onClick={reset}>
                        {urdu ? 'مسئلہ حل ہو گیا' : 'This solved it'}
                    </button>
                    {hasNext && (
                        <button type="button" className={`${ghostBtn} w-full`} onClick={() => setSteps((st) => [...st.slice(0, -1), { key: current.key, continued: true }])}>
                            {t((s.continue_label as string) || 'I still need help', s.continue_label_ur)}
                        </button>
                    )}
                </div>
            </>
        );
    } else if (current.type === 'TICKET') {
        const s = current.settings ?? {};
        const min = (s.min_length as number | undefined) ?? options.default_min_length;
        body = sent ? (
            <>
                <ScreenTitle>{urdu ? 'ٹکٹ بھیج دیا گیا' : 'Ticket sent'}</ScreenTitle>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">Preview only: nothing was sent.</p>
                <div className="space-y-2">
                    {walk.child && <input className={input} placeholder="Real student CC (for the route check)" value={routeCc} onChange={(e) => setRouteCc(e.target.value)} />}
                    <button type="button" className={`${primaryBtn} w-full`} onClick={checkRoute} disabled={routing}>
                        {routing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />} Where would this go?
                    </button>
                    {route && (
                        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3 text-xs space-y-1">
                            <p className="font-black text-sm">{route.target.kind === 'none' ? 'Unassigned (no route)' : route.target.name}</p>
                            {route.steps.map((st, i) => (
                                <p key={i} className={st.outcome === 'routed' ? 'text-emerald-700' : 'text-amber-700'}>
                                    {st.outcome === 'routed' ? '✓' : '↷'} {st.rule_name}: {st.reason}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            </>
        ) : (
            <>
                <ScreenTitle>{nodeLabel(current)}</ScreenTitle>
                <textarea
                    className="w-full min-h-[140px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 text-sm"
                    placeholder={t((s.placeholder as string) || 'Describe the issue…', s.placeholder_ur)}
                    dir={urdu ? 'rtl' : 'ltr'}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
                <p className="text-[11px] text-zinc-500">
                    {text.trim().length}/{min} characters minimum
                </p>
                {s.attachments !== false && (
                    <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" /> Attach a photo or file
                    </p>
                )}
                <button type="button" className={`${primaryBtn} w-full`} disabled={text.trim().length < min} onClick={() => setSent(true)}>
                    <Send className="h-4 w-4" /> {urdu ? 'بھیجیں' : 'Send'}
                </button>
            </>
        );
    } else if (current.type === 'SCREEN') {
        const screen = options.screens.find((x) => x.key === current.settings?.screen);
        body = (
            <>
                <ScreenTitle>{nodeLabel(current)}</ScreenTitle>
                <div className="rounded-2xl bg-pink-50 dark:bg-pink-950 p-4 text-sm text-pink-900 dark:text-pink-100">The app opens the {screen?.label ?? 'selected'} screen here.</div>
            </>
        );
    } else {
        const s = current.settings ?? {};
        const prompt =
            current.type === 'PICK_CHILD' ? t((s.then_prompt as string) || 'What is this about?', s.then_prompt_ur) : t((s.prompt as string) || 'What is this about?', s.prompt_ur);
        const kids = (current.children ?? []).filter((c) => visible(c, walk.picked, walk.child));
        body = (
            <>
                <ScreenTitle>{prompt}</ScreenTitle>
                <div className="space-y-2">
                    {kids.map((k) => (
                        <Answer key={k.key} icon={k.icon} onClick={() => go(k)} label={nodeLabel(k)} help={t(k.help, k.help_ur)} />
                    ))}
                    {kids.length === 0 && <p className="text-xs text-zinc-500">Nothing to choose here for this child: a dead end.</p>}
                </div>
            </>
        );
    }

    const crumbs = walk.nodes.map((n, i) => {
        const st = steps[i];
        if (n.type === 'PICK_CHILD' && st?.childIndex !== undefined) return st.childIndex === null ? 'No child' : children[st.childIndex]?.name ?? '';
        return n.type === 'PICK_CHILD' ? null : nodeLabel(n);
    }).filter(Boolean);

    return (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 flex items-start justify-center overflow-auto p-4 md:p-8" onClick={onClose}>
            <div className="flex flex-col lg:flex-row gap-6 items-start" onClick={(e) => e.stopPropagation()}>
                <div className={`${card} p-5 w-80 space-y-4`}>
                    <div className="flex items-center justify-between">
                        <p className="font-black flex items-center gap-2">
                            <Smartphone className="h-4 w-4" /> Preview as parent
                        </p>
                        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-900" aria-label="Close">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="text-xs text-zinc-500">{useDraft ? 'Walking the draft.' : 'Walking the published flow.'} Set the sample children to see campus and class conditions.</p>
                    {children.map((c, i) => (
                        <div key={i} className="space-y-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800 p-2.5">
                            <input className={input} value={c.name} onChange={(e) => setChildren((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                            <select className={input} value={c.campus_id ?? ''} onChange={(e) => setChildren((cs) => cs.map((x, j) => (j === i ? { ...x, campus_id: Number(e.target.value) } : x)))}>
                                {options.campuses.map((x) => (
                                    <option key={x.id} value={x.id}>
                                        {x.campus_name}
                                    </option>
                                ))}
                            </select>
                            <select className={input} value={c.class_id ?? ''} onChange={(e) => setChildren((cs) => cs.map((x, j) => (j === i ? { ...x, class_id: Number(e.target.value) } : x)))}>
                                {options.classes.map((x) => (
                                    <option key={x.id} value={x.id}>
                                        {x.description}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <div className="flex gap-2">
                        {children.length < 3 && (
                            <button type="button" className={ghostBtn} onClick={() => setChildren((cs) => [...cs, { name: `Child ${cs.length + 1}`, campus_id: options.campuses[0]?.id ?? null, class_id: options.classes[0]?.id ?? null }])}>
                                Add child
                            </button>
                        )}
                        {children.length > 1 && (
                            <button type="button" className={ghostBtn} onClick={() => setChildren((cs) => cs.slice(0, -1))}>
                                Remove child
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" className={ghostBtn} onClick={() => setUrdu((u) => !u)}>
                            <Languages className="h-3.5 w-3.5" /> {urdu ? 'English' : 'اردو'}
                        </button>
                        <button type="button" className={ghostBtn} onClick={reset}>
                            <RotateCcw className="h-3.5 w-3.5" /> Start over
                        </button>
                    </div>
                    <p className={label}>Path</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">{crumbs.join(' › ') || '—'}</p>
                </div>

                <div className="w-[360px] h-[720px] rounded-[44px] border-[10px] border-zinc-900 bg-zinc-50 dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col" dir={urdu ? 'rtl' : 'ltr'}>
                    <div className="h-14 shrink-0 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2 px-3">
                        {steps.length > 0 ? (
                            <button type="button" onClick={back} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Back">
                                <ArrowLeft className={`h-5 w-5 ${urdu ? 'rotate-180' : ''}`} />
                            </button>
                        ) : (
                            <span className="w-8" />
                        )}
                        <p className="font-black text-sm truncate">{urdu ? 'مدد' : 'Get help'}</p>
                    </div>
                    {crumbs.length > 0 && <div className="px-4 pt-3 text-[11px] text-zinc-500 truncate">{crumbs.join(' › ')}</div>}
                    <div className="flex-1 overflow-auto p-4 space-y-3">{body}</div>
                </div>
            </div>
        </div>
    );
}

function ScreenTitle({ children }: { children: React.ReactNode }) {
    return <p className="text-lg font-black text-zinc-900 dark:text-zinc-50 leading-tight">{children}</p>;
}

function Answer({ label, help, icon, onClick }: { label: string; help?: string; icon?: string; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="w-full text-start rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-3 flex items-center gap-3 hover:border-zinc-300">
            {icon && <FlowIcon name={icon} className="h-5 w-5 text-zinc-500 shrink-0" />}
            <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{label}</p>
                {help && <p className="text-[11px] text-zinc-500">{help}</p>}
            </div>
        </button>
    );
}

function classLabel(options: FlowOverview['options'], c: SampleChild) {
    const cls = options.classes.find((x) => x.id === c.class_id)?.description;
    const campus = options.campuses.find((x) => x.id === c.campus_id)?.campus_name;
    return [cls, campus].filter(Boolean).join(' · ');
}

function findNode(tree: FlowTree, keys: string[]): FlowNode | null {
    let list = tree.lanes;
    let node: FlowNode | null = null;
    for (const k of keys) {
        node = list.find((x) => x.key === k) ?? null;
        if (!node) return null;
        list = node.children ?? [];
    }
    return node;
}

/** Same rule as the server's nodeVisible. */
export function visibleFor(cond: FlowConditions | undefined, picked: boolean, child: Placement | null, family: Placement[]): boolean {
    if (!cond) return true;
    if (cond.child) {
        if (!picked) return false;
        if (cond.child === 'WITH' && !child) return false;
        if (cond.child === 'WITHOUT' && child) return false;
    }
    const placed = !!(cond.campus_ids?.length || cond.segment_ids?.length || cond.class_ids?.length);
    if (!placed) return true;
    const subjects = child ? [child] : family;
    return subjects.some(
        (p) =>
            (!cond.campus_ids?.length || cond.campus_ids.includes(p.campus_id ?? -1)) &&
            (!cond.segment_ids?.length || cond.segment_ids.includes(p.segment_id ?? -1)) &&
            (!cond.class_ids?.length || cond.class_ids.includes(p.class_id ?? -1)),
    );
}
