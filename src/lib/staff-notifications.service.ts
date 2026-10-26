import api from './api';

/** TAFSD-429: one of the signed-in staff member's own notifications. */
export interface StaffNotification {
  id: number;
  kind: string;
  title: string;
  body: string;
  /** Webapp path to open, e.g. /notice-board?post=12. */
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export const staffNotificationsService = {
  async list(limit = 30): Promise<{ items: StaffNotification[]; unread: number }> {
    const res = await api.get('v1/staff-notifications', { params: { limit } });
    return res.data?.data ?? { items: [], unread: 0 };
  },
  async unreadCount(): Promise<number> {
    try {
      const res = await api.get('v1/staff-notifications/unread-count');
      return Number(res.data?.data?.count ?? 0);
    } catch {
      return 0;
    }
  },
  async markRead(id: number): Promise<void> {
    await api.patch(`v1/staff-notifications/${id}/read`);
  },
  async markAllRead(): Promise<void> {
    await api.patch('v1/staff-notifications/read-all');
  },
};
