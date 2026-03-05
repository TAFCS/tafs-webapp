import api from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Family {
  id: number;
  household_name: string;
  email: string | null;
  primary_address: string | null;
  legacy_pid: string | null;
  created_at: string;
  student_count?: number;
  primary_guardian?: {
    name: string;
    cnic: string | null;
  } | null;
}

export interface FamilyStudent {
  id: number;
  first_name: string;
  last_name: string;
  cc_number: string | null;
  gr_number: string | null;
  status: string;
  photograph_url: string | null;
  campuses: { campus_name: string; campus_code: string } | null;
}

export interface FamilyGuardian {
  id: number;
  full_name: string;
  primary_phone: string | null;
  email_address: string | null;
  cnic: string | null;
  occupation: string | null;
  relationship: string | null;
}

export interface FamilyDetail extends Family {
  students: FamilyStudent[];
  guardians: FamilyGuardian[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface FamilyListResult {
  data: Family[];
  meta: PaginationMeta;
}

export interface CreateFamilyPayload {
  household_name: string;
  primary_address?: string;
  email?: string;
  password?: string;
  legacy_pid?: string;
}

export type UpdateFamilyPayload = Partial<CreateFamilyPayload>;

// ─── Envelope helpers ─────────────────────────────────────────────────────────

interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
  status: number;
  message: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const familiesService = {
  async list(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<FamilyListResult> {
    const { data } = await api.get<ApiEnvelope<Family[]>>('/v1/families', {
      params,
    });
    return { data: data.data, meta: data.meta! };
  },

  async getById(id: number): Promise<FamilyDetail> {
    const { data } = await api.get<ApiEnvelope<FamilyDetail>>(
      `/v1/families/${id}`,
    );
    return data.data;
  },

  async create(payload: CreateFamilyPayload): Promise<Family> {
    const { data } = await api.post<ApiEnvelope<Family>>('/v1/families', payload);
    return data.data;
  },

  async update(id: number, payload: UpdateFamilyPayload): Promise<Family> {
    const { data } = await api.patch<ApiEnvelope<Family>>(
      `/v1/families/${id}`,
      payload,
    );
    return data.data;
  },

  async assignChild(familyId: number, studentId: number): Promise<void> {
    await api.post(`/v1/families/${familyId}/assign-child`, {
      student_id: studentId,
    });
  },
};
