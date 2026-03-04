import api from './api';
import type { StaffUser } from '@/store/slices/authSlice';

// ─── Response Types ───────────────────────────────────────────────────────────

// Tokens are set as httpOnly cookies by the backend — they never appear in
// the JSON response body. Only the user object is returned to the client.
export interface StaffLoginResult {
  user: StaffUser;
}

// Envelope that the backend always wraps responses in
interface ApiEnvelope<T> {
  data: T;
  status: number;
  message: string;
}

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const authService = {
  /**
   * POST /api/v1/auth/staff/login
   * Backend sets tafs_access + tafs_refresh + tafs_session httpOnly cookies.
   * Returns only the user object in the JSON body.
   */
  async loginStaff(username: string, password: string): Promise<StaffLoginResult> {
    const { data } = await api.post<ApiEnvelope<StaffLoginResult>>('/v1/auth/staff/login', {
      username,
      password,
    });
    return data.data;
  },

  /**
   * POST /api/v1/auth/staff/refresh
   * No body needed — browser sends tafs_refresh httpOnly cookie automatically.
   * Backend rotates both tokens and returns the updated user.
   */
  async refreshStaff(): Promise<StaffLoginResult> {
    const { data } = await api.post<ApiEnvelope<StaffLoginResult>>('/v1/auth/staff/refresh', {});
    return data.data;
  },

  /**
   * POST /api/v1/auth/staff/logout
   * Requires valid tafs_access cookie (sent automatically).
   * Backend clears all three auth cookies via Set-Cookie.
   */
  async logoutStaff(): Promise<void> {
    await api.post('/v1/auth/staff/logout');
  },
};
