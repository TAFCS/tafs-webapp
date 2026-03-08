import api from './api';

export interface CampusClassInfo {
    id: number;
    description: string;
    class_code: string;
    academic_system: string;
}

export interface CampusClass {
    id: number;
    is_active: boolean;
    classes: CampusClassInfo;
}

export interface SectionInfo {
    id: number;
    description: string;
}

export interface CampusSection {
    id: number;
    class_id: number;
    section_id: number;
    is_active: boolean;
    sections: SectionInfo;
    classes: {
        id: number;
        description: string;
        class_code: string;
    };
}

export interface Campus {
    id: number;
    campus_code: string;
    campus_name: string;
    campus_classes?: CampusClass[];
    campus_sections?: CampusSection[];
}

export interface CreateCampusPayload {
    campus_code: string;
    campus_name: string;
}

export type UpdateCampusPayload = Partial<CreateCampusPayload>;

export interface BulkUpdateCampusesPayload {
    items: (UpdateCampusPayload & { id: number })[];
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

    async addClassToCampus(campusId: number, classId: number): Promise<CampusClass> {
        const { data } = await api.post<ApiEnvelope<CampusClass>>(`/v1/campuses/${campusId}/classes/${classId}`);
        return data.data;
    },

    async updateCampusClass(campusId: number, classId: number, isActive: boolean): Promise<CampusClass> {
        const { data } = await api.patch<ApiEnvelope<CampusClass>>(`/v1/campuses/${campusId}/classes/${classId}`, { is_active: isActive });
        return data.data;
    },

    async removeClassFromCampus(campusId: number, classId: number): Promise<void> {
        await api.delete(`/v1/campuses/${campusId}/classes/${classId}`);
    },

    async listAllClasses(): Promise<CampusClassInfo[]> {
        const { data } = await api.get<ApiEnvelope<CampusClassInfo[]>>('/v1/campuses/options/classes');
        return data.data;
    },

    async listAllSections(): Promise<SectionInfo[]> {
        const { data } = await api.get<ApiEnvelope<SectionInfo[]>>('/v1/campuses/options/sections');
        return data.data;
    },

    async addSectionToCampus(campusId: number, classId: number, sectionId: number): Promise<CampusSection> {
        const { data } = await api.post<ApiEnvelope<CampusSection>>(`/v1/campuses/${campusId}/classes/${classId}/sections/${sectionId}`);
        return data.data;
    },

    async updateCampusSection(campusId: number, classId: number, sectionId: number, isActive: boolean): Promise<CampusSection> {
        const { data } = await api.patch<ApiEnvelope<CampusSection>>(`/v1/campuses/${campusId}/classes/${classId}/sections/${sectionId}`, { is_active: isActive });
        return data.data;
    },

    async removeSectionFromCampus(campusId: number, classId: number, sectionId: number): Promise<void> {
        await api.delete(`/v1/campuses/${campusId}/classes/${classId}/sections/${sectionId}`);
    },
};
