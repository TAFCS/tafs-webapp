import api from './api';

export interface HouseInfo {
    id: number;
    house_name: string | null;
    house_color: string | null;
}

export interface HouseAssignmentPreview {
    student_id: number;
    student_cc: number;
    student_name: string;
    current_house: HouseInfo | null;
    proposed_house: HouseInfo;
}

export interface HouseBalancerPreview {
    campus: { id: number; campus_name: string; campus_code: string };
    class: { id: number; description: string; class_code: string };
    section: { id: number; description: string };
    student_count: number;
    roster_fingerprint: string;
    current_counts: Record<number, number>;
    proposed_counts: Record<number, number>;
    houses: HouseInfo[];
    assignments: HouseAssignmentPreview[];
}

export interface HouseBalancerApplyResult {
    campus: { id: number; campus_name: string; campus_code: string };
    class: { id: number; description: string; class_code: string };
    section: { id: number; description: string };
    student_count: number;
    before_counts: Record<number, number>;
    after_counts: Record<number, number>;
    houses: HouseInfo[];
    assignments: Array<{ student_id: number; house_id: number }>;
}

export interface HouseBalancerScope {
    campus_id: number;
    class_id: number;
    section_id: number;
}

interface ApiEnvelope<T> {
    data: T;
    status: number;
    message: string;
}

export const houseBalancerService = {
    async preview(scope: HouseBalancerScope): Promise<HouseBalancerPreview> {
        const { data } = await api.post<ApiEnvelope<HouseBalancerPreview>>(
            '/v1/house-balancer/preview',
            scope,
        );
        return data.data;
    },

    async apply(
        scope: HouseBalancerScope & {
            roster_fingerprint: string;
            assignments: Array<{ student_id: number; house_id: number }>;
        },
    ): Promise<HouseBalancerApplyResult> {
        const { data } = await api.post<ApiEnvelope<HouseBalancerApplyResult>>(
            '/v1/house-balancer/apply',
            scope,
        );
        return data.data;
    },
};
