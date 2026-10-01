import api from './api';

export type TicketCategory = 'GENERAL' | 'FINANCIAL';
export type TicketChildMatch = 'ANY' | 'WITH_CHILD' | 'NO_CHILD';
export type TicketQueueAssignment = 'POOL' | 'AUTO';

export interface RoutingStaff {
    id: string;
    full_name: string;
    username: string;
    role: string;
    is_active?: boolean;
}

export interface RoutingRule {
    id: number;
    name: string;
    category: TicketCategory;
    child_match: TicketChildMatch;
    campus_id: number | null;
    segment_id: number | null;
    class_ids: number[];
    subtopic: string | null;
    target_user_id: string | null;
    target_queue_id: number | null;
    priority: number;
    is_active: boolean;
    updated_at: string;
    updated_by: string | null;
    target_user: RoutingStaff | null;
    target_queue: { id: number; name: string; is_active: boolean } | null;
}

export interface TicketQueue {
    id: number;
    name: string;
    category: TicketCategory;
    assignment: TicketQueueAssignment;
    allow_forward: boolean;
    is_fallback: boolean;
    is_active: boolean;
    open_tickets: number;
    members: { sort_order: number; user: RoutingStaff }[];
}

export interface RoutingOverview {
    rules: RoutingRule[];
    queues: TicketQueue[];
    options: {
        campuses: { id: number; campus_name: string }[];
        segments: { id: number; name: string }[];
        classes: { id: number; description: string; segment_id: number | null }[];
        staff: RoutingStaff[];
        subtopics: Record<'GENERAL_WITH_CHILD' | 'GENERAL_NO_CHILD' | 'FINANCIAL', string[]>;
        all_subtopics: string[];
    };
}

export interface RoutingIssue {
    severity: 'error' | 'warning';
    code: string;
    message: string;
    rule_id?: number;
    queue_id?: number;
}

export interface RoutingDecision {
    student: string | null;
    status: 'OPEN' | 'ASSIGNED';
    queueId: number | null;
    ruleId: number | null;
    note: string | null;
    target: { kind: 'user' | 'queue' | 'none'; id: string | number | null; name: string | null };
    steps: { rule_id: number | null; rule_name: string; outcome: 'routed' | 'skipped'; reason: string }[];
}

export interface UserRoutingImpact {
    rules: { id: number; name: string }[];
    queues: { id: number; name: string; last_active_member: boolean }[];
    affected: boolean;
}

export type RuleInput = Partial<
    Pick<
        RoutingRule,
        | 'name'
        | 'category'
        | 'child_match'
        | 'campus_id'
        | 'segment_id'
        | 'class_ids'
        | 'subtopic'
        | 'target_user_id'
        | 'target_queue_id'
        | 'priority'
        | 'is_active'
    >
>;

export type QueueInput = Partial<
    Pick<TicketQueue, 'name' | 'category' | 'assignment' | 'allow_forward' | 'is_fallback' | 'is_active'>
> & { member_ids?: string[] };

const BASE = '/v1/support-ticket-routing';

export const ticketRoutingService = {
    async overview(): Promise<RoutingOverview> {
        const { data } = await api.get(BASE);
        return data?.data ?? data;
    },
    async health(): Promise<RoutingIssue[]> {
        const { data } = await api.get(`${BASE}/health`);
        return data?.data ?? data;
    },
    async preview(input: { category: TicketCategory; subtopic?: string; student_cc?: number }): Promise<RoutingDecision> {
        const { data } = await api.post(`${BASE}/preview`, input);
        return data?.data ?? data;
    },
    async userImpact(userId: string): Promise<UserRoutingImpact> {
        const { data } = await api.get(`${BASE}/user-impact/${userId}`);
        return data?.data ?? data;
    },
    async createRule(input: RuleInput): Promise<RoutingRule> {
        const { data } = await api.post(`${BASE}/rules`, input);
        return data?.data ?? data;
    },
    async updateRule(id: number, input: RuleInput): Promise<RoutingRule> {
        const { data } = await api.patch(`${BASE}/rules/${id}`, input);
        return data?.data ?? data;
    },
    async deleteRule(id: number): Promise<void> {
        await api.delete(`${BASE}/rules/${id}`);
    },
    async createQueue(input: QueueInput): Promise<TicketQueue> {
        const { data } = await api.post(`${BASE}/queues`, input);
        return data?.data ?? data;
    },
    async updateQueue(id: number, input: QueueInput): Promise<TicketQueue> {
        const { data } = await api.patch(`${BASE}/queues/${id}`, input);
        return data?.data ?? data;
    },
    async deleteQueue(id: number): Promise<void> {
        await api.delete(`${BASE}/queues/${id}`);
    },
};

/** Backend error text for a toast, falling back to a generic line. */
export function routingErrorMessage(e: unknown, fallback: string): string {
    const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    return typeof msg === 'string' ? msg : fallback;
}
