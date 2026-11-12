import api from './api';

export const noticeBoardService = {
  /**
   * TAFSD-497: one page of the admin board. `q` searches title, body, poster,
   * a student's C.C., GR, name or family, or a class (server-side, in scope).
   * `cursor` is the oldest unpinned post id already loaded.
   */
  async listPosts(params: { cursor?: number; q?: string } = {}, signal?: AbortSignal): Promise<unknown[]> {
    const q = params.q?.trim();
    const res = await api.get('v1/admin/notice-board', {
      params: { ...(params.cursor ? { cursor: params.cursor } : {}), ...(q ? { q } : {}) },
      signal,
    });
    return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
  },

  async countPending(): Promise<number> {
    try {
      const res = await api.get('v1/admin/notice-board/review/count');
      return res.data?.pending ?? 0;
    } catch {
      return 0;
    }
  },
};
