'use client';

import { useState, type DragEvent } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus } from 'lucide-react';
import {
    allowedChildTypes,
    countNodes,
    NODE_TYPE_LABEL,
    type FlowIssue,
    type FlowNode,
    type FlowNodeType,
    type FlowOverview,
    type FlowTree,
} from '@/lib/ticket-flow.service';
import { canMove } from './flow-editor';
import { FlowIcon } from './flow-icons';
import { chip } from './styles';

// Lanes side by side; each lane's steps flow downward (a waterfall), indented
// under the step they follow. Dragging moves a step and everything under it:
// drop on a step to put it underneath, or on a gap to place it between steps.

const TYPE_TONE: Record<FlowNodeType, string> = {
    LANE: 'bg-zinc-900 text-white',
    QUESTION: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    PICK_CHILD: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
    INFO: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    TICKET: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    SCREEN: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
};

interface Props {
    tree: FlowTree;
    options: FlowOverview['options'];
    issues: FlowIssue[];
    selectedKey: string | null;
    readOnly: boolean;
    onSelect: (key: string) => void;
    onMove: (key: string, parentKey: string | null, index: number) => void;
    onAdd: (parentKey: string | null, type: FlowNodeType) => void;
}

export function FlowCanvas(props: Props) {
    const { tree, readOnly, onAdd } = props;
    const [dragKey, setDragKey] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const toggle = (key: string) =>
        setCollapsed((s) => {
            const n = new Set(s);
            if (n.has(key)) n.delete(key);
            else n.add(key);
            return n;
        });
    const ctx: Ctx = { ...props, dragKey, setDragKey, collapsed, toggle };

    return (
        <div className="overflow-x-auto pb-4">
            <div className="flex items-start gap-4 min-w-max">
                {tree.lanes.map((lane, i) => (
                    <div key={lane.key} className="flex items-start gap-4">
                        <Gap ctx={ctx} parentKey={null} index={i} vertical />
                        <LaneColumn ctx={ctx} lane={lane} />
                    </div>
                ))}
                <Gap ctx={ctx} parentKey={null} index={tree.lanes.length} vertical />
                {!readOnly && (
                    <button
                        type="button"
                        onClick={() => onAdd(null, 'LANE')}
                        className="w-64 h-28 shrink-0 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 dark:hover:text-zinc-100 flex flex-col items-center justify-center gap-1 text-sm font-bold"
                    >
                        <Plus className="h-5 w-5" /> Add lane
                    </button>
                )}
            </div>
        </div>
    );
}

interface Ctx extends Props {
    dragKey: string | null;
    setDragKey: (k: string | null) => void;
    collapsed: Set<string>;
    toggle: (key: string) => void;
}

function issueTone(issues: FlowIssue[], key: string): 'error' | 'warning' | null {
    const mine = issues.filter((i) => i.node_key === key);
    if (mine.some((i) => i.severity === 'error')) return 'error';
    return mine.length ? 'warning' : null;
}

function LaneColumn({ ctx, lane }: { ctx: Ctx; lane: FlowNode }) {
    const color = (lane.settings?.color as string) || '#4B5563';
    const category = lane.settings?.legacy_category === 'FINANCIAL' ? 'Fees' : 'General';
    const tone = issueTone(ctx.issues, lane.key);
    const selected = ctx.selectedKey === lane.key;
    return (
        <div className="w-80 shrink-0 space-y-2">
            <div
                draggable={!ctx.readOnly}
                onDragStart={(e) => startDrag(e, ctx, lane.key)}
                onDragEnd={() => ctx.setDragKey(null)}
                onDragOver={(e) => allowDrop(e, ctx, lane.key)}
                onDrop={(e) => dropOn(e, ctx, lane.key, (lane.children ?? []).length)}
                onClick={() => ctx.onSelect(lane.key)}
                className={`cursor-pointer rounded-2xl border-2 overflow-hidden bg-white dark:bg-zinc-950 transition ${
                    selected ? 'border-zinc-900 dark:border-zinc-100' : tone === 'error' ? 'border-red-400' : tone === 'warning' ? 'border-amber-300' : 'border-zinc-100 dark:border-zinc-800'
                }`}
            >
                <div className="h-1.5" style={{ background: color }} />
                <div className="p-3 flex items-center gap-3">
                    {!ctx.readOnly && <GripVertical className="h-4 w-4 text-zinc-300 shrink-0" />}
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: color }}>
                        <FlowIcon name={lane.icon} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-black text-sm text-zinc-900 dark:text-zinc-50 truncate">{lane.label}</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                            {category} · {countNodes(lane) - 1} steps
                            {lane.conditions ? ' · limited' : ''}
                        </p>
                    </div>
                </div>
            </div>
            <Children ctx={ctx} parent={lane} />
        </div>
    );
}

