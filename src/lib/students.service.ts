import api from './api';
import { StudentListItem } from '../store/slices/studentsSlice';

export interface SectionRosterStudent extends StudentListItem {
    cc: number;
    gender: string | null;
    demographic?: {
        gender?: string | null;
    };
}

export interface SimpleStudentSearchResult {
    cc: number;
    full_name: string | null;
    gr_number: string | null;
    photograph_url?: string | null;
    classes?: { description: string | null } | null;
    sections?: { description: string | null } | null;
    campuses?: { campus_name: string | null } | null;
}

interface PaginatedEnvelope<T> {
    data: {
        items: T[];
        meta: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    };
}

export const studentsService = {
    async getById(id: number): Promise<StudentListItem> {
        const { data } = await api.get(`/v1/students/${id}`);
        return data.data;
    },

    async unexpel(id: number): Promise<void> {
        await api.patch(`/v1/students/${id}/unexpel`);
    },

    async undoLeft(id: number): Promise<void> {
        await api.patch(`/v1/students/${id}/undo-left`);
    },

    async listSectionRoster(params: {
        campus_id?: string | number;
        class_id?: string | number;
        section_id: number | string;
    }): Promise<SectionRosterStudent[]> {
        const { data } = await api.get<PaginatedEnvelope<SectionRosterStudent>>(
            '/v1/students',
            {
                params: {
                    campus_id: params.campus_id,
                    class_id: params.class_id,
                    section_id: params.section_id,
                    fields: 'core,demographic',
                    limit: 500,
                    page: 1,
                },
            },
        );
        return data.data.items.map((student) => ({
            ...student,
            cc: Number(student.cc ?? student.id),
            gender: student.demographic?.gender ?? student.gender ?? null,
        }));
    },

    async searchSimple(params: {
        q: string;
        campus_id?: string | number;
        class_id?: string | number;
        section_id?: string | number;
        segment_id?: string | number;
    }): Promise<SimpleStudentSearchResult[]> {
        const { data } = await api.get<{ data: SimpleStudentSearchResult[] }>(
            '/v1/students/search-simple',
            {
                params: {
                    q: params.q,
                    campus_id: params.campus_id,
                    class_id: params.class_id,
                    section_id: params.section_id,
                    segment_id: params.segment_id,
                },
            },
        );
        return data?.data ?? [];
    },

    async moveToSection(
        studentCc: number,
        assignment: { campus_id: number; class_id: number; section_id: number },
    ): Promise<void> {
        await api.patch(`/v1/students/${studentCc}/assignment`, assignment);
    },
};
