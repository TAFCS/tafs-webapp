import api from './api';
import type { RoutingDecision, TicketCategory } from './ticket-routing.service';

// The parent ticket flow builder (TAFSD-447). Mirrors
// tafs-backend src/modules/support-tickets/flow/flow.types.ts.

export type FlowNodeType = 'LANE' | 'QUESTION' | 'PICK_CHILD' | 'INFO' | 'TICKET' | 'SCREEN';

export interface FlowConditions {
    campus_ids?: number[];
    segment_ids?: number[];
    class_ids?: number[];
    child?: 'WITH' | 'WITHOUT';
}

export interface FlowNode {
    key: string;
    type: FlowNodeType;
    label: string;
    label_ur?: string;
    help?: string;
    help_ur?: string;
    icon?: string;
    conditions?: FlowConditions;
    settings?: Record<string, unknown>;
    children?: FlowNode[];
}

export interface FlowTree {
    schema: number;
    lanes: FlowNode[];
}

export interface FlowIssue {
    severity: 'error' | 'warning';
    code: string;
    message: string;
    node_key?: string;
}

export interface FlowDiff {
    added: string[];
    removed: string[];
    renamed: string[];
    moved: string[];
    changed: string[];
}

export interface FlowVersionSummary {
    version: number;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    notes: string | null;
    created_at: string;
    created_by: string | null;
    updated_at: string;
    updated_by: string | null;
    published_at: string | null;
    published_by: string | null;
    archived_at: string | null;
    created_from: number | null;
}

export interface FlowDraft extends FlowVersionSummary {
    tree: FlowTree;
    lock_version: number;
    issues: FlowIssue[];
}

export interface FlowQueueOption {
    id: number;
    name: string;
    category: TicketCategory;
    is_active: boolean;
    is_fallback: boolean;
}

export interface FlowOverview {
    published: FlowVersionSummary;
    published_tree: FlowTree;
    draft: (FlowVersionSummary & { tree: FlowTree; lock_version: number }) | null;
    options: {
        queues: FlowQueueOption[];
        campuses: { id: number; campus_name: string }[];
        segments: { id: number; name: string }[];
        classes: { id: number; description: string; segment_id: number | null }[];
        rules: { id: number; name: string; category: TicketCategory; subtopic: string | null; node_key: string | null }[];
        node_types: FlowNodeType[];
        screens: { key: string; label: string }[];
        icons: string[];
        colors: string[];
        limits: { maxDepth: number; maxNodes: number; maxLanes: number; maxChildren: number; labelLength: number };
        default_min_length: number;
    };
}

export interface FlowRoutePreview extends RoutingDecision {
    version: number;
    student: string | null;
    path: { key: string; type: FlowNodeType; label: string }[];
}

export interface FlowRouteAllRow {
    leaf_key: string;
    labels: string[];
    available: boolean;
    reason?: string;
    target?: RoutingDecision['target'];
    rule_id?: number | null;
    note?: string | null;
    status?: string;
}

const BASE = '/v1/support-ticket-flow';
const unwrap = <T,>(data: unknown): T => ((data as { data?: T })?.data ?? data) as T;

export const ticketFlowService = {
    async overview(): Promise<FlowOverview> {
        const { data } = await api.get(BASE);
        return unwrap(data);
    },
    async openDraft(fromVersion?: number): Promise<FlowDraft> {
        const { data } = await api.post(`${BASE}/draft`, fromVersion ? { from_version: fromVersion } : {});
        return unwrap(data);
    },
    async saveDraft(tree: FlowTree, lockVersion: number): Promise<FlowDraft> {
        const { data } = await api.put(`${BASE}/draft`, { tree, lock_version: lockVersion });
        return unwrap(data);
    },
    async discardDraft(): Promise<void> {
        await api.delete(`${BASE}/draft`);
    },
    async validate(): Promise<{ issues: FlowIssue[]; diff: FlowDiff }> {
        const { data } = await api.post(`${BASE}/draft/validate`, {});
        return unwrap(data);
    },
    async publish(lockVersion: number, notes: string): Promise<{ version: number; diff: FlowDiff }> {
        const { data } = await api.post(`${BASE}/draft/publish`, { lock_version: lockVersion, notes });
        return unwrap(data);
    },
    async versions(): Promise<FlowVersionSummary[]> {
        const { data } = await api.get(`${BASE}/versions`);
        return unwrap(data);
    },
    async version(v: number): Promise<FlowVersionSummary & { tree: FlowTree }> {
        const { data } = await api.get(`${BASE}/versions/${v}`);
        return unwrap(data);
    },
    async previewRoute(path: string[], studentCc?: number, draft = true): Promise<FlowRoutePreview> {
        const { data } = await api.post(`${BASE}/preview-route`, { path, student_cc: studentCc, draft });
        return unwrap(data);
    },
    async routeAll(studentCc?: number, draft = true): Promise<{ version: number; student: string | null; leaves: FlowRouteAllRow[] }> {
        const { data } = await api.post(`${BASE}/route-all`, { student_cc: studentCc, draft });
        return unwrap(data);
    },
};

