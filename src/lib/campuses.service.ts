import api from './api';
import { fetchCampusesOnce, invalidateCampusesCache } from './campuses-cache';

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

/** TAFSD-549: a campus UAN is written 111-XXX-XXX. The backend accepts nothing else. */
export const UAN_PATTERN = /^111-\d{3}-\d{3}$/;

/** Format what is typed into 111-XXX-XXX as it goes: digits only, dashes added, nine digits at most. */
export function formatUan(raw: string): string {
    const d = raw.replace(/\D/g, "").slice(0, 9);
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join("-");
}

export interface Campus {
    id: number;
    campus_code: string;
    campus_name: string;
    address?: string;
    /** TAFSD-549: printed on the campus's statements of entry and admit cards. */
    uan_number?: string | null;
    campus_prefix?: string | null;
    /** TAFSD-603: the footer the campus's official documents print, one entry a line. Empty: each document's own. */
    document_footer?: string[];
    offered_classes?: OfferedClass[];
}

/** TAFSD-603: one footer line as a document prints it. */
export interface DocumentFooterLineFit {
    text: string;
    size: number;
    full_size: number;
    /** Printed smaller than usual so it stays on one line. */
    shrunk: boolean;
    /** Too wide even at the smallest size: the footer cannot be saved. */
    overflow: boolean;
}

/** TAFSD-603: the bottom of one kind of document as it prints with the draft footer. */
export interface DocumentFooterPreviewArea {
    id: "EXAM_DOCUMENT" | "LEAVING_CERTIFICATE";
    label: string;
    /** The draft's lines print, or (draft empty) the document's own footer. */
    source: "CAMPUS_FOOTER" | "DOCUMENT_DEFAULT";
    fits: boolean;
    lines: DocumentFooterLineFit[];
    /** Size of the strip in points. */
    width: number;
    height: number;
    pdf_base64: string;
}

export interface DocumentFooterPreview {
    lines: string[];
    max_lines: number;
    max_chars: number;
    /** Why the draft cannot be saved; empty when it can. */
    problems: string[];
    areas: DocumentFooterPreviewArea[];
}

export interface CreateCampusPayload {
    campus_code: string;
    campus_name: string;
    address?: string;
    uan_number?: string;
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
        return fetchCampusesOnce(async () => {
            const { data } = await api.get<ApiEnvelope<Campus[]>>('/v1/campuses');
            return data.data;
        });
    },

    async getById(id: number): Promise<Campus> {
        const { data } = await api.get<ApiEnvelope<Campus>>(`/v1/campuses/${id}`);
        return data.data;
    },

    async create(payload: CreateCampusPayload): Promise<Campus> {
        const { data } = await api.post<ApiEnvelope<Campus>>('/v1/campuses', payload);
        invalidateCampusesCache();
        return data.data;
    },

    async update(id: number, payload: UpdateCampusPayload): Promise<Campus> {
        const { data } = await api.patch<ApiEnvelope<Campus>>(`/v1/campuses/${id}`, payload);
        invalidateCampusesCache();
        return data.data;
    },

    async bulkUpdate(payload: BulkUpdateCampusesPayload): Promise<Campus[]> {
        const { data } = await api.patch<ApiEnvelope<Campus[]>>('/v1/campuses/bulk', payload);
        invalidateCampusesCache();
        return data.data;
    },

    /** TAFSD-603: lay out an unsaved footer on each kind of document, as it prints. Saves nothing. */
    async previewDocumentFooter(id: number, lines: string[], signal?: AbortSignal): Promise<DocumentFooterPreview> {
        const { data } = await api.post<ApiEnvelope<DocumentFooterPreview>>(`/v1/campuses/${id}/document-footer/preview`, { lines }, { signal });
        return data.data;
    },

    /** TAFSD-603: save the campus's document footer. No lines puts every document back on its own footer. */
    async saveDocumentFooter(id: number, lines: string[]): Promise<string[]> {
        const { data } = await api.put<ApiEnvelope<{ id: number; document_footer: string[] }>>(`/v1/campuses/${id}/document-footer`, { lines });
        invalidateCampusesCache();
        return data.data.document_footer;
    },

    async delete(id: number): Promise<void> {
        await api.delete(`/v1/campuses/${id}`);
        invalidateCampusesCache();
    },

    async upsertCampusClass(campusId: number, classId: number, isActive: boolean = true): Promise<Campus> {
        const { data } = await api.put<ApiEnvelope<Campus>>(`/v1/campuses/${campusId}/classes/${classId}`, { is_active: isActive });
        invalidateCampusesCache();
        return data.data;
    },

    async removeClassFromCampus(campusId: number, classId: number): Promise<Campus> {
        const { data } = await api.delete<ApiEnvelope<Campus>>(`/v1/campuses/${campusId}/classes/${classId}`);
        invalidateCampusesCache();
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
        invalidateCampusesCache();
        return data.data;
    },

    async removeSectionFromCampus(campusId: number, classId: number, sectionId: number): Promise<Campus> {
        const { data } = await api.delete<ApiEnvelope<Campus>>(`/v1/campuses/${campusId}/classes/${classId}/sections/${sectionId}`);
        invalidateCampusesCache();
        return data.data;
    },
};
