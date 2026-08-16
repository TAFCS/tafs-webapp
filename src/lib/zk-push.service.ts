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
    photograph_url?: string | null;
    classes?: { description: string | null } | null;
    sections?: { description: string | null } | null;
    campuses?: { campus_name: string | null } | null;
}

export interface CreateDeviceMappingPayload {
    device_sn: string;
    device_pin: string;
    person_type: DevicePersonType;
    employee_id?: number;
    student_cc?: number;
    display_name?: string;
    notes?: string;
    /** Required to revive a deliberately deactivated mapping — the endpoint upserts. */
    is_active?: boolean;
    /** Deliberately override a BLOCK-level PIN collision. */
    acknowledge_collisions?: boolean;
}

export interface UpdateDeviceMappingPayload {
    person_type?: DevicePersonType;
    employee_id?: number;
    student_cc?: number;
    display_name?: string;
    notes?: string;
    is_active?: boolean;
    acknowledge_collisions?: boolean;
}

export type CollisionSeverity = 'BLOCK' | 'WARN';

export interface PinCollision {
    code: 'PIN_IS_OTHER_STUDENT_GR' | 'PIN_IS_OTHER_STUDENT_CC' | 'PIN_NOT_EQUAL_TO_CC' | 'PIN_USED_ON_OTHER_DEVICE';
    severity: CollisionSeverity;
    message: string;
    conflicting_student_cc?: number;
    conflicting_student_name?: string;
    conflicting_mapping_id?: number;
}

/**
 * What a link/unlink would actually do to stored attendance. Mapping changes now
 * replay the PIN's whole history, so this is the difference between a one-click
 * edit and a silent rewrite of somebody's record.
 */
export interface MappingImpact {
    scans_examined: number;
    scans_linked: number;
    scans_moved: number;
    scans_unlinked: number;
    days_appearing: number;
    days_recalculated: number;
    days_removed: number;
    days_protected: number;
    /** "STUDENT:44" style refs for people who would LOSE these scans. */
    affects_other_people: string[];
    reversible: boolean;
    summary: string;
    warnings: string[];
}

/** Returned in place of a resolution report when a PIN is too large to rebuild inline. */
export interface SkippedResolution {
    skipped: true;
    needs_rebuild: true;
    scan_count: number;
    warning: string;
    resolve_request: { kind: 'device_pin'; device_sn: string; device_pin: string; dry_run: false };
}

export type MappingMutationResult = DeviceUserMapping & {
    resolution?: { needs_rebuild?: boolean } & Partial<SkippedResolution>;
    collisions?: PinCollision[];
};

export interface PreviewLinkPayload {
    device_sn: string;
    device_pin: string;
    person_type: DevicePersonType;
    employee_id?: number;
    student_cc?: number;
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

    getMappings: async (employeeId?: number, studentCc?: number): Promise<DeviceUserMapping[]> => {
        const params = employeeId != null ? { employee_id: employeeId } : studentCc != null ? { student_cc: studentCc } : {};
        const res = await api.get('/v1/attendance/zk-device-mappings', { params });
        return res.data;
    },

    createMapping: async (payload: CreateDeviceMappingPayload): Promise<MappingMutationResult> => {
        const res = await api.post('/v1/attendance/zk-device-mappings', payload);
        return res.data;
    },

    updateMapping: async (id: number, payload: UpdateDeviceMappingPayload): Promise<MappingMutationResult> => {
        const res = await api.patch(`/v1/attendance/zk-device-mappings/${id}`, payload);
        return res.data;
    },

    deleteMapping: async (id: number): Promise<MappingMutationResult> => {
        const res = await api.delete(`/v1/attendance/zk-device-mappings/${id}`);
        return res.data;
    },

    /** "If I linked this PIN to this person, what would happen?" — powers the confirm step. */
    previewLink: async (payload: PreviewLinkPayload): Promise<MappingImpact> => {
        const res = await api.post('/v1/attendance/zk-scan-resolution/preview-link', payload);
        return res.data.data;
    },

    /** "If I unlinked or deleted this PIN's mapping, what would happen?" */
    previewUnlink: async (deviceSn: string, devicePin: string): Promise<MappingImpact> => {
        const res = await api.post('/v1/attendance/zk-scan-resolution/preview-unlink', {
            device_sn: deviceSn,
            device_pin: devicePin,
        });
        return res.data.data;
    },

    checkCollisions: async (payload: PreviewLinkPayload): Promise<PinCollision[]> => {
        const res = await api.get('/v1/attendance/zk-device-mappings/collision-check', {
            params: {
                device_sn: payload.device_sn,
                device_pin: payload.device_pin,
                person_type: payload.person_type,
                employee_id: payload.employee_id,
                student_cc: payload.student_cc,
            },
        });
        return res.data;
    },

    /** Finish a rebuild the mapping mutation was too large to do inline. */
    rebuildPin: async (deviceSn: string, devicePin: string): Promise<void> => {
        await api.post('/v1/attendance/zk-scan-resolution/resolve', {
            kind: 'device_pin',
            device_sn: deviceSn,
            device_pin: devicePin,
            dry_run: false,
        });
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