/** Backend error text (and issue list, when the backend sent one) for a toast. */
export function flowErrorMessage(e: unknown, fallback: string): string {
    const body = (e as { response?: { data?: { message?: unknown; issues?: FlowIssue[] } } })?.response?.data;
    const msg = body?.message as unknown;
    if (Array.isArray(msg)) return msg.join(', ');
    if (msg && typeof msg === 'object' && 'message' in (msg as object)) return String((msg as { message: unknown }).message);
    return typeof msg === 'string' ? msg : fallback;
}

export function flowErrorCode(e: unknown): string | null {
    const body = (e as { response?: { data?: { code?: unknown; message?: unknown } } })?.response?.data;
    const code = body?.code ?? (body?.message as { code?: unknown } | undefined)?.code;
    return typeof code === 'string' ? code : null;
}

// ─── Tree helpers (pure) ──────────────────────────────────────────────────────

export const NODE_TYPE_LABEL: Record<FlowNodeType, string> = {
    LANE: 'Lane',
    QUESTION: 'Question',
    PICK_CHILD: 'Pick a child',
    INFO: 'Info',
    TICKET: 'Open a ticket',
    SCREEN: 'Go to a screen',
};

export const NODE_TYPE_HINT: Record<FlowNodeType, string> = {
    LANE: 'A kind of request the parent picks first.',
    QUESTION: 'Asks a question; the steps under it are the answers.',
    PICK_CHILD: 'Parent chooses which child (or "not about a child"); the steps under it come next.',
    INFO: 'Shows an answer before any ticket. "Still need help" carries on to the steps under it.',
    TICKET: 'Ends the flow: the parent describes the problem and sends a ticket.',
    SCREEN: 'Ends the flow by opening a screen in the app instead of a ticket.',
};

/** Which step types may sit under a parent of this type. */
export function allowedChildTypes(parent: FlowNodeType | null): FlowNodeType[] {
    if (parent === null) return ['LANE'];
    if (parent === 'TICKET' || parent === 'SCREEN') return [];
    return ['QUESTION', 'PICK_CHILD', 'INFO', 'TICKET', 'SCREEN'];
}

export function newKey(label: string, taken: Set<string>): string {
    const base =
        label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 28) || 'step';
    let key = base;
    while (taken.has(key) || !/^[a-z0-9]/.test(key)) key = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    return key;
}

export function allKeys(tree: FlowTree): Set<string> {
    const keys = new Set<string>();
    const visit = (n: FlowNode) => {
        keys.add(n.key);
        (n.children ?? []).forEach(visit);
    };
    tree.lanes.forEach(visit);
    return keys;
}

export interface Located {
    node: FlowNode;
    parent: FlowNode | null;
    siblings: FlowNode[];
    index: number;
    lane: FlowNode;
    path: FlowNode[];
}

export function locate(tree: FlowTree, key: string): Located | null {
    let found: Located | null = null;
    const visit = (siblings: FlowNode[], parent: FlowNode | null, lane: FlowNode | null, path: FlowNode[]) => {
        siblings.forEach((n, index) => {
            if (found) return;
            const here = [...path, n];
            const l = lane ?? n;
            if (n.key === key) found = { node: n, parent, siblings, index, lane: l, path: here };
            else visit(n.children ?? [], n, l, here);
        });
    };
    visit(tree.lanes, null, null, []);
    return found;
}

export function cloneTree(tree: FlowTree): FlowTree {
    return JSON.parse(JSON.stringify(tree)) as FlowTree;
}

/** True when `maybeChild` is `ancestor` or sits anywhere under it. */
export function isWithin(ancestor: FlowNode, maybeChildKey: string): boolean {
    if (ancestor.key === maybeChildKey) return true;
    return (ancestor.children ?? []).some((c) => isWithin(c, maybeChildKey));
}

export function countNodes(n: FlowNode): number {
    return 1 + (n.children ?? []).reduce((s, c) => s + countNodes(c), 0);
}

/** Re-key a copied subtree so every key stays unique. */
export function rekey(n: FlowNode, taken: Set<string>): FlowNode {
    const key = newKey(n.label, taken);
    taken.add(key);
    return { ...n, key, children: (n.children ?? []).map((c) => rekey(c, taken)) };
}