function Children({ ctx, parent }: { ctx: Ctx; parent: FlowNode }) {
    const kids = parent.children ?? [];
    const canAdd = !ctx.readOnly && allowedChildTypes(parent.type).length > 0;
    if (ctx.collapsed.has(parent.key)) return null;
    return (
        <div className="pl-4 border-l-2 border-zinc-100 dark:border-zinc-800 ml-4 space-y-1">
            {kids.map((child, i) => (
                <div key={child.key}>
                    <Gap ctx={ctx} parentKey={parent.key} index={i} />
                    <NodeCard ctx={ctx} node={child} />
                </div>
            ))}
            <Gap ctx={ctx} parentKey={parent.key} index={kids.length} />
            {canAdd && <AddMenu parentType={parent.type} onPick={(t) => ctx.onAdd(parent.key, t)} />}
        </div>
    );
}

function NodeCard({ ctx, node }: { ctx: Ctx; node: FlowNode }) {
    const selected = ctx.selectedKey === node.key;
    const tone = issueTone(ctx.issues, node.key);
    const hasKids = (node.children ?? []).length > 0;
    const isCollapsed = ctx.collapsed.has(node.key);
    const hints = nodeHints(node, ctx.options);
    return (
        <div>
            <div
                draggable={!ctx.readOnly}
                onDragStart={(e) => startDrag(e, ctx, node.key)}
                onDragEnd={() => ctx.setDragKey(null)}
                onDragOver={(e) => allowDrop(e, ctx, node.key)}
                onDrop={(e) => dropOn(e, ctx, node.key, (node.children ?? []).length)}
                onClick={(e) => {
                    e.stopPropagation();
                    ctx.onSelect(node.key);
                }}
                className={`group relative cursor-pointer rounded-xl border bg-white dark:bg-zinc-950 px-2.5 py-2 transition ${
                    selected
                        ? 'border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-900/10'
                        : tone === 'error'
                          ? 'border-red-400'
                          : tone === 'warning'
                            ? 'border-amber-300'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                } ${ctx.dragKey === node.key ? 'opacity-40' : ''}`}
            >
                <div className="flex items-start gap-2">
                    {hasKids ? (
                        <button
                            type="button"
                            className="mt-0.5 text-zinc-400 hover:text-zinc-900"
                            onClick={(e) => {
                                e.stopPropagation();
                                ctx.toggle(node.key);
                            }}
                            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                        >
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    ) : (
                        <span className="w-4" />
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`${chip} ${TYPE_TONE[node.type]}`}>{NODE_TYPE_LABEL[node.type]}</span>
                            {node.icon && <FlowIcon name={node.icon} className="h-3.5 w-3.5 text-zinc-400" />}
                            {isCollapsed && <span className="text-[10px] text-zinc-400">+{countNodes(node) - 1}</span>}
                        </div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mt-1 break-words">{node.label}</p>
                        {hints.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {hints.map((h) => (
                                    <span key={h} className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 rounded px-1.5 py-0.5">
                                        {h}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {hasKids && <Children ctx={ctx} parent={node} />}
            {!hasKids && !ctx.readOnly && allowedChildTypes(node.type).length > 0 && selected && (
                <div className="pl-4 ml-4 border-l-2 border-zinc-100 dark:border-zinc-800">
                    <AddMenu parentType={node.type} onPick={(t) => ctx.onAdd(node.key, t)} />
                </div>
            )}
        </div>
    );
}

function nodeHints(node: FlowNode, options: FlowOverview['options']): string[] {
    const out: string[] = [];
    const c = node.conditions;
    if (c?.child === 'WITH') out.push('with a child');
    if (c?.child === 'WITHOUT') out.push('not about a child');
    if (c?.campus_ids?.length) {
        out.push(c.campus_ids.map((id) => options.campuses.find((x) => x.id === id)?.campus_name ?? `#${id}`).join(', '));
    }
    if (c?.segment_ids?.length) out.push(`${c.segment_ids.length} segment(s)`);
    if (c?.class_ids?.length) out.push(`${c.class_ids.length} class(es)`);
    const s = node.settings ?? {};
    if (node.type === 'TICKET') {
        const q = options.queues.find((x) => x.id === s.queue_id);
        out.push(q ? `→ ${q.name}` : '→ rules / fallback');
    }
    if (node.type === 'SCREEN') out.push(`opens ${options.screens.find((x) => x.key === s.screen)?.label ?? s.screen}`);
    if (node.type === 'PICK_CHILD' && s.allow_none) out.push('“not a child” allowed');
    if (node.label_ur) out.push('اردو');
    return out;
}

function AddMenu({ parentType, onPick }: { parentType: FlowNodeType; onPick: (t: FlowNodeType) => void }) {
    const [open, setOpen] = useState(false);
    const types = allowedChildTypes(parentType);
    return (
        <div className="py-1">
            {open ? (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1.5 grid grid-cols-2 gap-1">
                    {types.map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onPick(t);
                            }}
                            className={`${chip} ${TYPE_TONE[t]} justify-center py-1.5 hover:opacity-80`}
                        >
                            {NODE_TYPE_LABEL[t]}
                        </button>
                    ))}
                    <button type="button" onClick={() => setOpen(false)} className="col-span-2 text-[11px] text-zinc-500 py-1">
                        Cancel
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-1 py-0.5"
                >
                    <Plus className="h-3.5 w-3.5" /> Add step
                </button>
            )}
        </div>
    );
}

// ─── Drag and drop ─────────────────────────────────────────────────────────────

function startDrag(e: DragEvent, ctx: Ctx, key: string) {
    if (ctx.readOnly) return;
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
    ctx.setDragKey(key);
}

function allowDrop(e: DragEvent, ctx: Ctx, parentKey: string | null) {
    if (!ctx.dragKey || ctx.readOnly) return;
    if (!canMove(ctx.tree, ctx.dragKey, parentKey)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
}

function dropOn(e: DragEvent, ctx: Ctx, parentKey: string | null, index: number) {
    if (!ctx.dragKey || !canMove(ctx.tree, ctx.dragKey, parentKey)) return;
    e.preventDefault();
    e.stopPropagation();
    ctx.onMove(ctx.dragKey, parentKey, index);
    ctx.setDragKey(null);
}

function Gap({ ctx, parentKey, index, vertical }: { ctx: Ctx; parentKey: string | null; index: number; vertical?: boolean }) {
    const [over, setOver] = useState(false);
    const active = !!ctx.dragKey && canMove(ctx.tree, ctx.dragKey, parentKey);
    if (!active) return vertical ? <div className="w-0" /> : <div className="h-0.5" />;
    return (
        <div
            onDragOver={(e) => {
                allowDrop(e, ctx, parentKey);
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
                setOver(false);
                dropOn(e, ctx, parentKey, index);
            }}
            className={
                vertical
                    ? `self-stretch w-3 rounded-full transition ${over ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-100 dark:bg-zinc-800'}`
                    : `h-2.5 my-0.5 rounded-full transition ${over ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-100 dark:bg-zinc-800'}`
            }
        />
    );
}
