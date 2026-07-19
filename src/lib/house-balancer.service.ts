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

export interface CampusHouseBalanceGroup {
    class: { id: number; description: string; class_code: string };
    section: { id: number; description: string };
    student_count: number;
    roster_fingerprint: string;
    current_counts: Record<number, number>;
    proposed_counts: Record<number, number>;
    assignments: HouseAssignmentPreview[];
}

export interface CampusHouseBalancerPreview {
    campus: { id: number; campus_name: string; campus_code: string };
    total_students: number;
    group_count: number;
    campus_fingerprint: string;
    houses: HouseInfo[];
    groups: CampusHouseBalanceGroup[];
}

export interface CampusHouseBalancerApplyResult {
    campus: { id: number; campus_name: string; campus_code: string };
    total_students: number;
    group_count: number;
    groups: Array<{
        class_id: number;
        section_id: number;
        student_count: number;
        before_counts: Record<number, number>;
        after_counts: Record<number, number>;
    }>;
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

    async previewCampus(campusId: number): Promise<CampusHouseBalancerPreview> {
        const { data } = await api.post<ApiEnvelope<CampusHouseBalancerPreview>>(
            '/v1/house-balancer/preview-campus',
            { campus_id: campusId },
        );
        return data.data;
    },

    async applyCampus(
        preview: CampusHouseBalancerPreview,
    ): Promise<CampusHouseBalancerApplyResult> {
        const { data } = await api.post<ApiEnvelope<CampusHouseBalancerApplyResult>>(
            '/v1/house-balancer/apply-campus',
            {
                campus_id: preview.campus.id,
                campus_fingerprint: preview.campus_fingerprint,
                groups: preview.groups.map((group) => ({
                    class_id: group.class.id,
                    section_id: group.section.id,
                    roster_fingerprint: group.roster_fingerprint,
                    assignments: group.assignments.map((assignment) => ({
                        student_id: assignment.student_id,
                        house_id: assignment.proposed_house.id,
                    })),
                })),
            },
        );
        return data.data;
    },
};
