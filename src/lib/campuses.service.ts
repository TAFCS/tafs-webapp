import api from './api';

export type SectionGenderMode = 'COED' | 'BOYS_ONLY' | 'GIRLS_ONLY';

export interface CampusClassInfo {
    id: number;
    description: string;
    class_code: string;
    academic_system: string;
}

export interface SectionInfo {
    id: number;
    description: string;
}

export interface OfferedSection extends SectionInfo {
    campus_section_id: number;
    is_active: boolean;
    student_capacity?: number | null;
    gender_mode?: SectionGenderMode;
    enrolled_count?: number;
    remaining_seats?: number | null;
    is_full?: boolean;
    male_count?: number;
    female_count?: number;
    unknown_count?: number;
    capacity_conflict_count?: number;
    gender_conflict_count?: number;
}

export interface OfferedClass extends CampusClassInfo {
    campus_class_id: number;
    is_active: boolean;
    sections: OfferedSection[];
}

export interface Campus {
    id: number;
    campus_code: string;
    campus_name: string;
    address?: string;
    campus_prefix?: string | null;
    offered_classes?: OfferedClass[];
}

export interface CreateCampusPayload {
    campus_code: string;
    campus_name: string;
    address?: string;
    campus_prefix?: string;
}

export type UpdateCampusPayload = Partial<CreateCampusPayload>;

export interface BulkUpdateCampusesPayload {
    items: (UpdateCampusPayload & { id: number })[];
}

export interface UpsertCampusSectionPayload {
    is_active?: boolean;
    student_capacity?: number | null;
    gender_mode?: SectionGenderMode;
}

interface ApiEnvelope<T> {
    data: T;
    status: number;
    message: string;
}

export const campusesService = {
    async list(): Promise<Campus[]> {
        const { data } = await api.get<ApiEnvelope<Campus[]>>('/v1/campuses');
        return data.data;
    },

    async getById(id: number): Promise<Campus> {
        const { data } = await api.get<ApiEnvelope<Campus>>(`/v1/campuses/${id}`);
        return data.data;
    },

    async create(payload: CreateCampusPayload): Promise<Campus> {
        const { data } = await api.post<ApiEnvelope<Campus>>('/v1/campuses', payload);
        return data.data;
    },

    async update(id: number, payload: UpdateCampusPayload): Promise<Campus> {
        const { data } = await api.patch<ApiEnvelope<Campus>>(`/v1/campuses/${id}`, payload);
        return data.data;
    },

    async bulkUpdate(payload: BulkUpdateCampusesPayload): Promise<Campus[]> {
        const { data } = await api.patch<ApiEnvelope<Campus[]>>('/v1/campuses/bulk', payload);
        return data.data;
    },

    async delete(id: number): Promise<void> {
        await api.delete(`/v1/campuses/${id}`);
    },

    async upsertCampusClass(campusId: number, classId: number, isActive: boolean = true): Promise<Campus> {
        const { data } = await api.put<ApiEnvelope<Campus>>(`/v1/campuses/${campusId}/classes/${classId}`, { is_active: isActive });
        return data.data;
    },

    async removeClassFromCampus(campusId: number, classId: number): Promise<Campus> {
        const { data } = await api.delete<ApiEnvelope<Campus>>(`/v1/campuses/${campusId}/classes/${classId}`);
        return data.data;
    },

    async listAllClasses(): Promise<CampusClassInfo[]> {
        const { data } = await api.get<ApiEnvelope<CampusClassInfo[]>>('/v1/classes');
        return data.data;
    },

    async listAllSections(): Promise<SectionInfo[]> {
        const { data } = await api.get<ApiEnvelope<SectionInfo[]>>('/v1/sections');
        return data.data;
    },

    async upsertCampusSection(
        campusId: number,
        classId: number,
        sectionId: number,
        payload: UpsertCampusSectionPayload | boolean = true,
    ): Promise<Campus> {
        const body: UpsertCampusSectionPayload =
            typeof payload === 'boolean' ? { is_active: payload } : payload;
        const { data } = await api.put<ApiEnvelope<Campus>>(
            `/v1/campuses/${campusId}/classes/${classId}/sections/${sectionId}`,
            body,
        );
        return data.data;
    },

    async removeSectionFromCampus(campusId: number, classId: number, sectionId: number): Promise<Campus> {
        const { data } = await api.delete<ApiEnvelope<Campus>>(`/v1/campuses/${campusId}/classes/${classId}/sections/${sectionId}`);
        return data.data;
    },
};
