import api from './api';

export interface Campus {
    id: number;
    campus_code: string;
    campus_name: string;
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
};
