import api from './api';

export interface AuditLog {
  id: number;
  entity_type: string;
  entity_id: string;
  action: 'UPDATED' | 'CREATED' | 'DELETED' | 'STATUS_CHANGED' | string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  changed_by: string;
  changed_by_display?: string | null;
  employee_id?: number | null;
  employee_name?: string | null;
  employee_code?: string | null;
  changed_at: string;
  note?: string | null;
  student_id?: number | null;
  section?: string | null;
  parent_id?: number | null;
  child_count?: number;
  children?: AuditLog[];
}

export interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
}

export interface AuditLogsQuery {
  student_id?: number;
  /**
   * Free text. Terms AND together; each bare term is matched across the whole
   * row, including the resolved actor name and, for employee rows, the
   * employee's name and code. `key:value` narrows one term — supported keys
   * are entity, id, action, section, field, actor, note and value. Quote a
   * phrase to keep it whole: note:"marked as left".
   */
  q?: string;
  /** Comma-separated. */
  entity_type?: string;
  entity_id?: string;
  /** Comma-separated. */
  action?: string;
  /** Comma-separated. */
  field?: string;
  changed_by?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  /** Comma-separated. */
  section?: string;
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
