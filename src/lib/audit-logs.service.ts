import api from './api';

export interface AuditLog {
  id: number;
  entity_type: 'STUDENT' | 'GUARDIAN' | 'FAMILY' | 'VOUCHER' | 'DEPOSIT';
  entity_id: string;
  action: 'UPDATED' | 'CREATED' | 'DELETED' | 'STATUS_CHANGED';
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  changed_by: string;
  changed_at: string;
  note?: string | null;
  student_id?: number | null;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
}

export interface AuditLogsQuery {
  student_id?: number;
  entity_type?: string;
  changed_by?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export const auditLogsService = {
  async list(params: AuditLogsQuery): Promise<AuditLogsResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') {
        query.set(k, String(v));
      }
    });
    const { data } = await api.get(`/v1/audit-logs?${query.toString()}`);
    return data.data; // Response helper wraps with { success: true, message: '...', data: { data: [...], total: N } }
  },
};
