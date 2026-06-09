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

export const zkPushService = {
    getLogs: async (sn?: string): Promise<ZkPushLogsResponse> => {
        const params = sn ? { sn } : {};
        const res = await api.get('/v1/attendance/zk-push-logs', { params });
        return res.data;
    },
};
