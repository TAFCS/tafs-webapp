import api from './api';

export const noticeBoardService = {
  async countPending(): Promise<number> {
    try {
      const res = await api.get('v1/admin/notice-board/review/count');
      return res.data?.pending ?? 0;
    } catch {
      return 0;
    }
  },
};
