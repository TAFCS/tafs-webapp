import api from './api';

export interface ZkPushLog {
    id: number;
    sn: string;
    raw_payload: Record<string, unknown>;
    received_at: string;
}

export interface ZkPushLogsResponse {
    logs: ZkPushLog[];
    devices: string[];
}

export type DevicePersonType = 'STAFF' | 'STUDENT';

export interface DeviceUserMapping {
    id: number;
    device_sn: string;
    device_pin: string;
    person_type: DevicePersonType;
    employee_id: number | null;
    student_cc: number | null;
    display_name: string | null;
    is_active: boolean;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    employee_profiles: { id: number; full_name: string | null; employee_code: string | null } | null;
    students: { cc: number; full_name: string; gr_number: string | null } | null;
}

export interface UnmappedPin {
    device_sn: string;
    device_pin: string;
    scan_count: number;
    first_seen: string;
    last_seen: string;
    suggested_name: string | null;
}

export interface PersonSearchResult {
    id?: number;
    cc?: number;
    full_name: string | null;
    employee_code?: string | null;
    gr_number?: string | null;
}

export interface CreateDeviceMappingPayload {
    device_sn: string;
    device_pin: string;
    person_type: DevicePersonType;
    employee_id?: number;
    student_cc?: number;
    display_name?: string;
    notes?: string;
}

export interface UpdateDeviceMappingPayload {
    person_type?: DevicePersonType;
    employee_id?: number;
    student_cc?: number;
    display_name?: string;
    notes?: string;
    is_active?: boolean;
}

export interface SimulateScanPayload {
    device_sn: string;
    device_pin: string;
    scan_time?: string;
}

export interface SimulateScanResult {
    scan: {
        id: number;
        scan_time: string;
        attendance_date: string;
        sequence_no: number | null;
        direction: 'IN' | 'OUT' | null;
        is_duplicate: boolean;
        is_live: boolean;
        person_type: DevicePersonType | null;
    } | null;
    record: {
        status: string;
        check_in_at: string | null;
        check_out_at: string | null;
        last_scan_at: string | null;
    } | null;
    notified?: boolean;
    skip_reason?: 'unmapped_pin' | 'duplicate_scan' | 'not_live' | 'no_direction' | 'no_family_id' | null;
}

export const zkPushService = {
    getLogs: async (sn?: string): Promise<ZkPushLogsResponse> => {
        const params = sn ? { sn } : {};
        const res = await api.get('/v1/attendance/zk-push-logs', { params });
        return res.data;
    },

    getMappings: async (): Promise<DeviceUserMapping[]> => {
        const res = await api.get('/v1/attendance/zk-device-mappings');
        return res.data;
    },

    createMapping: async (payload: CreateDeviceMappingPayload): Promise<DeviceUserMapping> => {
        const res = await api.post('/v1/attendance/zk-device-mappings', payload);
        return res.data;
    },

    updateMapping: async (id: number, payload: UpdateDeviceMappingPayload): Promise<DeviceUserMapping> => {
        const res = await api.patch(`/v1/attendance/zk-device-mappings/${id}`, payload);
        return res.data;
    },

    getUnmappedPins: async (): Promise<UnmappedPin[]> => {
        const res = await api.get('/v1/attendance/zk-device-mappings/unmapped');
        return res.data;
    },

    searchStudents: async (q: string): Promise<PersonSearchResult[]> => {
        const res = await api.get('/v1/students/search-simple', { params: { q } });
        return res.data.data;
    },

    searchEmployees: async (q: string): Promise<PersonSearchResult[]> => {
        const res = await api.get('/v1/hr/employees/search-simple', { params: { q } });
        return res.data.data;
    },

    simulateScan: async (payload: SimulateScanPayload): Promise<SimulateScanResult> => {
        const res = await api.post('/v1/attendance/zk-device-mappings/simulate-scan', payload);
        return res.data;
    },
};
