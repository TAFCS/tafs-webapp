import api from './api';

export const noticeBoardService = {
  /**
   * TAFSD-497: one page of the admin board. `q` searches title, body, poster,
   * a student's C.C., GR, name or family, or a class (server-side, in scope).
   * `cursor` is the oldest unpinned post id already loaded. TAFSD-507: `mine`
   * keeps the caller's own posts; campus / class / section keep posts that
   * reached a student placed there.
   */
  async listPosts(
    params: { cursor?: number; q?: string; mine?: boolean; campusIds?: number[]; classIds?: number[]; sectionIds?: number[] } = {},
    signal?: AbortSignal,
  ): Promise<unknown[]> {
    const q = params.q?.trim();
    const res = await api.get('v1/admin/notice-board', {
      params: {
        ...(params.cursor ? { cursor: params.cursor } : {}),
        ...(q ? { q } : {}),
        ...(params.mine ? { mine: 'true' } : {}),
        ...(params.campusIds?.length ? { campus_id: params.campusIds.join(',') } : {}),
        ...(params.classIds?.length ? { class_id: params.classIds.join(',') } : {}),
        ...(params.sectionIds?.length ? { section_id: params.sectionIds.join(',') } : {}),
      },
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
