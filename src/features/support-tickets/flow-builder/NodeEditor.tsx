'use client';

import { Copy, Plus, Trash2 } from 'lucide-react';
import {
    allowedChildTypes,
    countNodes,
    locate,
    NODE_TYPE_HINT,
    NODE_TYPE_LABEL,
    type FlowConditions,
    type FlowIssue,
    type FlowNode,
    type FlowNodeType,
    type FlowOverview,
    type FlowTree,
} from '@/lib/ticket-flow.service';
import { hasPickAbove } from './flow-editor';
import { FLOW_ICON_GLYPHS, FlowIcon } from './flow-icons';
import { card, chip, dangerBtn, ghostBtn, input, label, textarea } from './styles';

interface Props {
    tree: FlowTree;
    nodeKey: string;
    options: FlowOverview['options'];
    issues: FlowIssue[];
    readOnly: boolean;
    onPatch: (patch: Partial<FlowNode>) => void;
    onSettings: (patch: Record<string, unknown>) => void;
    onConditions: (patch: Partial<FlowConditions>) => void;
    onAdd: (type: FlowNodeType) => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

export function NodeEditor(p: Props) {
    const at = locate(p.tree, p.nodeKey);
    if (!at) return null;
    const node = at.node;
    const s = (node.settings ?? {}) as Record<string, unknown>;
    const laneCategory = at.lane.settings?.legacy_category === 'FINANCIAL' ? 'FINANCIAL' : 'GENERAL';
    const mine = p.issues.filter((i) => i.node_key === node.key);
    const ro = p.readOnly;
    const str = (k: string) => (typeof s[k] === 'string' ? (s[k] as string) : '');
    const rulesHere = p.options.rules.filter(
        (r) => r.node_key === node.key || (node.type === 'TICKET' && r.subtopic && r.subtopic.trim().toLowerCase() === node.label.trim().toLowerCase() && r.category === laneCategory),
    );

    return (
        <div className={`${card} p-5 space-y-5`}>
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <span className={`${chip} bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300`}>{NODE_TYPE_LABEL[node.type]}</span>
                    <span className="text-[11px] text-zinc-400 font-mono truncate" title="Step key">
                        {node.key}
                    </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{NODE_TYPE_HINT[node.type]}</p>
                <p className="text-[11px] text-zinc-400">{at.path.map((n) => n.label).join(' › ')}</p>
            </div>

            {mine.length > 0 && (
                <ul className="space-y-1">
                    {mine.map((i, n) => (
                        <li
                            key={n}
                            className={`text-xs rounded-lg px-2.5 py-1.5 ${i.severity === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}
                        >
                            {i.message}
                        </li>
                    ))}
                </ul>
            )}

            <fieldset disabled={ro} className="space-y-5">
                <Bilingual
                    title={node.type === 'LANE' ? 'Lane name' : node.type === 'PICK_CHILD' ? 'Step name' : 'Answer text'}
                    hint={node.type === 'LANE' ? 'Shown on the lane card.' : 'How this option reads in the list above it.'}
                    en={node.label}
                    ur={node.label_ur ?? ''}
                    max={p.options.limits.labelLength}
                    onEn={(v) => p.onPatch({ label: v })}
                    onUr={(v) => p.onPatch({ label_ur: v || undefined })}
                />
                <Bilingual
                    title="Help text"
                    hint="Optional small text under the option."
                    en={node.help ?? ''}
                    ur={node.help_ur ?? ''}
                    onEn={(v) => p.onPatch({ help: v || undefined })}
                    onUr={(v) => p.onPatch({ help_ur: v || undefined })}
                />

                <div className="space-y-1.5">
                    <p className={label}>Icon</p>
                    <div className="grid grid-cols-8 gap-1">
                        <button
                            type="button"
                            title="No icon"
                            onClick={() => p.onPatch({ icon: undefined })}
                            className={`h-8 rounded-lg border text-[10px] ${!node.icon ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-200 dark:border-zinc-800'}`}
                        >
                            –
                        </button>
                        {p.options.icons.filter((i) => FLOW_ICON_GLYPHS[i]).map((i) => (
                            <button
                                key={i}
                                type="button"
                                title={i}
                                onClick={() => p.onPatch({ icon: i })}
                                className={`h-8 rounded-lg border flex items-center justify-center ${node.icon === i ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'}`}
                            >
                                <FlowIcon name={i} className="h-4 w-4" />
                            </button>
                        ))}
                    </div>
                </div>

                {node.type === 'LANE' && (
                    <>
                        <div className="space-y-1.5">
                            <p className={label}>Colour</p>
                            <div className="flex flex-wrap gap-1.5">
                                {p.options.colors.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => p.onSettings({ color: c })}
                                        className={`h-8 w-8 rounded-full border-2 ${s.color === c ? 'border-zinc-900 dark:border-zinc-100 scale-110' : 'border-transparent'}`}
                                        style={{ background: c }}
                                        aria-label={c}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className={label}>Category</p>
                            <select
                                className={input}
                                value={laneCategory}
                                onChange={(e) => p.onSettings({ legacy_category: e.target.value, fallback_queue_id: undefined })}
                            >
                                <option value="GENERAL">General: general desk, principals</option>
                                <option value="FINANCIAL">Fees: finance staff</option>
                            </select>
                            <p className="text-[11px] text-zinc-500">
                                Decides which queues and rules can take this lane&apos;s tickets, and who sees them when closed.
                            </p>
                        </div>
                        <QueueSelect
                            title="Lane fallback queue"
                            hint="Where a ticket goes when neither a rule nor its own step names a queue. Empty: the category fallback."
                            value={(s.fallback_queue_id as number | undefined) ?? null}
                            category={laneCategory}
                            options={p.options}
                            onChange={(v) => p.onSettings({ fallback_queue_id: v ?? undefined })}
                        />
                        <Bilingual
                            title="Description"
                            hint="One line on the lane card."
                            en={str('description')}
                            ur={str('description_ur')}
                            onEn={(v) => p.onSettings({ description: v })}
                            onUr={(v) => p.onSettings({ description_ur: v })}
                        />
                        <Bilingual
                            title="Question over its answers"
                            en={str('prompt')}
                            ur={str('prompt_ur')}
                            onEn={(v) => p.onSettings({ prompt: v })}
                            onUr={(v) => p.onSettings({ prompt_ur: v })}
                        />
                    </>
                )}

                {node.type === 'QUESTION' && (
                    <Bilingual
                        title="Question over its answers"
                        hint='e.g. "What went wrong?"'
                        en={str('prompt')}
                        ur={str('prompt_ur')}
                        onEn={(v) => p.onSettings({ prompt: v })}
                        onUr={(v) => p.onSettings({ prompt_ur: v })}
                    />
                )}

                {node.type === 'PICK_CHILD' && (
                    <>
                        <Bilingual title="Heading over the child list" en={str('prompt')} ur={str('prompt_ur')} onEn={(v) => p.onSettings({ prompt: v })} onUr={(v) => p.onSettings({ prompt_ur: v })} />
                        <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                            <input type="checkbox" checked={!!s.allow_none} onChange={(e) => p.onSettings({ allow_none: e.target.checked })} />
                            Offer &quot;not about one child&quot;
                        </label>
                        {!!s.allow_none && (
                            <Bilingual title="That option's text" en={str('none_label')} ur={str('none_label_ur')} onEn={(v) => p.onSettings({ none_label: v })} onUr={(v) => p.onSettings({ none_label_ur: v })} />
                        )}
                        <Bilingual title="Heading over the answers that follow" en={str('then_prompt')} ur={str('then_prompt_ur')} onEn={(v) => p.onSettings({ then_prompt: v })} onUr={(v) => p.onSettings({ then_prompt_ur: v })} />
                        <p className="text-[11px] text-zinc-500">
                            Steps under this one can be limited to &quot;with a child&quot; or &quot;not about a child&quot; in their Show for section.
                        </p>
                    </>
                )}

                {node.type === 'INFO' && (
                    <>
                        <Bilingual title="Answer shown to the parent" multiline en={str('body')} ur={str('body_ur')} onEn={(v) => p.onSettings({ body: v })} onUr={(v) => p.onSettings({ body_ur: v })} />
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <p className={label}>Link (optional)</p>
                                <input className={input} placeholder="https://" value={str('link_url')} onChange={(e) => p.onSettings({ link_url: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <p className={label}>Link text</p>
                                <input className={input} value={str('link_label')} onChange={(e) => p.onSettings({ link_label: e.target.value })} />
                            </div>
                        </div>
                        <Bilingual
                            title='"Still need help" button'
                            hint="Shown when there are steps under this one."
                            en={str('continue_label')}
                            ur={str('continue_label_ur')}
                            onEn={(v) => p.onSettings({ continue_label: v })}
                            onUr={(v) => p.onSettings({ continue_label_ur: v })}
                        />
                    </>
                )}

                {node.type === 'TICKET' && (
                    <>
                        <QueueSelect
                            title="Send tickets to"
                            hint="Used when no routing rule claims the ticket. Empty: the lane fallback, then the category fallback."
                            value={(s.queue_id as number | undefined) ?? null}
                            category={laneCategory}
                            options={p.options}
                            onChange={(v) => p.onSettings({ queue_id: v ?? undefined })}
                        />
                        {rulesHere.length > 0 && (
                            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3 text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
                                <p className="font-bold">Routing rules that match this step</p>
                                {rulesHere.map((r) => (
                                    <p key={r.id}>• {r.name}</p>
                                ))}
                                <p className="text-zinc-500">Rules are tried first. Renaming this step breaks rules that match on the old topic text.</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <p className={label}>Minimum characters</p>
                                <input
                                    className={input}
                                    type="number"
                                    min={1}
                                    max={2000}
                                    value={(s.min_length as number | undefined) ?? p.options.default_min_length}
                                    onChange={(e) => p.onSettings({ min_length: Math.max(1, Math.min(2000, Number(e.target.value) || 1)) })}
                                />
                            </div>
                            <label className="flex items-end gap-2 pb-2.5 text-sm text-zinc-800 dark:text-zinc-200">
                                <input type="checkbox" checked={s.attachments !== false} onChange={(e) => p.onSettings({ attachments: e.target.checked })} />
                                Allow an attachment
                            </label>
                        </div>
                        <Bilingual title="Placeholder in the description box" en={str('placeholder')} ur={str('placeholder_ur')} onEn={(v) => p.onSettings({ placeholder: v })} onUr={(v) => p.onSettings({ placeholder_ur: v })} />
                    </>
                )}

                {node.type === 'SCREEN' && (
                    <div className="space-y-1">
                        <p className={label}>Screen to open</p>
                        <select className={input} value={str('screen')} onChange={(e) => p.onSettings({ screen: e.target.value })}>
                            {p.options.screens.map((x) => (
                                <option key={x.key} value={x.key}>
                                    {x.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <Conditions
                    node={node}
                    options={p.options}
                    showChild={node.type !== 'LANE' && hasPickAbove(p.tree, node.key)}
                    onChange={p.onConditions}
                />
            </fieldset>

            {!ro && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    {allowedChildTypes(node.type).length > 0 && <AddChildButtons parentType={node.type} onAdd={p.onAdd} />}
                    {node.type !== 'LANE' && (
                        <button type="button" className={ghostBtn} onClick={p.onDuplicate}>
                            <Copy className="h-3.5 w-3.5" /> Duplicate
                        </button>
                    )}
                    <button
                        type="button"
                        className={dangerBtn}
                        onClick={() => {
                            const n = countNodes(node);
                            if (n === 1 || window.confirm(`Delete "${node.label}" and the ${n - 1} step(s) under it?`)) p.onDelete();
                        }}
                    >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                </div>
            )}
        </div>
    );
}

function AddChildButtons({ parentType, onAdd }: { parentType: FlowNodeType; onAdd: (t: FlowNodeType) => void }) {
    return (
        <select
            className={`${ghostBtn} pr-2`}
            value=""
            onChange={(e) => {
                if (e.target.value) onAdd(e.target.value as FlowNodeType);
            }}
        >
            <option value="">+ Add step under this</option>
            {allowedChildTypes(parentType).map((t) => (
                <option key={t} value={t}>
                    {NODE_TYPE_LABEL[t]}
                </option>
            ))}
        </select>
    );
}

function Bilingual(props: {
    title: string;
    hint?: string;
    en: string;
    ur: string;
    max?: number;
    multiline?: boolean;
    onEn: (v: string) => void;
    onUr: (v: string) => void;
}) {
    const Field = props.multiline ? 'textarea' : 'input';
    return (
        <div className="space-y-1">
            <p className={label}>{props.title}</p>
            <Field className={props.multiline ? textarea : input} value={props.en} maxLength={props.max} onChange={(e) => props.onEn(e.target.value)} />
            <Field
                className={`${props.multiline ? textarea : input} text-right`}
                dir="rtl"
                lang="ur"
                placeholder="اردو (اختیاری)"
                value={props.ur}
                maxLength={props.max}
                onChange={(e) => props.onUr(e.target.value)}
            />
            {props.hint && <p className="text-[11px] text-zinc-500">{props.hint}</p>}
        </div>
    );
}

function QueueSelect(props: {
    title: string;
    hint: string;
    value: number | null;
    category: 'GENERAL' | 'FINANCIAL';
    options: FlowOverview['options'];
    onChange: (v: number | null) => void;
}) {
    const queues = props.options.queues.filter((q) => q.category === props.category);
    return (
        <div className="space-y-1">
            <p className={label}>{props.title}</p>
            <select className={input} value={props.value ?? ''} onChange={(e) => props.onChange(e.target.value ? Number(e.target.value) : null)}>
                <option value="">No queue</option>
                {queues.map((q) => (
                    <option key={q.id} value={q.id}>
                        {q.name}
                        {q.is_fallback ? ' (category fallback)' : ''}
                        {q.is_active ? '' : ' (switched off)'}
                    </option>
                ))}
            </select>
            <p className="text-[11px] text-zinc-500">{props.hint}</p>
        </div>
    );
}

function Conditions({
    node,
    options,
    showChild,
    onChange,
}: {
    node: FlowNode;
    options: FlowOverview['options'];
    showChild: boolean;
    onChange: (patch: Partial<FlowConditions>) => void;
}) {
    const c = node.conditions ?? {};
    const toggle = (list: number[] | undefined, id: number) => {
        const set = new Set(list ?? []);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        return [...set];
    };
    const classes = c.segment_ids?.length ? options.classes.filter((x) => x.segment_id != null && c.segment_ids!.includes(x.segment_id)) : options.classes;
    return (
        <div className="space-y-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-3">
            <div>
                <p className={label}>Show for</p>
                <p className="text-[11px] text-zinc-500">Empty means everyone. Before a child is picked, a step shows when any child in the family matches.</p>
            </div>
            {showChild && (
                <div className="flex gap-1">
                    {(
                        [
                            [undefined, 'Always'],
                            ['WITH', 'With a child'],
                            ['WITHOUT', 'Not about a child'],
                        ] as const
                    ).map(([v, l]) => (
                        <button
                            key={l}
                            type="button"
                            onClick={() => onChange({ child: v })}
                            className={`flex-1 h-8 rounded-lg text-xs font-bold border ${c.child === v ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'}`}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            )}
            <ChipSet
                title="Campuses"
                items={options.campuses.map((x) => ({ id: x.id, name: x.campus_name }))}
                selected={c.campus_ids ?? []}
                onToggle={(id) => onChange({ campus_ids: toggle(c.campus_ids, id) })}
            />
            <ChipSet
                title="Segments"
                items={options.segments.map((x) => ({ id: x.id, name: x.name }))}
                selected={c.segment_ids ?? []}
                onToggle={(id) => onChange({ segment_ids: toggle(c.segment_ids, id) })}
            />
            <ChipSet
                title="Classes"
                items={classes.map((x) => ({ id: x.id, name: x.description }))}
                selected={c.class_ids ?? []}
                onToggle={(id) => onChange({ class_ids: toggle(c.class_ids, id) })}
            />
        </div>
    );
}

function ChipSet({ title, items, selected, onToggle }: { title: string; items: { id: number; name: string }[]; selected: number[]; onToggle: (id: number) => void }) {
    return (
        <div className="space-y-1">
            <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">{title}</p>
            <div className="flex flex-wrap gap-1 max-h-28 overflow-auto">
                {items.map((x) => {
                    const on = selected.includes(x.id);
                    return (
                        <button
                            key={x.id}
                            type="button"
                            onClick={() => onToggle(x.id)}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${on ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'}`}
                        >
                            {on && <Plus className="inline h-3 w-3 rotate-45 -ml-0.5" />} {x.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
