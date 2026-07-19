import api from './api';
import { StudentListItem } from '../store/slices/studentsSlice';

export interface SectionRosterStudent extends StudentListItem {
    cc: number;
    gender: string | null;
    demographic?: {
        gender?: string | null;
    };
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
        campus_id: number;
        class_id: number;
        section_id: number;
    }): Promise<SectionRosterStudent[]> {
        const { data } = await api.get<PaginatedEnvelope<SectionRosterStudent>>(
            '/v1/students',
            {
                params: {
                    ...params,
                    status: 'ENROLLED',
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

    async moveToSection(
        studentCc: number,
        assignment: { campus_id: number; class_id: number; section_id: number },
    ): Promise<void> {
        await api.patch(`/v1/students/${studentCc}/assignment`, assignment);
    },
};
