import {
    allKeys,
    allowedChildTypes,
    cloneTree,
    isWithin,
    locate,
    newKey,
    rekey,
    type FlowConditions,
    type FlowNode,
    type FlowNodeType,
    type FlowTree,
} from '@/lib/ticket-flow.service';

// Pure edits on a ticket flow tree (TAFSD-447). Every function returns a new tree.

const DEFAULT_LABEL: Record<FlowNodeType, string> = {
    LANE: 'New lane',
    QUESTION: 'New question',
    PICK_CHILD: 'Which child is this about?',
    INFO: 'Helpful answer',
    TICKET: 'New topic',
    SCREEN: 'Open a screen',
};

export function blankNode(type: FlowNodeType, tree: FlowTree, opts: { color?: string; minLength?: number } = {}): FlowNode {
    const label = DEFAULT_LABEL[type];
    const key = newKey(label, allKeys(tree));
    switch (type) {
        case 'LANE':
            return {
                key,
                type,
                label,
                icon: 'help',
                settings: { color: opts.color ?? '#2563EB', legacy_category: 'GENERAL', prompt: 'What is this about?' },
                children: [],
            };
        case 'QUESTION':
            return { key, type, label, settings: { prompt: 'What is this about?' }, children: [] };
        case 'PICK_CHILD':
            return {
                key,
                type,
                label,
                settings: {
                    prompt: 'Which child is this about?',
                    allow_none: true,
                    none_label: 'Not about one child',
                    then_prompt: 'What is this about?',
                },
                children: [],
            };
        case 'INFO':
            return {
                key,
                type,
                label,
                settings: { body: 'Write the answer parents should see here.', continue_label: 'I still need help' },
                children: [],
            };
        case 'TICKET':
            return { key, type, label, settings: { min_length: opts.minLength ?? 20, attachments: true } };
        case 'SCREEN':
            return { key, type, label, settings: { screen: 'fees' } };
    }
}

export function updateNode(tree: FlowTree, key: string, patch: Partial<FlowNode>): FlowTree {
    const next = cloneTree(tree);
    const at = locate(next, key);
    if (!at) return tree;
    Object.assign(at.node, patch);
    return next;
}

export function updateSettings(tree: FlowTree, key: string, patch: Record<string, unknown>): FlowTree {
    const next = cloneTree(tree);
    const at = locate(next, key);
    if (!at) return tree;
    const settings = { ...(at.node.settings ?? {}), ...patch };
    for (const [k, v] of Object.entries(settings)) if (v === undefined || v === '') delete settings[k];
    at.node.settings = settings;
    return next;
}

export function updateConditions(tree: FlowTree, key: string, patch: Partial<FlowConditions>): FlowTree {
    const next = cloneTree(tree);
    const at = locate(next, key);
    if (!at) return tree;
    const cond: FlowConditions = { ...(at.node.conditions ?? {}), ...patch };
    if (!cond.campus_ids?.length) delete cond.campus_ids;
    if (!cond.segment_ids?.length) delete cond.segment_ids;
    if (!cond.class_ids?.length) delete cond.class_ids;
    if (!cond.child) delete cond.child;
    if (Object.keys(cond).length) at.node.conditions = cond;
    else delete at.node.conditions;
    return next;
}

/** Add a child (or a lane when parentKey is null). Returns the new tree and the new key. */
export function addChild(
    tree: FlowTree,
    parentKey: string | null,
    type: FlowNodeType,
    opts: { color?: string; minLength?: number } = {},
): { tree: FlowTree; key: string } | null {
    const next = cloneTree(tree);
    const node = blankNode(type, next, opts);
    if (parentKey === null) {
        if (type !== 'LANE') return null;
        next.lanes.push(node);
        return { tree: next, key: node.key };
    }
    const at = locate(next, parentKey);
    if (!at || !allowedChildTypes(at.node.type).includes(type)) return null;
    at.node.children = [...(at.node.children ?? []), node];
    return { tree: next, key: node.key };
}

export function removeNode(tree: FlowTree, key: string): FlowTree {
    const next = cloneTree(tree);
    const at = locate(next, key);
    if (!at) return tree;
    at.siblings.splice(at.index, 1);
    return next;
}

export function duplicateNode(tree: FlowTree, key: string): { tree: FlowTree; key: string } | null {
    const next = cloneTree(tree);
    const at = locate(next, key);
    if (!at) return null;
    const copy = rekey(JSON.parse(JSON.stringify(at.node)) as FlowNode, allKeys(next));
    copy.label = `${copy.label} (copy)`.slice(0, 80);
    at.siblings.splice(at.index + 1, 0, copy);
    return { tree: next, key: copy.key };
}

/** Can `key` be dropped under `parentKey` (null = the lane row)? */
export function canMove(tree: FlowTree, key: string, parentKey: string | null): boolean {
    const at = locate(tree, key);
    if (!at) return false;
    if (parentKey === null) return at.node.type === 'LANE';
    if (at.node.type === 'LANE') return false;
    const target = locate(tree, parentKey);
    if (!target) return false;
    if (isWithin(at.node, parentKey)) return false;
    return allowedChildTypes(target.node.type).includes(at.node.type);
}

/** Move a step (with everything under it) to `index` among `parentKey`'s children. */
export function moveNode(tree: FlowTree, key: string, parentKey: string | null, index: number): FlowTree {
    if (!canMove(tree, key, parentKey)) return tree;
    const next = cloneTree(tree);
    const at = locate(next, key)!;
    const [node] = at.siblings.splice(at.index, 1);
    const list = parentKey === null ? next.lanes : (locate(next, parentKey)!.node.children ??= []);
    const sameList = list === at.siblings;
    const i = sameList && index > at.index ? index - 1 : index;
    list.splice(Math.max(0, Math.min(i, list.length)), 0, node);
    return next;
}

/** True when a PICK_CHILD sits above this step, so child conditions make sense. */
export function hasPickAbove(tree: FlowTree, key: string): boolean {
    const at = locate(tree, key);
    return !!at && at.path.slice(0, -1).some((n) => n.type === 'PICK_CHILD');
}
